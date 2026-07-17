---
name: holiday-cfo
description: Record and query a personal double-entry ledger — 가계부, 카드 거래, 부채, 할부, 정기지출, 현금흐름 예측. Use when the user wants to record spending or income, asks what they owe or own, asks whether their cash will survive upcoming card bills (현금흐름), sets up a card/할부/정기지출, or closes their books. Also use when the user shares a screenshot of a bank or card transaction and wants it recorded. Do NOT use for general financial advice or investment questions.
---

# holiday — a double-entry ledger you drive from chat

`holiday` is a CLI. You run it; it owns the accounting. Every command takes
`--json` for machine-readable output on stdout, and errors always come back as a
single JSON envelope on stderr: `{"error":{"code":"...","message":"..."}}`.

Run `holiday --help` or `holiday <command> --help` for exact flags.

## The rules you must not break

**Never invent an amount, a date, or an account.** If a receipt is blurry or the
user is vague, ask. This is the user's money, and you are the least reliable
component in the system — everything downstream assumes you read `₩1,240,000`
and not `₩1,240,00`.

**Every transaction must balance to exactly zero.** There is no tolerance. If
`holiday txn add` refuses with `unbalanced`, it will tell you the exact residual;
do not "fix" it by nudging a number. Find the missing leg — a fee, a discount, a
rounding line — or ask.

**Never guess an account.** Run `holiday account list` and use what exists. If the
right account is missing, propose creating it and say what you'd call it.

**Show your work before you write.** For anything non-obvious, state the double
entry you're about to post in plain language and let the user confirm.

## Getting oriented

```bash
holiday account list          # what accounts exist
holiday balance               # what is owned and owed right now
holiday balance --account Liabilities
holiday verify                # is the ledger sound and the audit chain intact
```

If a command reports `no .holiday/ found`, the user has no ledger here yet.
`holiday init --currency KRW` creates one — but ask first, and tell them the
directory must be a **private** repository.

## From a screenshot

There is a review gate now: what you submit lands as a **draft**, excluded from
every balance until a human accepts it.

```bash
holiday ingest submit --idem-key K1 --data '{
  "items": [{
    "date": "2026-07-17",
    "payee": "이마트",
    "externalRef": "TX-99",
    "legs": [
      {"account": "Expenses:Food:Groceries", "amount": "42000", "commodity": "KRW"},
      {"account": "Liabilities:Card:Shinhan", "amount": "-42000", "commodity": "KRW"}
    ]
  }]
}'
holiday review list            # show the human what you propose
holiday review accept <id>     # after they confirm
holiday review reject <id> --reason "..."
```

Pass `--idem-key` on every submit. If the call times out and you retry with the
same key, it replays instead of posting twice.

Read `externalRef` off the screenshot whenever the issuer prints a transaction
id — it is the only thing that can tell two identical purchases apart, and it
turns duplicate detection from a guess into a fact.

The draft still has to balance: an unbalanced submission is refused outright, so
you cannot park a broken entry in the queue for someone else to fix.

**The gate is not permission to guess.** It catches a wrong category, not a
misread amount — a human confirming `₩1,240,00` will confirm it wrong. Stop and
ask when the amount is unclear.

## Recording a transaction directly

Legs are `ACCOUNT AMOUNT COMMODITY`, repeated, summing to zero:

```bash
holiday txn add --date 2026-07-17 --payee "이마트" \
  --leg "Expenses:Food:Groceries 42000 KRW" \
  --leg "Liabilities:Card:Shinhan -42000 KRW"
```

A card purchase credits the **card**, not cash — no money moves yet. Paying the
card bill is a separate transaction, later. That gap is the whole point of the
tool; see `references/ledger-model.md`.

## Foreign currency

A non-KRW leg needs its KRW value. Two ways, and they are not equal:

```bash
# both sides observed — the rate is a FACT
--leg "Assets:Bank:Wise:USD 750.00 USD @@ 1000000"

# only one side observed — derived from the rate table, marked fx_estimated
holiday fx add USD KRW 1333.33 --as-of 2026-07-17
holiday txn add --leg "Expenses:Food:Dining 12.50 USD" --leg "Liabilities:Card:Shinhan -12.50 USD"
```

Prefer `@@` whenever the statement shows the KRW amount. A derived weight is
provisional; an observed one is not.

`holiday fx show USD KRW` says which rate would be used and why — exact, stale,
inverted, or triangulated. If it says stale, the user should know.

**A rate never changes a posted number.** Weights are stored as facts, so adding
or correcting a rate only affects future derivations and revaluation. Say so if
the user worries about it.

## 마감

```bash
holiday assert Assets:Bank:KB:Checking 4310000 --as-of 2026-07-31
holiday close 2026-07 --dry-run
holiday close 2026-07
```

**Assertions are the only check that compares the ledger to the outside world.**
Everything else here guards structure — none of it can tell that you read
₩1,240,00 instead of ₩1,240,000. When the user has a statement in front of them,
assert the balance. That is the whole defense against your own misreading.

`close` refuses over unresolved drafts or a failing assertion, and reports every
reason at once. Both refusals are the point, not obstacles — a month with an
unreviewed screenshot is frozen, not closed.

Closing posts an FX revaluation for foreign monetary accounts. It needs a rate at
the month end and an `Income:FX:Unrealized` account.

## Answering "현금흐름 괜찮아?"

```bash
holiday cashflow --until 2026-12-31
```

This is usually the real question behind "how am I doing". It walks forward from
today's cash and subtracts every card bill, 할부 row, and 정기지출 that is
already coming, and flags the day the balance goes negative. Read the ⚠ line out
loud — that is the answer.

## Load these when you need them

Do not read these upfront. Read the one that matches the task.

| File | Read it when |
|---|---|
| `references/ledger-model.md` | The user asks *why* a number is what it is; you need to explain units vs weight, the no-tolerance rule, or foreign currency. |
| `references/accounts.md` | Creating accounts, or unsure how to name or categorise one. |
| `references/schedules.md` | Setting up a card billing cycle, a 할부, or a 정기지출 — and the traps in each. |
| `references/recipes.md` | Recording from a screenshot, FX purchases, refunds, corrections. |

## What this cannot do yet

Say so plainly rather than improvising:

- **No OCR.** You are the parser. `holiday ingest submit` takes what you read;
  it never looks at the image except to hash it.
- **No auto-accept.** Every draft needs a human. There is no rule engine yet.
- **할부수수료 is not computed.** Read the per-row fees off the statement and pass
  `--fees`; issuer formulas differ and a plausible wrong number would corrupt the
  cash flow projection.
- **No auto-fetched rates.** `holiday fx add` takes a rate you supply; nothing
  calls an API. A missing rate throws rather than guessing.
- **No Supabase adapter and no dashboard.** SQLite only, local only.
