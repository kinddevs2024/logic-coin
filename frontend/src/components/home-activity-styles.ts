export const homeActivityCss = `.lc-home-activity h2 { font-size: 21px; letter-spacing: -.65px; font-weight: 700; line-height: 1.25; margin: 0; }
.lc-home-activity .card { background: var(--card); border: 1px solid var(--line); border-radius: 30px; padding: 24px; box-shadow: none; margin-bottom: 18px; backdrop-filter: blur(20px); }
.lc-home-activity .card-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.lc-home-activity .period-title { display: flex; align-items: center; gap: 5px; min-width: 0; }
.lc-home-activity .period-title h2 { margin: 0; }
.lc-home-activity .info-button { display: grid; place-items: center; background: transparent; color: var(--muted); padding: 3px; border-radius: 50%; flex-shrink: 0; }
.lc-home-activity .info-button svg { width: 16px; height: 16px; }
.lc-home-activity .heading-clock { display: flex; align-items: center; gap: 5px; color: var(--muted); flex-shrink: 0; }
.lc-home-activity .heading-clock svg { width: 15px; height: 15px; }
.lc-home-activity .heading-clock strong { font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 550; white-space: nowrap; letter-spacing: -.15px; }
.lc-home-activity .games-viewport { position: relative; height: 202px; overflow: hidden; transition: height .38s cubic-bezier(.2, .8, .2, 1); }
/* Fade the content itself, so its last pixels merge with any card background. */
.lc-home-activity .games-card:not(.expanded) .games-viewport {
  -webkit-mask-image: linear-gradient(to bottom, #000 52%, rgba(0, 0, 0, .85) 66%, rgba(0, 0, 0, .32) 83%, transparent 96%);
  mask-image: linear-gradient(to bottom, #000 52%, rgba(0, 0, 0, .85) 66%, rgba(0, 0, 0, .32) 83%, transparent 96%);
}
.lc-home-activity .games-list { display: flex; flex-direction: column; gap: 10px; padding: 1px; }
.lc-home-activity .game-row { display: flex; align-items: center; gap: 12px; min-height: 72px; border: 1px solid var(--line); background: var(--soft); border-radius: 999px; padding: 8px 10px 8px 8px; }
.lc-home-activity .game-image { width: 52px; height: 52px; flex-shrink: 0; border-radius: 50%; object-fit: cover; }
.lc-home-activity .game-title { font-size: 14px; line-height: 1.35; letter-spacing: -.2px; font-weight: 650; flex: 1; min-width: 0; }
.lc-home-activity .game-reward { color: var(--primary); font-size: 11px; display: flex; align-items: center; gap: 3px; font-weight: 650; }
.lc-home-activity .game-reward svg { width: 14px; height: 14px; color: var(--warning); }
.lc-home-activity .game-action { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--primary); color: var(--primary-ink); flex-shrink: 0; transition: background .2s, transform .2s; }
.lc-home-activity .game-action:hover { transform: scale(1.05); }
.lc-home-activity .game-action[data-completed=true] { background: var(--soft); border: 1px solid var(--line); color: var(--primary); }
.lc-home-activity .game-action svg { width: 21px; height: 21px; }
.lc-home-activity .games-card:not(.expanded) .game-row:nth-child(n+3) { pointer-events: none; }
.lc-home-activity .expand-button { width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px; background: transparent; color: var(--primary); font-size: 12px; font-weight: 650; min-height: 45px; margin-top: 3px; }
.lc-home-activity .expand-button svg { width: 18px; height: 18px; transition: transform .3s; }
.lc-home-activity .expanded .expand-button svg { transform: rotate(180deg); }
.lc-home-activity .period-card { position: relative; overflow: hidden; padding-top: 16px; padding-bottom: 16px; }
.lc-home-activity .period-card .card-heading { margin-bottom: 14px; }
.lc-home-activity .raffle-stage { position: relative; height: 220px; border: 1px solid color-mix(in srgb, var(--mint) 60%, var(--line)); border-radius: 23px; overflow: hidden; margin-bottom: 12px; }
.lc-home-activity .raffle-window {
  height: 100%; overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, .45) 10%, #000 24%, #000 76%, rgba(0, 0, 0, .45) 90%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, .45) 10%, #000 24%, #000 76%, rgba(0, 0, 0, .45) 90%, transparent 100%);
}
.lc-home-activity .raffle-track { animation: raffle-scroll var(--reel-duration, 28s) linear infinite; animation-delay: -4s; will-change: transform; }
.lc-home-activity .raffle-group { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.lc-home-activity .raffle-player { display: flex; align-items: center; gap: 12px; min-height: 64px; height: 64px; width: min(100%, 290px); margin: 0 auto; padding: 7px 20px; flex-shrink: 0; }
.lc-home-activity .raffle-player .avatar { width: 43px; height: 43px; font-size: 19px; border: 0; }
.lc-home-activity .raffle-copy { min-width: 0; flex: 1; }
.lc-home-activity .raffle-copy > strong { display: block; font-size: 14px; font-weight: 650; letter-spacing: -.25px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-home-activity .raffle-stats { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
.lc-home-activity .raffle-stats > span { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 3px 7px; font-size: 10px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.lc-home-activity .raffle-stats svg { width: 11px; height: 11px; }
.lc-home-activity .raffle-coins { color: var(--warning); background: color-mix(in srgb, var(--warning) 10%, transparent); }
.lc-home-activity .raffle-money { color: var(--mint); background: color-mix(in srgb, var(--mint) 10%, transparent); }
.lc-home-activity .self-profile { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: center; gap: 10px; min-height: 60px; border: 1px solid var(--line); background: var(--soft); border-radius: 18px; padding: 9px 12px; }
.lc-home-activity .profile-water { position: absolute; bottom: 0; left: 0; width: 100%; height: var(--fill, 0%); color: var(--water); background: linear-gradient(to bottom, transparent 6px, currentColor 6px); pointer-events: none; transition: height .85s cubic-bezier(.22, 1, .36, 1), opacity .3s; }
.lc-home-activity .self-profile[data-progress="0"] .profile-water { opacity: 0; }
.lc-home-activity .self-profile[data-progress="100"] .profile-water { background: currentColor; }
.lc-home-activity .water-wave { position: absolute; top: -10px; left: 0; display: block; width: 200%; height: 24px; max-width: none; fill: currentColor; stroke: none; animation: water-drift 4.5s linear infinite; }
.lc-home-activity .water-wave + .water-wave { top: -11px; height: 26px; opacity: .35; animation-duration: 6.5s; animation-direction: reverse; }
.lc-home-activity .water-wave path { fill: currentColor; stroke: none; }
.lc-home-activity .self-profile > .avatar, .lc-home-activity .self-copy, .lc-home-activity .self-score { position: relative; z-index: 1; }
.lc-home-activity .self-profile .avatar { width: 40px; height: 40px; border-color: transparent; }
.lc-home-activity .self-copy { flex: 1; min-width: 0; font-size: 13px; font-weight: 650; line-height: 1.35; }
.lc-home-activity .self-copy small { display: block; margin-top: 4px; color: var(--text); font-size: 10px; font-weight: 450; line-height: 1.4; }
.lc-home-activity .self-score { font-size: 19px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.lc-home-activity .period-card[data-eligible=false] .self-profile .avatar { filter: grayscale(.9); opacity: .8; }

.lc-home-activity { width:100%; min-width:0; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.lc-home-activity * { box-sizing:border-box; }
.lc-home-activity button { font:inherit; cursor:pointer; border:0; }
.lc-home-activity button:focus-visible { outline:2px solid var(--primary); outline-offset:3px; }
.lc-home-activity .card { padding:20px 24px; margin:0 0 18px; backdrop-filter:none; }
.lc-home-activity .game-action:disabled { cursor:default; }
.lc-home-activity .game-action > div { display:flex; }
.lc-home-activity .heading-clock > div { display:flex; }
.lc-home-activity .self-avatar { position:relative; z-index:1; flex-shrink:0; }
.lc-home-activity .profile-water { opacity:.55; }
.lc-home-activity .period-card { padding-top:16px; padding-bottom:16px; }
.lc-home-activity .short { animation:none; }
.lc-home-activity .activity-empty { height:100%; display:flex; gap:12px; align-items:center; justify-content:center; flex-direction:column; padding:20px; text-align:center; color:var(--muted); font-size:13px; }
.lc-home-activity .activity-empty button,.lc-home-activity .activity-dialog button { padding:10px 20px; border-radius:16px; color:var(--primary-ink); background:var(--primary); }
.lc-home-activity .activity-dialog { background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:24px; max-width:440px; width:calc(100% - 32px); padding:24px; }
.lc-home-activity .activity-dialog::backdrop { background:#0008; }
.lc-home-activity .activity-dialog p { line-height:1.6; }
.lc-home-activity.is-hidden .raffle-track,.lc-home-activity.is-hidden .water-wave { animation-play-state:paused; }
@keyframes raffle-scroll { to { transform:translateY(-50%); } }
@keyframes water-drift { to { transform:translateX(-50%); } }
@media(max-width:540px) { .lc-home-activity .card { padding:18px; border-radius:28px; } .lc-home-activity h2 { font-size:18px; } .lc-home-activity .heading-clock strong { font-size:11px; } }
@media(max-width:370px) { .lc-home-activity .card { padding:14px; } .lc-home-activity h2 { font-size:15px; } .lc-home-activity .card-heading { gap:6px; } .lc-home-activity .heading-clock { gap:3px; } .lc-home-activity .heading-clock strong { font-size:10px; } .lc-home-activity .raffle-stage { height:204px; } .lc-home-activity .game-title { font-size:12px; } .lc-home-activity .game-row { gap:7px; } }
@media(prefers-reduced-motion:reduce) { .lc-home-activity *, .lc-home-activity *::before { animation:none!important; transition:none!important; } }
`;
