# Hangman production release — 2026-10-28

Published backend integration, website and signed OTA for all 11 registered Android runtime/channel combinations. Final release marker: `20261028-hangman-scoring`.

Server: `173.212.216.216`. Release reports and rollback pointers: `/srv/apps/logic-coin/diagnostics/hangman-results-20261028` and `/srv/apps/logic-coin/backups/hangman-results-20261028`. Initial backend backup: `/srv/apps/logic-coin/backups/hangman-20261028`.

Verified authenticated live gift flow, one-time three starter hints, ownership and single-use checks, practice wallet isolation, maximum base reward of 1000 and eligibility for a separate fortune bonus. Existing daily challenge schedules were preserved.

Public website browser runs completed three words in Russian, Uzbek and English, showing the host result of 1000 without runtime errors. Fixed an unstable initial progress snapshot and handled interrupted browser audio playback. Frontend typecheck and ten targeted tests passed.

All 11 OTA signatures and 170 unique public asset URLs passed verification. Native installation, upgrade and startup workflow succeeded: https://github.com/kinddevs2024/logic-coin/actions/runs/40733978000 . This checks application startup, not physical-device gameplay for every runtime. Old APKs without ExpoAudio use a silent adapter; a native rebuild is required to enable sound there.

Installed APKs download the update at launch; close and reopen after downloading to apply it. No reinstall is required for the registered supported runtimes. Temporary public QA pages were removed. Source for future mobile builds is selected by `/srv/apps/logic-coin/mobile-current`; its previous target is recorded with the final release reports.


Result-menu update: the completed three-word result and fortune use the existing pause menu's graph-paper texture, handwritten type and black borders. The host no longer overlays a second generic result on the game's own completion panel. Separate rows show base reward (up to 1000), fortune and total. Fortune remains tied to one completed attempt and a verified rewarded ad; it is additional to the base reward.

Verified updated UI with a simulated challenge result/fortune flow in ru/en/uz and verified real guest practice completion on the production site in all three languages. Isolated authenticated HTTP tests confirmed that an unverified fortune claim is rejected, a verified bonus is credited above 1000 exactly once, repeat claims do not credit, and the attempt's base stays 1000. Live API verification confirmed fortune eligibility without fabricating ad verification or crediting a production wallet. All 11 signed OTA configurations (versions 1.3.0–1.3.5) and 170 unique assets passed again. Native game interaction and actual ad playback on physical phones were not exercised by these browser checks.


Scoring update (`20261028-hangman-scoring`): wrong letters now cost 50 coins instead of 3. Solved word budgets remain 333/333/334; lost words add zero. Once all three words have ended, a 100-coin minimum applies; an unfinished run gets no minimum. Perfect play earns 1000. Fortune remains separate and additional. The backend also clamps the completed base result to 100–1000. An all-lost run earns 100 without being recorded as a gameplay win.

Validation: frontend typecheck/build and 11 scoped frontend tests passed; backend build and five scoped range/fortune tests passed; isolated authenticated HTTP checks and live HTTPS checks confirmed both limits and fortune eligibility. Two old contest-test expectations disagree with existing live non-Hangman scoring/gift rotation; unrelated production behavior was preserved. All 11 signed OTA configurations and 170 unique assets were verified.
