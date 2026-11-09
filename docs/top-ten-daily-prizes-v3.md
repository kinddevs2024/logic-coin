# Daily prizes: fixed top ten and variable tail

Policy: `all-six-percent-v3`. Eligible participants must complete all six games
published for that challenge day. Ranking and ties follow the existing coin,
finish-time and user-ID ordering. Incomplete participants remain visible with no
cash prize. Previously settled days keep their saved allocation and policy.

## Reference allocation: 1,500 eligible participants

| Rank or percentile | People | Prize per person, USD | Group total, USD |
| --- | ---: | ---: | ---: |
| 1 | 1 | 2.50 | 2.50 |
| 2 | 1 | 1.00 | 1.00 |
| 3 | 1 | 0.50 | 0.50 |
| 4 | 1 | 0.45 | 0.45 |
| 5 | 1 | 0.40 | 0.40 |
| 6 | 1 | 0.35 | 0.35 |
| 7 | 1 | 0.30 | 0.30 |
| 8 | 1 | 0.25 | 0.25 |
| 9 | 1 | 0.20 | 0.20 |
| 10 | 1 | 0.15 | 0.15 |
| Remaining top 3%: 11–45 | 35 | 0.01 | 0.35 |
| 3–6%: 46–90 | 45 | 0.0035 | 0.1575 |
| 6–10%: 91–150 | 60 | 0.002 | 0.12 |
| 10–15%: 151–225 | 75 | 0.0016 | 0.12 |
| Last 85%: 226–1500 | 1,275 | 0.001 + variable bonus | 1.4025 |
| **Total** | **1,500** | | **8.25** |

The top ten total $6.10. Percentile boundaries use `ceil(N * percentage)` and
never precede the fixed top ten. Fewer than ten eligible users receive only the
corresponding fixed prizes. No prizes are invented for absent ranks. With fewer
than 1,500 participants, unused money stays unallocated: for example, 300 eligible
users cost $6.4565 and 1,000 cost $7.50.

For more than 1,500 participants, the top ten stay fixed, and combined prizes
after tenth place are capped at $2.15. Reserve one microdollar per participant,
scale the remaining weights, and allocate integer remainders by largest fraction
(user ID breaks ties). This gives exact totals and positive awards. Participant
counts exceeding available microdollars fail explicitly instead of generating
zero prizes or exceeding the budget.

## Variable bonuses and finalization

Persist a private 256-bit random seed once per challenge. HMAC-SHA256 draws bind
that seed to the sorted IDs in the tail. Shuffle the tail and assign variable
bonuses, budgeting exactly 100 microdollars extra per tail participant on average.
Blocks of six share 600 microdollars, with one random part and five positive
random parts; a remaining shorter block shares `count * 100` microdollars. Each
tail award is between $0.001001 and $0.001595 before any over-cap scaling.
Amounts genuinely vary at microdollar precision; they are not display padding.

Repeated reads and database ordering cannot change the draw. Score reordering
within the same tail membership cannot change a user's bonus. If the eligible
tail membership changes before day close, provisional bonuses can change. The
existing settlement transaction saves final per-user amounts; claims read those
saved results and retain existing idempotency and ledger protections.

All money calculations use integer USD microdollars. The API's existing unit is
one cent; divide microdollars by 10,000 for API values. Wallet credits keep four
fractional cent digits; the ledger records exact integer microdollars. Seed
values are internal and excluded from public and administrator response shapes.
