/* ============================================================
   SCOUNDREL leaderboard — Cloudflare Worker
   ------------------------------------------------------------
   GET  /board            -> { classic: [...], gauntlet: [...] }
   POST /score            -> { ok: true, rank: n }  (body: {name,score,mode,detail})

   Storage is a single KV key holding the whole board. That keeps a
   submission to one read + one write, which matters: the free tier allows
   ~1000 KV writes/day and each submission costs two (board + rate limit).

   Consistency caveat: KV is eventually consistent, so two submissions landing
   in the same instant can drop one of them. For an arcade board that is a fair
   trade for staying free; fixing it properly needs Durable Objects.
   ============================================================ */

const BOARD_KEY = 'board:v1';
const MAX_PER_MODE = 50;
const MODES = ['classic', 'gauntlet'];

// Ceilings exist to reject junk like 1e30, not to police skill. A perfect
// classic run scores ~1090 and a perfect gauntlet ~4500, so these are far
// above anything reachable while still bounding the field.
const MAX_SCORE = { classic: 5000, gauntlet: 50000 };

const RATE_LIMIT = 20;      // submissions per IP...
const RATE_WINDOW = 3600;   // ...per hour

const ALLOWED_ORIGINS = [
  'https://lewismconte.github.io',
  'http://localhost:8642',
  'http://127.0.0.1:8642',
];

/* ---------- helpers ---------- */

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

// Initials are rendered into the page, so they are restricted to a charset
// that cannot carry markup no matter how the client escapes it.
function cleanName(raw) {
  const n = String(raw == null ? '' : raw)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);
  return n || 'AAA';
}

// Same reasoning for the detail line: allow letters, digits, spaces and a
// little punctuation, nothing that can open a tag or an entity.
function cleanDetail(raw) {
  return String(raw == null ? '' : raw)
    .replace(/[^A-Za-z0-9 ,.\-/]/g, '')
    .trim()
    .slice(0, 60);
}

// Run time in whole seconds. Rejected outright rather than clamped: a value
// outside this range means the client is broken or lying, and a silently
// clamped 0 would sit at the top of the time board forever. Null is fine —
// entries from before the clock existed simply have no time.
const MAX_TIME = 24 * 3600;
function cleanTime(raw) {
  const t = Math.round(Number(raw));
  return Number.isFinite(t) && t > 0 && t <= MAX_TIME ? t : null;
}

const BLOCKED = ['ASS', 'FUK', 'FUC', 'CUM', 'JEW', 'NIG', 'FAG', 'TIT', 'SEX', 'GAY', 'KKK', 'DIE'];

function readBoard(env) {
  return env.BOARD.get(BOARD_KEY, 'json').then(b => {
    const out = {};
    for (const m of MODES) out[m] = Array.isArray(b && b[m]) ? b[m] : [];
    return out;
  });
}

/* ---------- handlers ---------- */

async function handleScore(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'bad json' }, 400, origin);
  }

  const mode = MODES.includes(body.mode) ? body.mode : null;
  const score = Number(body.score);
  if (!mode) return json({ ok: false, error: 'bad mode' }, 400, origin);
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE[mode]) {
    return json({ ok: false, error: 'bad score' }, 400, origin);
  }

  const name = cleanName(body.name);
  if (BLOCKED.includes(name)) return json({ ok: false, error: 'pick other initials' }, 400, origin);

  // per-IP throttle, so one person cannot flood all 50 slots
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + ip;
  const used = parseInt((await env.BOARD.get(rlKey)) || '0', 10);
  if (used >= RATE_LIMIT) {
    return json({ ok: false, error: 'too many submissions, try later' }, 429, origin);
  }

  const board = await readBoard(env);
  const entry = {
    name,
    score,
    detail: cleanDetail(body.detail),
    time: cleanTime(body.time),
    won: body.won === true,
    date: new Date().toISOString().slice(0, 10),
  };

  // Canonical order stays score-descending, so which 50 survive does not change.
  // Ranking by time is a view the client applies over these same entries.
  board[mode] = board[mode]
    .concat([entry])
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PER_MODE);

  await env.BOARD.put(BOARD_KEY, JSON.stringify(board));
  await env.BOARD.put(rlKey, String(used + 1), { expirationTtl: RATE_WINDOW });

  const rank = board[mode].findIndex(e => e === entry);
  return json({ ok: true, rank: rank < 0 ? null : rank + 1, board }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (url.pathname === '/board' && request.method === 'GET') {
      return json(await readBoard(env), 200, origin);
    }
    if (url.pathname === '/score' && request.method === 'POST') {
      return handleScore(request, env, origin);
    }
    return json({ ok: false, error: 'not found' }, 404, origin);
  },
};
