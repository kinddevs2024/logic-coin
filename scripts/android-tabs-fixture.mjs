// Local-only Android tab QA. No upstream URL, proxy, database, mail or ad calls.
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '..');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const source = readFileSync(resolve(root, 'frontend/src/constants/games.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const catalogModule = { exports: {} };
new Function('exports', 'module', compiled)(catalogModule.exports, catalogModule);
const catalog = catalogModule.exports.GAME_CATALOG;
const ACCOUNT = { email: 'qa@example.invalid', password: 'qa-local-only-123' };
const TOKENS = { accessToken: 'qa-local-fixture-access', refreshToken: 'qa-local-fixture-refresh', tokenType: 'Bearer' };
const palette = { light: true, dark: true };

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, contents) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(contents.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, contents])));
  return Buffer.concat([length, name, contents, crc]);
}
function avatarPng() {
  const size = 128;
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const head = (x - 64) ** 2 + (y - 44) ** 2 <= 22 ** 2;
    const torso = y >= 86 && ((x - 64) ** 2 / 46 ** 2 + (y - 119) ** 2 / 42 ** 2 <= 1);
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set(head || torso ? [255,255,255,255] : [22,121,232,255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR',header), pngChunk('IDAT',deflateSync(pixels)), pngChunk('IEND',Buffer.alloc(0))]);
}
const avatar = avatarPng();
const makeProgress = () => Object.fromEntries(catalog.map((game,index) => [game.key === 'fact' ? 'pulse' : game.key, {
  bestScore: 700, previousScore: 400, coins: 100 + index, lifetimeCoins: 100 + index,
  spentCoins: 0, transferredCoins: 0, currentLevel: 1, highestUnlockedLevel: 1,
  completedLevels: [], selectedCosmetic: 'classic', unlockedCosmetics: ['classic'],
  bestMovesByLevel: {}, bestTimesByLevel: {}, hintsUsedByLevel: {}, plays: 2, wins: 1,
  lastResult: '', updatedAt: 1,
}]));

export function createFixtureServer({ clientOrigin = 'http://127.0.0.1:8184', logPath = resolve(root, '.qa/android-tabs-native/requests.jsonl') } = {}) {
  if (logPath) mkdirSync(dirname(logPath), { recursive: true });
  const started = new Date();
  const dayKey = started.toISOString().slice(0, 10);
  let scenario = { label: 'default', theme: 'light', balance: 640, completed: 1 };
  let progress = makeProgress();
  let requestCount = 0;
  const history = [];
  const avatarUrl = `${clientOrigin}/qa/avatar.png`;
  const streak = { activeDays: 8, calendarSpanDays: 9, graceDaysUsed: 1, lastActiveDay: dayKey };
  const referral = { code: 'QA-LOCAL', link: 'https://example.invalid/qa', invitedCount: 3, verifiedInvitedCount: 2, earnedUnits: 10, earnedCents: 1000, earnedCoins: 0, signupRewardUnits: 5, friends: [], history: [] };
  const activity = { totalActiveDays: 34, streak, days: Array.from({ length: 7 }, (_, index) => ({ dayKey: new Date(started.getTime() - index * 86400000).toISOString().slice(0,10), actionCount: index + 1, rewardUnits: 10 })) };
  const tier = { eligible: false, claimed: false, available: false, rewardUnits: 0, requiredDays: 1, remainingDays: 1 };
  const bonuses = { timezone: 'Asia/Tashkent', today: dayKey, streak, daily: tier, weekly: tier, monthly: tier };
  const user = () => ({
    id: 'qa-local-user', role: 'user', name: 'QA Профиль', email: ACCOUNT.email, avatarUrl,
    countryCode: 'UZ', referralCode: 'QA-LOCAL', emailVerified: true,
    preferences: { language: 'ru', theme: scenario.theme, savingsGoalCents: 100000, notificationsEnabled: false, dailyReminderEnabled: false, timezone: 'Asia/Tashkent' },
    wallet: { availableUnits: scenario.balance, availableCents: scenario.balance * 100, lockedUnits: 0, lockedCents: 0, lifetimeEarnedUnits: 900, unitValueCents: 100, currency: 'USD' },
    coins: { balance: 420, lifetimeEarned: 420, referralEarned: 0 },
  });
  const today = () => ({
    status: 'published', available: true, dayKey, nextChallengeAt: null, endsAt: new Date(started.getTime() + 8 * 3600000).toISOString(), revision: 'qa-fixture',
    totalCount: 6, completedCount: scenario.completed, gamesCompletedToday: scenario.completed, totalCoinsToday: scenario.completed * 120, monthlyChallengeCount: 4,
    games: catalog.slice(0,6).map((game,index) => ({ ...game, state: { status: index < scenario.completed ? 'completed' : 'not_started', score: index < scenario.completed ? 800 : null, coinsAwarded: index < scenario.completed ? 120 : 0, doubled: false, completedAt: index < scenario.completed ? started.toISOString() : null } })),
    coins: user().coins, doubling: { firstGameKey: catalog[0].key, gameDoubled: false, dayDoubled: false, dayEligible: scenario.completed === 6 }, prizes: { cashMinUnits: 10, cashMaxUnits: 100, poolUnits: 1000 },
  });
  const bootstrap = () => ({ user: user(), tasks: [], todayChallenges: today(), bonuses, activity, referral, economy: { currency: 'USD', unitValueCents: 100, minimumWithdrawalCents: 10000, withdrawalsAreSandbox: true, taskProvider: 'qa' }, supported: { languages: ['ru','en','uz'] } });
  const auth = () => ({ user: user(), tokens: TOKENS });

  const server = createServer(async (request,response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const path = url.pathname;
    const method = request.method || 'GET';
    const record = { sequence: ++requestCount, label: scenario.label, method, path, status: 500 };
    const send = (status,data,raw = false) => {
      record.status = status;
      history.push(record);
      if (logPath) appendFileSync(logPath, `${JSON.stringify(record)}\n`);
      response.writeHead(status, { 'Content-Type': raw ? 'image/png' : 'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' });
      response.end(raw ? data : JSON.stringify(status < 400 ? { data } : { error: data }));
    };
    let bytes = 0;
    const parts = [];
    try {
      for await (const part of request) {
        bytes += part.length;
        if (bytes > 1024 * 1024) { send(413,{code:'qa_body_too_large',message:'QA request too large'}); return; }
        parts.push(part);
      }
      const body = parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {};
      if (method === 'OPTIONS') { send(200,{}); return; }
      if (path === '/_qa/health') { send(200,{ fixture: true, upstream: false, scenario, games: catalog.length, requestCount }); return; }
      if (path === '/_qa/requests') { send(200,history); return; }
      if (path === '/_qa/scenario' && method === 'POST') {
        if (typeof body.label === 'string') scenario.label = body.label.slice(0,40);
        if (body.theme in palette) scenario.theme = body.theme;
        if (Number.isFinite(body.balance)) scenario.balance = Math.min(1000, Math.max(0,body.balance));
        if (Number.isFinite(body.completed)) scenario.completed = Math.min(6,Math.max(0,Math.trunc(body.completed)));
        send(200,scenario); return;
      }
      if (path === '/_qa/reset' && method === 'POST') { scenario = { label:'default',theme:'light',balance:640,completed:1 }; progress = makeProgress(); send(200,scenario); return; }
      if (path === '/qa/avatar.png' && method === 'GET') { send(200,avatar,true); return; }
      if (path === '/api/v1/auth/email/start' && method === 'POST') {
        send(body.email === ACCOUNT.email ? 200 : 400, body.email === ACCOUNT.email ? {email:ACCOUNT.email,mode:'password'} : {code:'qa_email_only',message:'Use the synthetic QA email'}); return;
      }
      if (path === '/api/v1/auth/login' && method === 'POST') {
        const valid = body.email === ACCOUNT.email && body.password === ACCOUNT.password;
        send(valid ? 200 : 401,valid ? auth() : {code:'invalid_credentials',message:'Use the synthetic QA login'}); return;
      }
      if (path === '/api/v1/auth/refresh' && method === 'POST') { send(body.refreshToken === TOKENS.refreshToken ? 200 : 401,body.refreshToken === TOKENS.refreshToken ? auth() : {code:'session_expired',message:'QA session expired'}); return; }
      if (!path.startsWith('/api/v1/')) { send(404,{code:'qa_not_found',message:'No fixture route'}); return; }
      if (request.headers.authorization !== `Bearer ${TOKENS.accessToken}`) { send(401,{code:'qa_auth_required',message:'Synthetic QA session required'}); return; }
      const route = path.slice('/api/v1'.length);
      if (route === '/bootstrap' && method === 'GET') send(200,bootstrap());
      else if (route === '/games' && method === 'GET') send(200,{games:catalog});
      else if (route === '/games/progress' && method === 'GET') send(200,{games:progress});
      else if (route === '/games/progress' && method === 'PUT') { if (body.games && typeof body.games === 'object') progress = body.games; send(200,{games:progress}); }
      else if (route === '/challenges/today' && method === 'GET') send(200,{today:today()});
      else if (route === '/challenges/rewards/pending' && method === 'GET') send(200,{reward:null});
      else if (route === '/challenges/progress' && method === 'GET') send(200,{dayKey,participantCount:25,projectedCashUnits:30,previous:null,next:null,self:{rank:4,totalCoins:scenario.completed*120,completedGamesCount:scenario.completed},neighbors:Array.from({length:7},(_,index)=>({userId:index===3?'qa-local-user':`qa-neighbor-${index}`,rank:index+1,totalCoins:480-index*120,name:index===3?'QA Профиль':`QA Игрок ${index+1}`,avatarUrl,isSelf:index===3}))});
      else if (route === '/referrals' && method === 'GET') send(200,{referral});
      else if (route === '/activity' && method === 'GET') send(200,activity);
      else if (route === '/activity/check-in' && method === 'POST') send(200,{day:activity.days[0]});
      else if (route === '/notifications' && method === 'GET') send(200,{items:[],next:null});
      else if (route === '/notifications/read' && method === 'POST') send(200,{marked:0});
      else if (route === '/gifts' && method === 'GET') send(200,{gifts:[]});
      else if (route === '/bonuses' && method === 'GET') send(200,{bonuses});
      else if (route.startsWith('/devices/') && route.endsWith('/preferences') && method === 'PUT') send(200,{device:{id:'qa-device',deviceId:'qa-device',platform:'android',pushConfigured:false,notificationsEnabled:false,dailyReminderEnabled:false,reminderTime:'19:00',timezone:'Asia/Tashkent'}});
      else if (route === '/auth/logout' && method === 'POST') send(200,{success:true});
      else if (route === '/me' && method === 'GET') send(200,{user:user()});
      else send(404,{code:'qa_unsupported',message:'This operation is outside the four-tab fixture; no forwarding performed'});
    } catch { if (!response.headersSent) send(400,{code:'qa_invalid_json',message:'Invalid fixture request'}); }
  });
  return server;
}

async function selfTest() {
  const server = createFixtureServer({logPath:null});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (path,options={}) => {
    const response = await fetch(origin + path,options);
    return {status:response.status,payload:await response.json()};
  };
  try {
    assert.equal((await request('/_qa/health')).payload.data.games,13);
    const start = await request('/api/v1/auth/email/start',{method:'POST',body:JSON.stringify({email:ACCOUNT.email})});
    assert.equal(start.payload.data.mode,'password');
    const login = await request('/api/v1/auth/login',{method:'POST',body:JSON.stringify(ACCOUNT)});
    assert.equal(login.status,200);
    const headers = {Authorization:`Bearer ${login.payload.data.tokens.accessToken}`};
    const boot = await request('/api/v1/bootstrap',{headers});
    assert.equal(boot.payload.data.user.wallet.availableUnits,640);
    assert.equal(boot.payload.data.todayChallenges.games.length,6);
    assert.equal((await request('/api/v1/games',{headers})).payload.data.games.length,13);
    assert.equal((await request('/api/v1/challenges/rewards/pending',{headers})).payload.data.reward,null);
    assert.equal((await request('/api/v1/withdrawals',{headers,method:'POST',body:'{}'})).status,404);
    const picture = await fetch(origin+'/qa/avatar.png');
    assert.deepEqual([...new Uint8Array(await picture.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
    console.log('PASS: synthetic login/bootstrap/catalog/pending rewards, PNG avatar and denied unsupported write. No upstream requests.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) await selfTest();
  else {
    const port = Number(process.env.QA_FIXTURE_PORT || 8184);
    const clientOrigin = process.env.QA_CLIENT_ORIGIN || `http://127.0.0.1:${port}`;
    const server = createFixtureServer({clientOrigin});
    server.listen(port,'127.0.0.1',()=>console.log(`QA fixture only: http://127.0.0.1:${port}/api/v1; synthetic email ${ACCOUNT.email}; no upstream.`));
  }
}
