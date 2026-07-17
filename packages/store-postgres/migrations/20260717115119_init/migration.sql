CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"type" text NOT NULL,
	"parent_id" text,
	"commodity" text,
	"monetary" integer DEFAULT 1 NOT NULL,
	"cash" integer DEFAULT 0 NOT NULL,
	"placeholder" integer DEFAULT 0 NOT NULL,
	"opened_on" text NOT NULL,
	"closed_on" text,
	CONSTRAINT "account_type_enum" CHECK ("type" IN ('asset','liability','equity','income','expense')),
	CONSTRAINT "account_monetary_bool" CHECK ("monetary" IN (0,1)),
	CONSTRAINT "account_cash_bool" CHECK ("cash" IN (0,1)),
	CONSTRAINT "account_placeholder_bool" CHECK ("placeholder" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" integer PRIMARY KEY,
	"at" text NOT NULL,
	"event" text NOT NULL,
	"subject" text NOT NULL,
	"detail" text DEFAULT '{}' NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "balance_assertion" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"as_of" text NOT NULL,
	"commodity" text NOT NULL,
	"expected_minor" bigint NOT NULL,
	"note" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book" (
	"id" text PRIMARY KEY,
	"schema_version" integer NOT NULL,
	"functional_currency" text NOT NULL,
	"close_grain" text DEFAULT 'month' NOT NULL,
	"timezone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"dedupe_key_version" integer DEFAULT 1 NOT NULL,
	"fx_max_staleness_days" integer DEFAULT 7 NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "book_singleton" CHECK ("id" = 'book'),
	CONSTRAINT "book_close_grain_enum" CHECK ("close_grain" IN ('day','week','month','quarter','year'))
);
--> statement-breakpoint
CREATE TABLE "card" (
	"account_id" text PRIMARY KEY,
	"funding_account_id" text NOT NULL,
	"cycle_close_day" integer NOT NULL,
	"payment_month_offset" integer NOT NULL,
	"payment_day" integer NOT NULL,
	"label" text,
	CONSTRAINT "card_close_day_range" CHECK ("cycle_close_day" BETWEEN 1 AND 31),
	CONSTRAINT "card_offset_range" CHECK ("payment_month_offset" BETWEEN 0 AND 3),
	CONSTRAINT "card_payment_day_range" CHECK ("payment_day" = -1 OR "payment_day" BETWEEN 1 AND 31)
);
--> statement-breakpoint
CREATE TABLE "command_log" (
	"idem_key" text PRIMARY KEY,
	"request_sha256" text NOT NULL,
	"response_json" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodity" (
	"code" text PRIMARY KEY,
	"exponent" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "commodity_exponent_range" CHECK ("exponent" BETWEEN 0 AND 9),
	CONSTRAINT "commodity_kind_enum" CHECK ("kind" IN ('fiat','crypto','security','unit'))
);
--> statement-breakpoint
CREATE TABLE "fx_rate" (
	"id" text PRIMARY KEY,
	"as_of" text NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" text NOT NULL,
	"source" text NOT NULL,
	"fetched_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_batch" (
	"id" text PRIMARY KEY,
	"source_sha256" text NOT NULL UNIQUE,
	"source_name" text,
	"submitted_at" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ingest_batch_count_nonneg" CHECK ("item_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ingest_item" (
	"id" text PRIMARY KEY,
	"batch_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"dedupe_authority" text NOT NULL,
	"external_ref" text,
	"merchant" text,
	"txn_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"parsed_json" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "ingest_item_status_enum" CHECK ("status" IN ('pending','accepted','rejected')),
	CONSTRAINT "ingest_item_authority_enum" CHECK ("dedupe_authority" IN ('image','external_ref','natural'))
);
--> statement-breakpoint
CREATE TABLE "installment" (
	"id" text PRIMARY KEY,
	"card_account_id" text NOT NULL,
	"liability_account_id" text NOT NULL,
	"txn_id" text,
	"purchased_on" text NOT NULL,
	"months" integer NOT NULL,
	"total_minor" bigint NOT NULL,
	"commodity" text NOT NULL,
	"interest_free" integer DEFAULT 1 NOT NULL,
	"label" text,
	CONSTRAINT "installment_months_positive" CHECK ("months" >= 1),
	CONSTRAINT "installment_total_positive" CHECK ("total_minor" > 0),
	CONSTRAINT "installment_accounts_differ" CHECK ("card_account_id" <> "liability_account_id"),
	CONSTRAINT "installment_interest_free_bool" CHECK ("interest_free" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "installment_row" (
	"installment_id" text,
	"seq" integer,
	"payment_date" text NOT NULL,
	"principal_minor" bigint NOT NULL,
	"fee_minor" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "installment_row_pkey" PRIMARY KEY("installment_id","seq"),
	CONSTRAINT "installment_row_seq_positive" CHECK ("seq" >= 1)
);
--> statement-breakpoint
CREATE TABLE "loan" (
	"account_id" text PRIMARY KEY,
	"funding_account_id" text NOT NULL,
	"interest_account_id" text NOT NULL,
	"principal_minor" bigint NOT NULL,
	"commodity" text NOT NULL,
	"annual_rate_text" text NOT NULL,
	"method" text NOT NULL,
	"term_months" integer NOT NULL,
	"first_payment_date" text NOT NULL,
	"payment_day" integer NOT NULL,
	"label" text,
	CONSTRAINT "loan_principal_positive" CHECK ("principal_minor" > 0),
	CONSTRAINT "loan_term_positive" CHECK ("term_months" >= 1),
	CONSTRAINT "loan_method_enum" CHECK ("method" IN ('annuity','equal_principal','bullet','interest_only')),
	CONSTRAINT "loan_payment_day_range" CHECK ("payment_day" = -1 OR "payment_day" BETWEEN 1 AND 31),
	CONSTRAINT "loan_accounts_differ" CHECK ("account_id" <> "funding_account_id")
);
--> statement-breakpoint
CREATE TABLE "loan_schedule_row" (
	"loan_id" text,
	"seq" integer,
	"due_date" text NOT NULL,
	"opening_minor" bigint NOT NULL,
	"principal_minor" bigint NOT NULL,
	"interest_minor" bigint NOT NULL,
	"closing_minor" bigint NOT NULL,
	CONSTRAINT "loan_schedule_row_pkey" PRIMARY KEY("loan_id","seq"),
	CONSTRAINT "loan_schedule_seq_positive" CHECK ("seq" >= 1)
);
--> statement-breakpoint
CREATE TABLE "period" (
	"id" text PRIMARY KEY,
	"grain" text NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "period_grain_enum" CHECK ("grain" IN ('day','week','month','quarter','year')),
	CONSTRAINT "period_status_enum" CHECK ("status" IN ('open','closed','locked'))
);
--> statement-breakpoint
CREATE TABLE "posting" (
	"txn_id" text,
	"seq" integer,
	"account_id" text NOT NULL,
	"units_minor" bigint NOT NULL,
	"commodity" text NOT NULL,
	"weight_minor" bigint NOT NULL,
	"weight_source" text NOT NULL,
	"fx_rate_text" text,
	"fx_rate_id" text,
	"lot_id" text,
	"kind" text DEFAULT 'normal' NOT NULL,
	"memo" text,
	CONSTRAINT "posting_pkey" PRIMARY KEY("txn_id","seq"),
	CONSTRAINT "posting_weight_source_enum" CHECK ("weight_source" IN ('identity','actual','rate','plug')),
	CONSTRAINT "posting_kind_enum" CHECK ("kind" IN ('normal','fx_revaluation','rounding'))
);
--> statement-breakpoint
CREATE TABLE "recurring" (
	"id" text PRIMARY KEY,
	"label" text NOT NULL,
	"expense_account_id" text NOT NULL,
	"funding_account_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"commodity" text NOT NULL,
	"cadence_kind" text NOT NULL,
	"day_of_month" integer NOT NULL,
	"month" integer,
	"active_from" text NOT NULL,
	"active_to" text,
	CONSTRAINT "recurring_amount_positive" CHECK ("amount_minor" > 0),
	CONSTRAINT "recurring_cadence_enum" CHECK ("cadence_kind" IN ('monthly','yearly')),
	CONSTRAINT "recurring_day_range" CHECK ("day_of_month" = -1 OR "day_of_month" BETWEEN 1 AND 31),
	CONSTRAINT "recurring_month_range" CHECK ("month" IS NULL OR "month" BETWEEN 1 AND 12),
	CONSTRAINT "recurring_yearly_needs_month" CHECK ("cadence_kind" <> 'yearly' OR "month" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "snapshot" (
	"id" text PRIMARY KEY,
	"period_id" text NOT NULL,
	"kind" text NOT NULL,
	"as_of" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "snapshot_kind_enum" CHECK ("kind" IN ('close','checkpoint'))
);
--> statement-breakpoint
CREATE TABLE "snapshot_balance" (
	"snapshot_id" text,
	"account_id" text,
	"commodity" text,
	"units_minor" bigint NOT NULL,
	"weight_minor" bigint NOT NULL,
	"period_units_minor" bigint DEFAULT 0 NOT NULL,
	"period_weight_minor" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "snapshot_balance_pkey" PRIMARY KEY("snapshot_id","account_id","commodity")
);
--> statement-breakpoint
CREATE TABLE "txn" (
	"id" text PRIMARY KEY,
	"date" text NOT NULL,
	"booking_commodity" text NOT NULL,
	"payee" text,
	"narration" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"system_kind" text,
	"corrects_txn_id" text,
	"source_item_id" text,
	"fx_estimated" integer DEFAULT 0 NOT NULL,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"meta_json" text DEFAULT '{}' NOT NULL,
	"sealed" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"created_at" text NOT NULL,
	CONSTRAINT "txn_status_enum" CHECK ("status" IN ('draft','posted','void','rejected')),
	CONSTRAINT "txn_system_kind_enum" CHECK ("system_kind" IS NULL OR "system_kind" IN ('fx_revaluation','closing_entry','opening_balance')),
	CONSTRAINT "txn_fx_estimated_bool" CHECK ("fx_estimated" IN (0,1)),
	CONSTRAINT "txn_sealed_bool" CHECK ("sealed" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX "account_by_code" ON "account" ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_assertion_unique" ON "balance_assertion" ("account_id","as_of","commodity");--> statement-breakpoint
CREATE INDEX "balance_assertion_by_date" ON "balance_assertion" ("as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rate_unique" ON "fx_rate" ("as_of","base","quote","source");--> statement-breakpoint
CREATE INDEX "ingest_item_by_dedupe" ON "ingest_item" ("dedupe_key");--> statement-breakpoint
CREATE INDEX "ingest_item_by_batch" ON "ingest_item" ("batch_id");--> statement-breakpoint
CREATE INDEX "installment_by_card" ON "installment" ("card_account_id");--> statement-breakpoint
CREATE INDEX "installment_row_by_date" ON "installment_row" ("payment_date");--> statement-breakpoint
CREATE INDEX "loan_schedule_by_date" ON "loan_schedule_row" ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "period_grain_start" ON "period" ("grain","start");--> statement-breakpoint
CREATE INDEX "posting_by_account" ON "posting" ("account_id");--> statement-breakpoint
CREATE INDEX "recurring_by_funding" ON "recurring" ("funding_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_unique" ON "snapshot" ("period_id","kind");--> statement-breakpoint
CREATE INDEX "txn_by_date" ON "txn" ("date","id");--> statement-breakpoint
CREATE INDEX "txn_by_status" ON "txn" ("status");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "balance_assertion" ADD CONSTRAINT "balance_assertion_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "balance_assertion" ADD CONSTRAINT "balance_assertion_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "book" ADD CONSTRAINT "book_functional_currency_commodity_code_fkey" FOREIGN KEY ("functional_currency") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_funding_account_id_account_id_fkey" FOREIGN KEY ("funding_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "fx_rate" ADD CONSTRAINT "fx_rate_base_commodity_code_fkey" FOREIGN KEY ("base") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "fx_rate" ADD CONSTRAINT "fx_rate_quote_commodity_code_fkey" FOREIGN KEY ("quote") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "ingest_item" ADD CONSTRAINT "ingest_item_batch_id_ingest_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ingest_batch"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ingest_item" ADD CONSTRAINT "ingest_item_txn_id_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "txn"("id");--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_card_account_id_account_id_fkey" FOREIGN KEY ("card_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_liability_account_id_account_id_fkey" FOREIGN KEY ("liability_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_txn_id_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "txn"("id");--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "installment_row" ADD CONSTRAINT "installment_row_installment_id_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installment"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_funding_account_id_account_id_fkey" FOREIGN KEY ("funding_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_interest_account_id_account_id_fkey" FOREIGN KEY ("interest_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "loan_schedule_row" ADD CONSTRAINT "loan_schedule_row_loan_id_loan_account_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loan"("account_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posting" ADD CONSTRAINT "posting_txn_id_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "txn"("id");--> statement-breakpoint
ALTER TABLE "posting" ADD CONSTRAINT "posting_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "posting" ADD CONSTRAINT "posting_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_expense_account_id_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_funding_account_id_account_id_fkey" FOREIGN KEY ("funding_account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_period_id_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "period"("id");--> statement-breakpoint
ALTER TABLE "snapshot_balance" ADD CONSTRAINT "snapshot_balance_snapshot_id_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "snapshot"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "snapshot_balance" ADD CONSTRAINT "snapshot_balance_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id");--> statement-breakpoint
ALTER TABLE "snapshot_balance" ADD CONSTRAINT "snapshot_balance_commodity_commodity_code_fkey" FOREIGN KEY ("commodity") REFERENCES "commodity"("code");--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_booking_commodity_commodity_code_fkey" FOREIGN KEY ("booking_commodity") REFERENCES "commodity"("code");