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

function wheelMarkup(kind) {
  const names = ['U', 'А', 'М', 'Р', 'К', 'S', 'Д', 'N'], colors = ['self', 'green', 'yellow', 'blue', 'red', 'green', 'yellow', 'red'];
  return `<div class="wheel-wrap"><div class="activity-wheel" role="img" id="${kind}Wheel"><svg class="progress-ring" viewBox="0 0 180 180" aria-hidden="true"><circle class="track" cx="90" cy="90" r="70"/><circle id="${kind}Circle" class="progress" cx="90" cy="90" r="70"/></svg><div class="wheel-center"><small>ДНЕЙ ПРОЙДЕНО</small><strong id="${kind}Progress">0 / 7</strong><em id="${kind}WheelStatus">Вы в активе</em></div><div class="orbital-ring">${names.map((name, i) => `<div class="orbit-slot ${i === 0 ? 'orbit-self' : ''}" ${i === 0 ? `id="${kind}SelfOrbit" data-self` : ''} style="--angle:${i * 45}deg"><div class="orbit-counter"><span class="avatar orbit-face ${colors[i]}">${name}</span></div></div>`).join('')}</div></div><p class="wheel-caption">Демо-участники · <b id="${kind}Pool">128</b></p></div>`;
}
$('periodCards').innerHTML = ['week', 'month'].map(kind => `<section id="${kind}Card" class="card period-card ${kind}-card" data-period="${kind}" data-eligible="true" aria-labelledby="${kind}Title"><div class="card-heading"><div class="period-title"><h2 id="${kind}Title">${kind === 'week' ? 'Недельный актив' : 'Месячный актив'}</h2><button class="info-button" data-rules="${kind}" aria-label="Правила ${kind === 'week' ? 'недельной' : 'месячной'} активности">${icons('info')}</button></div><span class="status-pill" id="${kind}Badge">Участвуете</span></div><div class="period-clock period-clock-card"><span>${icons('clock')} До конца ${kind === 'week' ? 'недели' : 'месяца'}</span><strong id="${kind}Countdown">—</strong></div><div class="period-center">${wheelMarkup(kind)}<div class="activity-facts"><div><div class="fact-value" id="${kind}Misses">0 <span>/ 2</span></div><div class="fact-label">дня пропущено</div></div><div><div class="fact-value" id="${kind}Left">2</div><div class="fact-label">${kind === 'week' ? 'дня' : 'дня'} ещё в запасе</div></div></div></div><div class="self-profile"><span class="avatar self">U</span><div class="self-copy">Вы · Демо-игрок<small id="${kind}SelfStatus">Участие сохранено</small></div><strong class="self-score" id="${kind}SelfScore">0 / 7</strong></div><div class="day-progress" id="${kind}Days" aria-label="Прогресс дней"></div><p class="card-note" id="${kind}Note"></p><button class="period-cta" id="${kind}Cta" hidden><span></span>${icons('arrow')}</button></section>`).join('');
$('gamesList').innerHTML = games.map(([key, title], i) => `<div class="game-row" data-game="${i}"><img class="game-image" src="./assets/${key}.webp" alt=""><strong class="game-title">${title}</strong><span class="game-reward" id="reward${i}"></span><button class="game-action" data-play="${i}" aria-label="Отметить игру «${title}» пройденной в макете" aria-pressed="false">${icons('arrow')}</button></div>`).join('');

function gameWindow() {
  $('gamesViewport').style.height = (expanded ? $('gamesList').scrollHeight : 202) + 'px';
  document.querySelector('.games-card').classList.toggle('expanded', expanded);
  $('gamesToggle').setAttribute('aria-expanded', String(expanded));
  $('gamesToggle').querySelector('span').textContent = expanded ? 'Свернуть игры' : 'Показать все 6 игр';
  document.querySelectorAll('[data-play]').forEach((button, i) => button.tabIndex = expanded || i < 2 ? 0 : -1);
}
function renderGames() {
  $('gamesCount').textContent = `${gamesDone.filter(Boolean).length} / 6`;
  document.querySelectorAll('[data-play]').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(gamesDone[i])); button.innerHTML = icons(gamesDone[i] ? 'check' : 'arrow');
    $('reward' + i).innerHTML = gamesDone[i] ? `${icons('gem')} +${games[i][2] || 18}` : '';
  });
  $('dailyComplete').hidden = !gamesDone.every(Boolean); gameWindow();
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
  const focus = state.week.eligible ? 'week' : state.month.eligible ? 'month' : 'week';
  $('activeFocus').textContent = state.week.eligible && state.month.eligible ? 'Вы в двух активах' : state.month.eligible ? 'Ваш актив — месячный' : state.week.eligible ? 'Ваш актив — недельный' : 'Новый шанс — на следующей неделе';
  $('activeFocus').dataset.focus = focus;
  for (const kind of ['week', 'month']) {
    const value = state[kind], card = $(kind + 'Card');
    card.dataset.eligible = String(value.eligible); card.dataset.primary = String(kind === focus); card.dataset.misses = value.misses;
    $(kind + 'Badge').textContent = value.eligible ? 'Участвуете' : 'Вне актива';
    $(kind + 'Progress').textContent = `${value.done} / ${value.days}`;
    $(kind + 'SelfScore').textContent = `${value.done} / ${value.days}`;
    $(kind + 'WheelStatus').textContent = value.eligible ? 'Вы в активе' : 'Без участия';
    $(kind + 'SelfStatus').textContent = value.eligible ? 'Участие сохранено' : 'Вне этого розыгрыша';
    $(kind + 'SelfOrbit').setAttribute('aria-hidden', String(!value.eligible));
    $(kind + 'Pool').textContent = (kind === 'week' ? 128 : 256) + Number(value.eligible);
    $(kind + 'Wheel').setAttribute('aria-label', `Демонстрационные участники ${kind === 'week' ? 'недельного' : 'месячного'} розыгрыша. ${value.eligible ? 'Вы участвуете' : 'Вы вне актива'}. Пройдено ${value.done} из ${value.days} дней.`);
    $(kind + 'Circle').style.strokeDashoffset = 439.823 * (1 - value.done / value.days);
    $(kind + 'Misses').innerHTML = `${value.misses} <span>/ ${value.limit}</span>`;
    $(kind + 'Misses').className = `fact-value ${!value.eligible ? 'danger' : value.left === 0 ? 'warning' : ''}`;
    $(kind + 'Left').textContent = value.left;
    const days = value.cells.map(cell => { const element = document.createElement('span'); element.className = 'day-cell'; element.dataset.state = cell.state; element.title = `${cell.key}: ${ { complete: 'Все 6 игр пройдены', missed: 'Пропущен', today: 'Сегодня, день ещё продолжается', future: 'Будущий день' }[cell.state] }`; return element; });
    $(kind + 'Days').replaceChildren(...days);
    const note = $(kind + 'Note'), cta = $(kind + 'Cta'); cta.hidden = true;
    note.className = `card-note ${!value.eligible ? 'out' : value.left === 0 ? 'warning' : ''}`;
    if (value.eligible) note.textContent = value.left === 0 ? `Лимит пропусков исчерпан. Следующий пропущенный день исключит вас из ${kind === 'week' ? 'недельного' : 'месячного'} актива.` : `Можно пропустить ещё ${value.left} ${value.left === 1 ? 'день' : value.left < 5 ? 'дня' : 'дней'}. Сегодня ещё можно завершить все 6 игр — до полуночи день не считается пропущенным.`;
    else if (kind === 'week' && state.month.eligible) {
      note.textContent = `Вы вышли из недельного актива: пропущено ${value.misses} дня при лимите ${value.limit}. Но ваш шанс в месячном активе сохраняется.`;
      cta.hidden = false; cta.querySelector('span').textContent = 'Продолжить в месячном активе'; cta.onclick = () => focusPeriod('month');
    } else if (kind === 'month' && state.week.eligible) {
      note.textContent = `Вы вышли из месячного актива: пропущено ${value.misses} дней при лимите ${value.limit}. В недельном активе вы по-прежнему участвуете.`;
      cta.hidden = false; cta.querySelector('span').textContent = 'Перейти к недельному активу'; cta.onclick = () => focusPeriod('week');
    } else {
      note.textContent = kind === 'week' ? `Вы вышли из недельного актива: пропущено ${value.misses} дня. Попробуйте снова с началом следующей недели — счётчик начнётся заново.` : `Вы вышли из месячного актива: пропущено ${value.misses} дней при лимите ${value.limit}. Следующий шанс — в новом месяце. А раньше можно вернуться в недельный актив с началом новой недели.`;
    }
  }
  $('previewDate').textContent = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }).format(new Date(now()));
  updateTimers();
}
function countdown(end) {
  const value = remaining(end, now());
  const clock = [value.hours, value.minutes, value.seconds].map(n => String(n).padStart(2, '0')).join(':');
  return value.days ? `${value.days} д ${clock}` : clock;
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
if (matchMedia('(max-width: 800px)').matches) document.querySelector('.scenario-details').open = false;
selectScenario(selected);
let timer = setInterval(updateTimers, 1000);
document.addEventListener('visibilitychange', () => { document.body.classList.toggle('is-hidden', document.hidden); clearInterval(timer); if (!document.hidden) { updateTimers(); timer = setInterval(updateTimers, 1000); } });
