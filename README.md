# holiday

1인용 복식부기 원장. 가계부·부채·자산·현금흐름을 CLI와 에이전트로 관리한다.

에이전트가 캡쳐를 읽고 CLI를 호출하면, CLI가 복식부기 불변식·통화·스케줄을 강제한다.
캡쳐 인제스트는 draft로 들어가며, 사람이 `review accept`하기 전까지 잔액에 포함되지
않는다.

> **경고:** v0.1. 원장 포맷은 아직 장기 약속이 아니다. 쓰기 전에
> [아직 없는 것](#아직-없는-것)을 확인한다.

## 왜

가계부 앱은 대개 단식부기 + 카테고리다. 그 경우:

1. **신용카드 간극** — 결제일과 현금 인출일이 다르다. `holiday cashflow`가 청구·할부·
   정기지출·대출을 투영하고 `⚠ SHORT`로 부족 시점을 표시한다.
2. **다통화** — 환율 되곱은 정수에서 손실을 내고 허용오차를 부른다. posting마다
   `units`(사실)와 `weight`(기능통화 측정)를 저장하고, 불변식은
   `SUM(weight) = 0`(허용오차 없음)이다.

## 설치

```bash
/plugin marketplace add ssota-labs/holiday
/plugin install holiday@ssota-labs
```

Node 24+ 필요. `node:sqlite` builtin으로 단일파일 번들 (`plugin/bin/holiday.mjs`).

## 시작

```bash
holiday init --currency KRW
holiday account add Assets:Bank:KB:Checking --commodity KRW --cash
holiday account add Liabilities:Card:Shinhan --commodity KRW
holiday card add Liabilities:Card:Shinhan --funding Assets:Bank:KB:Checking \
  --close-day 14 --payment-day 1 --label "신한"

holiday txn add --date 2026-07-17 --payee "이마트" \
  --leg "Expenses:Food:Groceries 42000 KRW" \
  --leg "Liabilities:Card:Shinhan -42000 KRW"

holiday cashflow
```

디렉터리는 **private** 레포여야 한다. `.holiday/ledger.db`가 원장이다.

## 설계 요지

| | |
|---|---|
| 상대금액(weight)으로 균형 | 환율 되곱으로 맞추지 않음 |
| 금액 i64 minor | `number`는 2^53까지만 정확 |
| 스케줄은 원장 밖 | 카드·할부·정기지출·대출은 예측 |
| CLI SoR = SQLite | 감사는 `audit_log` 해시 체인 |
| 엔진 티어 계약 | 원자성·유니크·read-after-write 없으면 `init()` throw |

문서: [apps/docs](https://github.com/ssota-labs/holiday/tree/main/apps/docs).

## 구조

```
packages/core/           도메인 + 포트
packages/store-sql/      LedgerStore 구현 (공유)
packages/store-sqlite/   SQLite 드라이버·스키마·마이그레이션
packages/store-postgres/ Postgres 드라이버·스키마 (라이브러리/pglite 테스트)
packages/store-testkit/  적합성 스위트
packages/cli/            composition root (제품 경로는 sqlite)
apps/docs/               Fumadocs
plugin/                  Claude Code 플러그인 (bin/holiday.mjs)
```

```bash
pnpm install && pnpm -r run build && pnpm -r run test
```

## 아직 없는 것

- **OCR 없음.** `ingest submit`은 모델이 읽은 legs를 받는다. 이미지는 해시용.
- **자동 승인 없음.** draft는 `review accept` 필요.
- **할부수수료 공식 없음.** 명세서 값을 `--fees`로 넣는다.
- **환율 API 자동 조회 없음.** `fx add` 수동. 대시보드 없음.
- **제품 CLI는 SQLite만.** `store-postgres`는 라이브러리/테스트(pglite)용.
- **18자리 ERC-20은 표현 불가.** i64. ETH는 8자리 절사.

존재하는 것: `ingest` / `review` / `fx` / `assert` / `close` / `loan`.

## 라이선스

MIT
