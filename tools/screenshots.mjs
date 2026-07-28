/* ============================================================
   SCREENSHOTS — regenerate every image in the README.

     node tools/screenshots.mjs

   Drives the real game in headless Chrome over the DevTools Protocol and
   captures what it finds. Nothing is mocked up: the run in run.png was played,
   card by card, by the little bot in playStep() below.

   Zero dependencies — Node 18+ has fetch, Node 22+ has a global WebSocket, and
   the static server is 30 lines of node:http. Needs network access for the
   Google Fonts the game uses, and reads the live leaderboard for board.png.
   ============================================================ */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'screenshots');
const PROFILE = join(tmpdir(), 'scoundrel-shots-profile');
const DEBUG_PORT = Number(process.env.CDP_PORT || 9222);

/* ---------- chrome ---------- */
const CHROME_CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find(p => existsSync(p));
if (!CHROME) throw new Error('no Chrome found — set CHROME=/path/to/chrome');

/* ---------- a static server for the repo ---------- */
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^[/\\]+/, '');
  const file = join(ROOT, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }   // no climbing out
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
console.log(`serving ${ROOT} at ${BASE}`);

/* ---------- launch ---------- */
// A profile left locked by a killed run stops Chrome booting at all.
rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--headless=new',
  '--window-size=1280,800',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  // NB: --default-background-color=00000000 suppresses the page target entirely,
  // leaving the debugger nothing to attach to. Transparency for the play button
  // is set per-page via Emulation.setDefaultBackgroundColorOverride instead.
  `--user-data-dir=${PROFILE}`,
  `${BASE}/index.html`,
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(400);
  try {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  } catch { /* not up yet */ }
}
if (!target) { chrome.kill(); server.close(); throw new Error('chrome debugger never came up'); }

/* ---------- CDP plumbing ---------- */
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let msgId = 0;
const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(res => {
  const n = ++msgId;
  pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const js = async expr => {
  const r = await send('Runtime.evaluate', {
    expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true,
  });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
// size the viewport to each scene so no dead felt ends up in the shot
const viewport = async (width, height, deviceScaleFactor = 1) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  await sleep(350);
};
const shot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(r.result.data, 'base64');
  writeFileSync(join(OUT, `${name}.png`), buf);
  console.log(`  saved ${name}.png (${Math.round(buf.length / 1024)} KB)`);
};
// Do not await document.fonts.ready — if a webfont request never settles the
// promise never resolves and the whole script hangs. Poll instead.
const waitForFont = async spec => {
  for (let i = 0; i < 24; i++) {
    await sleep(500);
    if (await js(`return document.fonts.check(${JSON.stringify(spec)});`)) return true;
  }
  return false;
};

await send('Page.enable');
await send('Runtime.enable');
if (!await waitForFont("40px 'Jersey 10'")) throw new Error('webfonts never arrived');
await js(`
  localStorage.setItem('scoundrel_mute','1');
  localStorage.removeItem('scoundrel_save');
  return 1;
`);

/* ============================================================
   the bot

   ui.js resolves a click as: E.resolveCard -> renderAll() -> playEvents(evs).
   Skipping the renderAll leaves the table painted at the previous state and the
   screenshot then shows something that never happened — hence the sync check in
   peek() below. SAFE is the margin the bot keeps in hand; it is taking a
   screenshot, not trying to win, so it never accepts a fight that could end the
   run.
   ============================================================ */
const playStep = `
  const SAFE = 6;
  const go = (c, choice) => { const evs = E.resolveCard(c.id, choice); UI.renderAll(); UI.playEvents(evs); };
  const room = S.room.slice();
  const mons = room.filter(x => x.suit === 'S' || x.suit === 'C');
  const cost = (c, m) => E.previewDamage(c, m);
  let c = room.find(x => x.suit === 'D' && (!S.weapon || x.rank > S.weapon.card.rank));
  if (c) { go(c); return 'weapon ' + c.rank; }
  const killable = mons.filter(x => E.canUseWeapon(x) && S.hp - cost(x, 'weapon') > SAFE)
                       .sort((a, b) => b.rank - a.rank);   // hardest first keeps the fan wide
  if (killable[0]) { go(killable[0], 'weapon'); return 'slay ' + killable[0].rank; }
  c = room.find(x => x.suit === 'H');
  if (c && S.hp <= S.maxHp - 4) { go(c); return 'potion ' + c.rank; }
  c = room.find(x => x.suit === 'D' || x.suit === 'X' || (x.suit === 'H' && x.rank >= 11));
  if (c) { go(c); return 'take ' + c.suit + c.rank; }
  const punch = mons.filter(x => S.hp - cost(x, 'bare') > SAFE)
                    .sort((a, b) => cost(a, 'bare') - cost(b, 'bare'));
  if (punch[0]) { go(punch[0], 'bare'); return 'bare ' + punch[0].rank; }
  if (E.canFlee()) { UI.playEvents(E.flee()); UI.renderAll(true); return 'flee'; }
  c = room.find(x => x.suit === 'H');
  if (c) { go(c); return 'potion ' + c.rank; }
  return 'cornered';
`;
const peek = `
  const domRoom = [...document.querySelectorAll('#room .card')].map(e => e.dataset.id).join(',');
  const domWeaponEmpty = !!document.querySelector('#weapon-slot .weapon-empty');
  return {
    hp: S.hp, max: S.maxHp, kills: S.stats.kills,
    weapon: S.weapon ? S.weapon.card.rank : null,
    slain: S.weapon ? S.weapon.stack.length : 0,
    monsters: S.room.filter(c => c.suit === 'S' || c.suit === 'C').length,
    screen: (document.querySelector('.screen.active') || {}).id,
    // the table must actually be painted with the state we are about to shoot
    synced: domRoom === S.room.map(c => c.id).join(',') && domWeaponEmpty === !S.weapon,
  };
`;
const takeFreeJoker = `
  const i = S.shop.items.findIndex(it => it && !it.sold && it.type === 'joker'
    && (S.shop.freePicks > 0 || it.price <= S.gold));
  if (i < 0) return 'no joker on offer';
  UI.playEvents(E.buyItem(i));
  return 'took slot ' + i;
`;

/* ---------- 1. title ---------- */
console.log('scene: menu');
await viewport(1280, 620);
await js(`UI.renderMenu(); UI.showScreen('menu'); return 1;`);
await sleep(700);
await shot('menu');

/* ---------- 2. the outfitting camp ---------- */
console.log('scene: camp');
await viewport(1280, 660);
await js(`E.newRun(); return 1;`);
await sleep(1300);
await shot('camp');

/* ---------- 3. mid-run ---------- */
console.log('scene: run');
console.log('  ' + await js(takeFreeJoker));
await viewport(1280, 720);   // set BEFORE play — a mid-scene resize re-renders the table
await js(`E.leaveShop(); return 1;`);
await sleep(1700);

// A run can still end badly (bad shuffle, cornered). Retry rather than shooting
// whatever happens to be on screen. Stop on a frame that shows the whole loop at
// once: a weapon with a fan of kills under it, damage taken, and a live monster
// still to decide about.
const presentable = st => st.screen === 'screen-game' && st.slain >= 2 && st.hp < st.max && st.monsters >= 1;
let reached = false;
for (let attempt = 1; attempt <= 5 && !reached; attempt++) {
  if (attempt > 1) {
    console.log(`  retry ${attempt}: fresh run`);
    await js(`E.newRun(); return 1;`); await sleep(1200);
    await js(takeFreeJoker); await sleep(900);
    await js(`E.leaveShop(); return 1;`); await sleep(1700);
  }
  for (let i = 0; i < 30; i++) {
    const what = await js(playStep);
    await sleep(1100);
    const st = await js(peek);
    console.log(`  ${i}: ${what} -> hp ${st.hp} kills ${st.kills} wpn ${st.weapon} slain ${st.slain} mons ${st.monsters}`);
    if (presentable(st)) { reached = true; break; }
    if (what === 'cornered' || st.screen !== 'screen-game') break;
  }
}
if (!reached) throw new Error('never reached a presentable mid-run frame');

await js(`UI.closeModal(true); return 1;`);
await sleep(1400);           // let every queued bit of juice land
const final = await js(peek);
console.log('  at capture: ' + JSON.stringify(final));
if (!final.synced) throw new Error('table is painted from a different state than S');
if (final.screen !== 'screen-game') throw new Error('not on the table at capture: ' + final.screen);
await shot('run');

/* ---------- 4. a boss ---------- */
console.log('scene: boss');
await js(`
  S.stage = 1;      // makes the next delve the act boss
  E.openShop();
  E.leaveShop();
  return 1;
`);
await sleep(4000);           // let the boss splash clear
await js(`UI.closeModal(true); return 1;`);
await sleep(800);
await shot('boss');

/* ---------- 5. the board (reads the live worker) ---------- */
console.log('scene: board');
await viewport(1180, 560);
await js(`UI.modalLeaderboard(); return 1;`);
await sleep(2600);
await shot('board');

/* ---------- 6. the README's play button ---------- */
console.log('scene: play button');
await send('Page.navigate', { url: `${BASE}/tools/play-button.html` });
await sleep(1200);
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
// 520x118 CSS px at 2x -> a 1040x236 PNG, shown at 320px wide in the README
await viewport(520, 118, 2);
if (!await waitForFont("46px 'Jersey 10'")) throw new Error('button webfont never arrived');
await sleep(500);
await shot('play');

console.log('done');
ws.close();
chrome.kill();
server.close();
process.exit(0);
