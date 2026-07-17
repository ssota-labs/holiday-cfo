# Workflows

The recurring shapes of using holiday. Each one wires existing CLI commands into a
routine — there is no `setup` or `weekly` command, and there should
not be. You drive the sequence; the CLI owns the accounting.

**Record directly. Do not gate everything behind review.** The review queue exists
for when you are genuinely unsure, not as a default. Most transactions go straight
in with `holiday txn add` — if one is wrong, fix it (see "Fixing a mistake" below).
Making the user approve every coffee is friction they asked not to have.

---

## Setup — the first session

The goal is a ledger that reflects reality now, then as much history as is worth
entering.

1. **Create it.** `holiday init --currency KRW` (ask the currency).
2. **Accounts.** Banks, cards, cash, income, the debts. Mark spendable accounts
   `--cash`. Set card billing cycles with `holiday card add`, 할부 and 정기지출,
   loans. See `accounts.md` and `schedules.md`.
3. **Opening balances.** For each asset/liability that already has a balance, post
   it against `Equity:Opening` dated the start point:
   `holiday txn add --date 2026-01-01 --leg "Assets:Bank:Shinhan 4310000 KRW" --leg "Equity:Opening -4310000 KRW"`.
4. **History, if they have a file.** This is where you earn your keep — see below.
5. **Confirm.** `holiday balance`, then `holiday assert` each account against what
   the user can see in their banking app. Assertions are the only check against the
   outside world; use them.
6. **Offer automation.** Once the ledger is real, ask about scheduling the daily /
   weekly / monthly workflows — `automation.md`.

### Importing a CSV or Excel export — you are the importer

There is no `import` command, on purpose. Every bank's export is shaped
differently, and a rigid parser would fight that. You are a better importer than a
fixed schema: **read the file, work out what its columns mean, and write a small
script that calls `holiday txn add` once per row.** That is the whole reason this
is an agent task and not a CLI flag.

- Read the file. Figure out which column is the date, which is the amount, which is
  the description, and the sign convention (is a debit negative, or in a separate
  column?).
- Map each row to a double entry. The money leg is the bank or card; the other leg
  is a category (`Expenses:...`) or income. Ask the user how to categorise the ones
  you cannot infer, or bucket them into `Expenses:Uncategorized` and tell them.
- Write and run a script that emits one `holiday txn add` per row, dated from the
  file. For hundreds of rows, a loop is fine; you do not need the review queue.
- Then `holiday verify` and `holiday balance`, and `assert` the closing balance
  against the statement so a mis-parsed sign shows up immediately.

Never invent an amount or a date to make a row balance. If a row is ambiguous, ask.

---

## Daily — record and look one day ahead

Fired each morning by the scheduler, or run on demand.

1. **Ask for yesterday.** "어제 쓴 거 있어요?" Take screenshots, a bank export, or
   just what they tell you.
2. **Record it,** straight in with `holiday txn add`. No review gate.
3. **Look ahead.** `holiday cashflow` — read the ⚠ line if there is one. That is
   the answer to "am I okay for tomorrow".
4. **Re-bake the dashboard** if they keep one: `holiday dash data`.

---

## Weekly — Sunday review

A wider look than the daily.

1. **Position.** `holiday balance` for assets, `holiday balance --account Liabilities`
   for what is owed. Read the net.
2. **Next week's cash flow.** `holiday cashflow --until <next Sunday>` — the card
   bills, 할부, 정기지출 and loan payments landing in the next seven days.
3. **This week in review.** What went out, against what came in. Flag anything
   unusual — a category that jumped, a bill larger than last month.
4. If a big decision is coming, this is a natural place to run a **simulation**
   (below).

---

## Monthly — close the books

1. **Assert.** `holiday assert <account> <balance> --as-of <month-end>` for every
   account the user has a statement for. This is the real reconciliation.
2. **Dry run.** `holiday close <month> --dry-run`. It refuses over unresolved
   drafts or a failing assertion, and lists every reason at once. The refusal is
   the point — a month with a wrong balance is not closed, it is frozen.
3. **Close.** `holiday close <month>`. Posts FX revaluation for foreign monetary
   accounts, snapshots balances, and locks the journal for that month.
4. **Report.** Net worth change, biggest movements, how the month compared.

---

## Simulate — what if

For "이 대출 받으면?", "집 사면?", "이 카드 다음 달에 다 갚으면?" — anything that is
not in the ledger yet.

Do NOT write speculative transactions and delete them. `holiday cashflow` takes the
hypotheticals directly and folds them into the runway, touching nothing:

```bash
holiday cashflow --until 2027-06-30 \
  --spend "2026-09-01 5000000 새 노트북" \
  --receive "2026-12-25 3000000 보너스" \
  --spend "2027-03-01 30000000 전세보증금"
```

`--spend` is money leaving, `--receive` is money arriving — no sign to guess. Both
repeat, so stack several and watch them interact. Each shows up as `가정: <label>`,
and the base ledger is untouched: re-run plain `holiday cashflow` to confirm.

For a recurring commitment (a new loan, a new 정기지출), model the first few months
with several `--spend` lines rather than one, so the user sees the monthly bite.

---

## Ask — questions about the money

Debt payoff order, where the money goes, whether a purchase fits — answer from the
ledger: `holiday balance`, `holiday loan list`, `holiday cashflow`, a simulation.

Two boundaries. **Compute, don't advise on markets:** "which debt to clear first"
is arithmetic on the ledger and fair game; "what should I invest in" is licensed
advice this tool does not give — say so. And **never state a figure you did not get
from the CLI.** If you are not sure, run the command.

---

## Fixing a mistake

The journal is append-only, so you never edit a past entry — you `holiday txn add`
a correcting one. A wrong amount: post the difference. A transaction that should not
exist: post its exact opposite (a reversal), then the right one if there is one.
Before a month is closed its entries are still live; after close they are locked and
a correction dated today is the only way. This is why recording directly is safe —
a mistake is one more entry, not a lost afternoon.
