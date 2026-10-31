# Referral invitation language fix (2026-10-31)

Invitation messages use explicit ru/en/uz copy selected from the current app language. Clipboard fallback includes the invitation text and URL, not just a bare link. QR and shared URLs include lang and preview=3 so newly shared invitations avoid previously cached previews.

The public preview route now formats the inviter's localized title directly from its translation key and preserves lang in og:url and canonical URLs. Most importantly, both production Nginx invite/profile proxy locations used variable proxy_pass URLs that discarded original query arguments. Appended $is_args$args to those exact directives in logic-independent.conf and apps.conf. nginx -t passed before reload. Other location directives were preserved.

Validation: five frontend tests cover native sharing for all three languages, browser sharing after a language switch and Uzbek clipboard fallback. Three backend tests cover localized inviter titles, image language, canonical URLs and referral attribution, with/without preview. Backend TypeScript build passed. Public metadata checks verify the three languages on all three origins; no actual invitations were sent to other people. All 13 existing Android OTA targets were signed and verified, including 172 immutable asset URLs. Existing cached messages need a newly shared invitation to refresh their preview.

Release: 20261031-invite-language. Backups: /srv/apps/logic-coin/backups/invite-language-20261031 (backend, web pointer, OTA pointers, Nginx configuration). Login redesign work remains separate and uncommitted.
