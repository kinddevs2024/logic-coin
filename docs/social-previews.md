# Social previews

Invite and profile URLs remain unchanged. Android App Links and referral attribution continue to receive the original URL. Normal pages include generic Open Graph and Twitter metadata in exported HTML. Profiles and invitations receive server-rendered metadata, without relying on a crawler executing JavaScript.

Nginx: add this location ONLY to the HTTPS server for logic-coin.online/www.logic-coin.online, before the SPA fallback. The explicit character class prevents path traversal. Do not change other virtual hosts.

```nginx
location ~ "^/(profile|invite)/([A-Za-z0-9-]{4,32})/?$" {
    proxy_pass http://127.0.0.1:4001/api/v1/share/page/$1/$2;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

The API process needs the exported frontend at `../frontend/dist` relative to its working directory (or set WEB_DIST_DIR). Ship frontend/public/share assets with the web export. Install backend dependencies on the target OS: sharp contains a native image renderer.

Only fields already displayed by the public profile are used in its image. The renderer must not fetch arbitrary avatar URLs. Images are cached for five minutes with at most 100 entries. Social platforms have independent caches and users can disable link previews; old messages may retain older previews. Sharing a URL cannot force an app to attach a separate image file.

Verify: root/game URLs return generic og:image; invite URLs preserve referral code and generic illustration; profile URLs return a profile-specific JPEG with public stats; encoded names cannot inject markup; unknown profiles do not leak another person's data; QR decodes to exactly the invite link at small mobile sizes. Also test real Telegram preview and installed Android App Links separately from HTTP checks.
