# Daily cash policy: all-six-percent-v1

Activated for 2026-11-08 and subsequent unsettled daily challenges. Earlier
settled results and already credited balances keep their original allocations.

Only accounts with completed, server-confirmed attempts for all six currently
published game IDs qualify. Practice/ad-only accounts and partial completions
are excluded. Existing coin ranking and tie breaks determine the order among
eligible accounts. Every eligible account receives cash; the alternative
case/random/consolation cash bands are replaced for this policy.

The prize pool is $8.25. Podium: $2.50, $1.00, $0.50. Cumulative percentile
boundaries, rounded up and clamped after the podium, are 1.5%, 3%, 6%, 10%,
15%, 100%. Corresponding tail group budgets are $0.60, $0.60, $0.90, $0.80,
$0.50, $0.85. With 1,000 eligible accounts this yields 12×$0.05, 15×$0.04,
30×$0.03, 40×$0.02, 50×$0.01, 850×$0.001 after the podium.

For other cohort sizes each group shares its fixed budget equally, with
integer-microdollar remainder going to higher ranks. Empty-group budgets move
to the first populated tail group. Adjacent groups are pooled only if rounding
or a small cohort would make a lower rank earn more. Tail prizes are capped
at $0.50; excess moves downwards. With fewer than 12 finishers there can be an
unspent balance because fixed podium and the tail cap take precedence over
spending the full pool. With no finishers the payout is zero.

Planning, totals and new cash ledger audit fields use integer microdollars
($0.000001). Existing API/wallet units remain cents, now permitting fractional
cents. Fractional contest credits round the wallet's updated monetary fields
atomically to four decimal places of a cent inside the claim transaction.
History and balances display fractional amounts up to six USD decimal places;
whole-cent amounts retain the old two-place display. Withdrawals still require
whole cents. Existing claim locks, transactions and unique ledger keys retain
idempotency. Referral shares remain additional, separately funded whole-cent
credits under the existing 15%/5% rules.

No historical balances are multiplied or migrated. The day's policy marker
selects the new algorithm; days without it keep legacy behavior. Automatic
publication and new administrative day creation set the new policy and $8.25
pool. Manual overrides are blocked for this policy. Deployment backs up the
current/future day documents and activates only unsettled/unlocked days.

A fixed precision has a finite maximum supported cohort size. The planner
rejects unsupported sizes rather than silently paying zero to some finishers.
