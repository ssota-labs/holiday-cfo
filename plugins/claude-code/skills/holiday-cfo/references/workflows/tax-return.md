# 세금 신고서 SoR (종합소득·부가세)

홈택스·신고서 PDF에 찍힌 숫자를 장부에 **사실로** 남길 때 읽는다.
세액·공제 공식을 추정하지 않는다 (ADR-010). 통장 납부 전표·수입 정산과
질문이 다르다.

## 언제

- “올해 종합소득 과세표준·납부할세액이 얼마였지?”
- “1기 확정 부가세 매출·매입세액이?”
- 수정신고 이력을 남길 때

## 하지 말 것

- 세율표를 적용해 산출세액을 만들지 않는다 — 신고서 칸을 그대로 옮긴다.
- `tax return add`만으로 세금 전표를 만들지 않는다. 실제 납부는 기존처럼
  `Expenses:Tax:*` 전표.
- 수입 정산의 `business_vat` 라인과 섞지 않는다 — 그쪽은 회차 입금 명세다.

## 명령

```bash
# 종합소득세 (period 생략 → annual)
holiday tax return add --year 2025 --filed-on 2026-06-22 \
  --data-file filing.json --json

# 부가세 1기 확정
holiday tax return add --form kr_vat --year 2025 --period H1_final \
  --filed-on 2025-07-25 --data-file vat-h1.json --json

holiday tax return list --json
holiday tax return show 2025 --json
holiday tax return show 2025 --form kr_vat --period H1_final --json

# 수정신고 — 새 차수, 이전은 대체됨
holiday tax return add --year 2025 --filed-on 2026-07-01 \
  --data-file filing-v2.json --amend --json
```

`--data-file` 금액·세율은 **소수 문자열**. `number` 금지.
키 레지스트리·필수 칸은 CLI 스펙 `tax return add`를 본다.

| `--form` | `--period` |
|---|---|
| `kr_global_income` (기본) | 생략 시 `annual` |
| `kr_vat` | **필수** — `H1_provisional` · `H1_final` · `H2_provisional` · `H2_final` |
