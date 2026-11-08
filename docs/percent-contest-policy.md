# Percentage cash policy: all-six-percent-v2

$8.25 is the maximum daily payout, reached at 1,000 eligible participants;
it is not a required spend for smaller cohorts. Only accounts completing all
six published daily games qualify. Existing score and tie rules rank them.

Podium prizes remain $2.50, $1.00, $0.50. Compute cumulative percentile
boundaries with ceil(N × boundary), clamped after the podium: 1.5%, 3%, 6%,
10%, 15%, 100%. Each tail participant receives respectively $0.05, $0.04,
$0.03, $0.02, $0.01, $0.001. Empty categories spend nothing. Unspent money is
not moved into other groups. All calculations use integer microdollars.

Examples of eligible finishers and actual total daily payouts:

| Finishers | Actual payouts |
|---:|---:|
| 10 | $4.007 |
| 100 | $4.305 |
| 300 | $5.175 |
| 359 | $5.445 |
| 1,000 | $8.25 |

Above 1,000 finishers, retain the podium and proportionally scale only the
non-podium prizes to a maximum combined $4.25. Largest-remainder rounding
preserves exact totals; rank breaks equal remainders. Everyone has a positive
cash prize within supported monetary precision; unsupported cohort sizes fail
explicitly rather than silently issuing zero prizes.

Today's still-open day and future unsettled day settings select v2. New day
creation selects v2. Already settled days are not recalculated. Version v1
is retained only to preserve any historical allocation semantics; it is not
used for new days. Existing whole-cent balances and prior payouts are not
rescaled. Fractional-credit wallet handling and claim idempotency remain as in
the previous release. Referral shares are additional platform-funded expenses.

At $0.02 modeled income per finisher, 1,000 finishers produce $20 income,
$8.25 cash prizes and $11.75 before other costs; 300 finishers produce $6
income, $5.175 prizes and $0.825 before other costs. These are scenarios, not
measured ad revenue. Coins and other rewards are outside this cash fund.
