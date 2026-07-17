-- Ring 3: invariants enforced at rest — the Postgres dialect.
--
-- Same invariants as SQLite's, and NOT the same SQL. SQLite says
-- `SELECT RAISE(ABORT, '…') WHERE <bad>`; Postgres needs a plpgsql function
-- returning a trigger, with `RAISE EXCEPTION`, attached by CREATE TRIGGER. There
-- is no toolchain that makes these one file — this is what ADR-005 means when it
-- says the dialects differ and the port boundary is the thing that spans them.
--
-- drizzle-kit models no triggers in either dialect, so both are hand-written
-- `generate --custom` migrations.
--
-- WARNING, as in SQLite: any migration that recreates txn, posting, account,
-- commodity or audit_log must re-create these. Postgres keeps triggers across an
-- ALTER, unlike SQLite's table-recreate strategy, so this is less likely here —
-- but a DROP/CREATE still takes them.

CREATE OR REPLACE FUNCTION holiday_txn_seal_requires_balance() RETURNS trigger AS $$
DECLARE
  leg_count integer;
  residual  bigint;
BEGIN
  IF NEW.sealed = 1 AND OLD.sealed = 0 THEN
    SELECT COUNT(*), COALESCE(SUM(weight_minor), 0) INTO leg_count, residual
      FROM posting WHERE txn_id = NEW.id;
    IF leg_count < 2 THEN
      RAISE EXCEPTION 'holiday: transaction has fewer than two postings';
    END IF;
    IF residual <> 0 THEN
      RAISE EXCEPTION 'holiday: unbalanced transaction — postings must sum to exactly zero (residual %)', residual;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER txn_seal_requires_balance
BEFORE UPDATE OF sealed ON txn
FOR EACH ROW EXECUTE FUNCTION holiday_txn_seal_requires_balance();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION holiday_posting_guards() RETURNS trigger AS $$
DECLARE
  acct_commodity text;
  acct_placeholder integer;
  booking text;
  is_sealed integer;
BEGIN
  SELECT commodity, placeholder INTO acct_commodity, acct_placeholder
    FROM account WHERE id = NEW.account_id;

  IF acct_placeholder = 1 THEN
    RAISE EXCEPTION 'holiday: cannot post to a placeholder account';
  END IF;

  -- The most likely real error in the whole system: the vision model reads '$'
  -- as '₩' and posts USD into a KRW-only account. This is where it dies.
  IF acct_commodity IS NOT NULL AND acct_commodity <> NEW.commodity THEN
    RAISE EXCEPTION 'holiday: posting commodity % does not match the account''s declared %',
      NEW.commodity, acct_commodity;
  END IF;

  SELECT booking_commodity, sealed INTO booking, is_sealed FROM txn WHERE id = NEW.txn_id;

  IF NEW.commodity = booking AND NEW.weight_minor <> NEW.units_minor THEN
    RAISE EXCEPTION 'holiday: a posting already in the booking commodity must have weight = units';
  END IF;

  -- The journal is append-only. Once sealed, postings are facts.
  IF is_sealed = 1 THEN
    RAISE EXCEPTION 'holiday: cannot add a posting to a sealed transaction — write a correction instead';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER posting_guards
BEFORE INSERT ON posting
FOR EACH ROW EXECUTE FUNCTION holiday_posting_guards();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION holiday_posting_immutable() RETURNS trigger AS $$
DECLARE
  is_sealed integer;
BEGIN
  SELECT sealed INTO is_sealed FROM txn WHERE id = OLD.txn_id;
  IF is_sealed = 1 THEN
    RAISE EXCEPTION 'holiday: postings of a sealed transaction are immutable — write a correction instead';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER posting_immutable_update
BEFORE UPDATE ON posting
FOR EACH ROW EXECUTE FUNCTION holiday_posting_immutable();
--> statement-breakpoint

CREATE TRIGGER posting_immutable_delete
BEFORE DELETE ON posting
FOR EACH ROW EXECUTE FUNCTION holiday_posting_immutable();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION holiday_txn_never_unseals() RETURNS trigger AS $$
BEGIN
  IF OLD.sealed = 1 AND NEW.sealed = 0 THEN
    RAISE EXCEPTION 'holiday: a sealed transaction cannot be unsealed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER txn_never_unseals
BEFORE UPDATE OF sealed ON txn
FOR EACH ROW EXECUTE FUNCTION holiday_txn_never_unseals();
--> statement-breakpoint

-- An exponent change silently rescales every amount of that commodity.
CREATE OR REPLACE FUNCTION holiday_commodity_exponent_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.exponent <> NEW.exponent AND EXISTS (SELECT 1 FROM posting WHERE commodity = OLD.code) THEN
    RAISE EXCEPTION 'holiday: cannot change the exponent of a commodity that has postings';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER commodity_exponent_immutable
BEFORE UPDATE OF exponent ON commodity
FOR EACH ROW EXECUTE FUNCTION holiday_commodity_exponent_immutable();
--> statement-breakpoint

-- An audit log you can quietly edit is decoration.
CREATE OR REPLACE FUNCTION holiday_audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'holiday: the audit log is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER audit_log_immutable_update
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE FUNCTION holiday_audit_log_append_only();
--> statement-breakpoint

CREATE TRIGGER audit_log_immutable_delete
BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION holiday_audit_log_append_only();
