import { activity, dayKey, dayStart, addDays, periodBounds, remaining, scenario } from './activity.mjs';

const $ = id => document.getElementById(id);
const icons = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const games = [
  ['volt-numbers', 'VOLT Числа', 24], ['geography-quiz', 'География', 18], ['space-find-number', 'Космические числа', 0],
  ['one-second', 'Одна секунда', 0], ['shadow', 'Тени', 0], ['find-letter', 'Найди букву', 0],
];
const allowedScenarios = ['active', 'week-limit', 'week-out', 'month-limit', 'both-out', 'first-day', 'new-week'];
const query = new URLSearchParams(location.search);
let selected = allowedScenarios.includes(query.get('scenario')) ? query.get('scenario') : 'active';
let data = scenario(selected), selectedAt = Date.now(), gamesDone = [true, true, false, false, false, false], expanded = false;
let completed = new Set(data.completedDays), lastDay = dayKey(data.now), previousFocus = null, toastTimer;
const now = () => data.now + Date.now() - selectedAt;
const stats = () => ({ week: activity('week', now(), [...completed]), month: activity('month', now(), [...completed]) });

function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
function updateUrl() {
  const url = new URL(location.href); url.searchParams.set('scenario', selected); url.searchParams.set('theme', document.body.dataset.theme); history.replaceState(null, '', url);
}
function theme(value) {
  document.body.dataset.theme = value; $('themeToggle').setAttribute('aria-pressed', String(value === 'light'));
  try { localStorage.setItem('logic-home-preview-theme', value); } catch {}
  document.querySelector('meta[name=theme-color]').content = value === 'light' ? '#f0f6fa' : '#111820';
}
let savedTheme; try { savedTheme = localStorage.getItem('logic-home-preview-theme'); } catch {}
theme(query.get('theme') === 'light' || !query.has('theme') && savedTheme === 'light' ? 'light' : 'dark');
$('themeToggle').onclick = () => { theme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'); updateUrl(); };

// Sample participants use the vertical raffle layout shown in the reference.
const participants = [
  { name: 'Sabina 💕', initial: 'S', color: 'green', coins: '18 015', money: '0.01' },
  { name: 'Martin O’brayn', initial: 'M', color: 'green', coins: '42 238', money: '1.16' },
  { name: 'muxriddin 🙌', initial: 'm', color: 'yellow', coins: '40 151', money: '0.10' },
  { name: 'Вы · Игрок', initial: 'U', color: 'self', coins: '1 951', money: '0.00', self: true },
  { name: 'RAHMATILLA_$', initial: 'R', color: 'blue', coins: '36 470', money: '0.14' },
  { name: 'Ayyubiy', initial: 'А', color: 'green', coins: '17 047', money: '0.00' },
  { name: 'Diyor', initial: 'D', color: 'red', coins: '24 830', money: '0.05' },
];
function playerMarkup(player) {
  return `<li class="raffle-player"${player.self ? ' data-self' : ''}><span class="avatar ${player.color}">${player.initial}</span><div class="raffle-copy"><strong>${player.name}</strong><div class="raffle-stats"><span class="raffle-coins">${icons('gem')}${player.coins}</span><span class="raffle-money">${icons('wallet')}$ ${player.money}</span></div></div></li>`;
}
function renderReel(kind, eligible) {
  const reel = $(kind + 'Reel');
  if (reel.dataset.eligible === String(eligible)) return;
  const rows = participants.filter(player => !player.self || eligible).map(playerMarkup).join('');
  reel.dataset.eligible = String(eligible);
  // Two identical groups make the translateY(-50%) loop continuous.
  reel.innerHTML = `<ul class="raffle-group" aria-label="Пример участников">${rows}</ul><ul class="raffle-group" aria-hidden="true">${rows}</ul>`;
  reel.style.setProperty('--reel-duration', `${(participants.length - Number(!eligible)) * 2.6}s`);
}
function waterMarkup() {
  const wave = '<path d="M0 12 Q150 0 300 12 T600 12 T900 12 T1200 12 V24 H0Z"/>';
  return `<div class="profile-water" aria-hidden="true"><svg class="water-wave water-wave-back" viewBox="0 0 1200 24" preserveAspectRatio="none">${wave}</svg><svg class="water-wave water-wave-front" viewBox="0 0 1200 24" preserveAspectRatio="none">${wave}</svg></div>`;
}
$('periodCards').innerHTML = ['week', 'month'].map(kind => `<section id="${kind}Card" class="card period-card ${kind}-card" data-period="${kind}" data-eligible="true" aria-labelledby="${kind}Title">
  <div class="card-heading"><div class="period-title"><h2 id="${kind}Title">${kind === 'week' ? 'Недельный актив' : 'Месячный актив'}</h2><button class="info-button" data-rules="${kind}" aria-label="Правила ${kind === 'week' ? 'недельной' : 'месячной'} активности">${icons('info')}</button></div><div class="heading-clock" aria-label="До конца ${kind === 'week' ? 'недели' : 'месяца'}">${icons('clock')}<strong id="${kind}Countdown">—</strong></div></div>
  <div class="raffle-stage"><div class="raffle-window"><div class="raffle-track" id="${kind}Reel"></div></div><span class="raffle-pointer" aria-hidden="true"></span></div>
  <div class="self-profile" id="${kind}Profile" data-progress="0" style="--fill:0%">${waterMarkup()}<span class="avatar self">U</span><div class="self-copy">Вы · Игрок<small id="${kind}SelfStatus" hidden></small></div><strong class="self-score" id="${kind}SelfScore" role="progressbar" aria-label="Прогресс ${kind === 'week' ? 'недельного' : 'месячного'} актива" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">0%</strong></div>
</section>`).join('');
$('gamesList').innerHTML = games.map(([key, title], i) => `<div class="game-row" data-game="${i}"><img class="game-image" src="./assets/${key}.webp" alt=""><strong class="game-title">${title}</strong><span class="game-reward" id="reward${i}"></span><button class="game-action" data-play="${i}" aria-label="Отметить игру «${title}» пройденной в макете" aria-pressed="false">${icons('arrow')}</button></div>`).join('');

function gameWindow() {
  $('gamesViewport').style.height = (expanded ? $('gamesList').scrollHeight : 202) + 'px';
  document.querySelector('.games-card').classList.toggle('expanded', expanded);
  $('gamesToggle').setAttribute('aria-expanded', String(expanded));
  $('gamesToggle').querySelector('span').textContent = expanded ? 'Свернуть игры' : 'Показать все 6 игр';
  document.querySelectorAll('[data-play]').forEach((button, i) => button.tabIndex = expanded || i < 2 ? 0 : -1);
}
function renderGames() {
  document.querySelectorAll('[data-play]').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(gamesDone[i])); button.innerHTML = icons(gamesDone[i] ? 'check' : 'arrow');
    $('reward' + i).innerHTML = gamesDone[i] ? `${icons('gem')} +${games[i][2] || 18}` : '';
  });
  gameWindow();
}
document.querySelectorAll('[data-play]').forEach(button => button.onclick = () => {
  const i = Number(button.dataset.play); gamesDone[i] = !gamesDone[i];
  if (gamesDone.every(Boolean)) completed.add(dayKey(now())); else completed.delete(dayKey(now()));
  renderGames(); renderActivity();
});
$('gamesToggle').onclick = () => { expanded = !expanded; gameWindow(); };
addEventListener('resize', gameWindow);

function focusPeriod(kind) { $(kind + 'Card').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }
function renderActivity() {
  const state = stats();
  for (const kind of ['week', 'month']) {
    const value = state[kind], card = $(kind + 'Card');
    card.dataset.eligible = String(value.eligible); card.dataset.misses = value.misses;
    const percent = Math.round(value.done / value.days * 100), profile = $(kind + 'Profile'), score = $(kind + 'SelfScore');
    profile.style.setProperty('--fill', `${value.done / value.days * 100}%`);
    profile.dataset.progress = String(percent);
    score.textContent = `${percent}%`;
    score.setAttribute('aria-valuenow', String(percent));
    score.setAttribute('aria-valuetext', `${percent}%, завершено ${value.done} из ${value.days} дней`);
    const status = $(kind + 'SelfStatus');
    status.hidden = value.eligible;
    status.textContent = value.eligible ? '' : kind === 'week' ? 'Вне недельного актива' : 'Вне месячного актива';
    renderReel(kind, value.eligible);
  }
  $('previewDate').textContent = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }).format(new Date(now()));
  updateTimers();
}
function countdown(end) {
  const value = remaining(end, now());
  const clock = [value.hours, value.minutes, value.seconds].map(n => String(n).padStart(2, '0')).join(':');
  return value.days ? `${value.days}д ${clock}` : clock;
}
function updateTimers() {
  const today = dayKey(now());
  if (lastDay !== today) { lastDay = today; gamesDone = Array(6).fill(false); renderGames(); renderActivity(); return; }
  $('dailyCountdown').textContent = countdown(dayStart(addDays(today, 1)));
  for (const kind of ['week', 'month']) $(kind + 'Countdown').textContent = countdown(dayStart(periodBounds(kind, today).next));
}
function selectScenario(name) {
  $('toast').hidden = true; clearTimeout(toastTimer);
  selected = name; data = scenario(name); selectedAt = Date.now(); completed = new Set(data.completedDays); gamesDone = [true, true, false, false, false, false]; lastDay = dayKey(now());
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === name)));
  renderGames(); renderActivity(); updateUrl();
}
document.querySelectorAll('[data-scenario]').forEach(button => button.onclick = () => selectScenario(button.dataset.scenario));
$('nextDay').onclick = () => {
  const old = stats(); data.now = now() + 86400000; selectedAt = Date.now(); lastDay = dayKey(now()); gamesDone = Array(6).fill(false);
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  renderGames(); renderActivity(); const next = stats();
  if (old.week.eligible && !next.week.eligible && next.month.eligible) focusPeriod('month');
  toast(`День переключён: ${$('previewDate').textContent}`);
};
function showRules(kind) {
  const value = kind ? stats()[kind] : null;
  $('rulesTitle').textContent = kind === 'week' ? 'Недельный актив' : kind === 'month' ? 'Месячный актив' : 'Один день — шесть игр';
  $('rulesContent').innerHTML = `<p>День засчитывается, когда вы завершили <b>все 6 игр</b> сегодняшнего челленджа. Пропуски суммируются за период, а не только подряд.</p><p><b>Неделя:</b> можно пропустить 2 дня. После 3-го пропуска вы выходите из недельного актива. За полную неделю нужно завершить минимум 5 из 7 дней.</p><p><b>Месяц:</b> можно пропустить 4 дня. После 5-го пропуска вы выходите из месячного актива.${value && kind === 'month' ? ` В этом месяце это минимум ${value.required} из ${value.days} дней.` : ''}</p><p>Сегодняшний незавершённый день станет пропуском только после <b>00:00 по Ташкенту</b>. В первый день нового периода все начинают с нуля пропусков.</p><p>Новая неделя начинается в понедельник, новый месяц — 1-го числа. Выход из одного актива не лишает участия в другом, если его лимит ещё не превышен. Пройденные дни сохраняются в карточке.</p><p>Это условия участия в розыгрыше, а не гарантированный денежный приз. Здесь показан предварительный вариант интерфейса.</p>`;
  previousFocus = document.activeElement; $('rulesDialog').showModal(); $('closeDialog').focus();
}
function closeRules() { $('rulesDialog').close(); if (previousFocus?.focus) previousFocus.focus(); }
document.querySelectorAll('[data-rules]').forEach(button => button.onclick = () => showRules(button.dataset.rules));
$('allRules').onclick = () => showRules(); $('closeDialog').onclick = closeRules; $('understood').onclick = closeRules;
$('rulesDialog').addEventListener('click', event => { if (event.target === $('rulesDialog')) { const box = $('rulesDialog').getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeRules(); } });
$('profileButton').onclick = () => toast('В макете используется демонстрационный профиль.');
$('bellButton').onclick = () => toast('Уведомления доступны в основной версии приложения.');
selectScenario(selected);
let timer = setInterval(updateTimers, 1000);
document.addEventListener('visibilitychange', () => { document.body.classList.toggle('is-hidden', document.hidden); clearInterval(timer); if (!document.hidden) { updateTimers(); timer = setInterval(updateTimers, 1000); } });
