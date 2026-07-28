# Leaderboard worker

A tiny Cloudflare Worker so players can submit scores **without a GitHub
account**. The game itself stays on GitHub Pages; only the write path needs a
server, because a static host cannot accept a POST.

Free tier is roughly 100k requests/day and 1k KV writes/day. Each submission
costs two writes (board + rate limit), so ~500 submissions/day — far more than
this game will ever see. No credit card required.

## Deploy

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. From this `worker/` directory:

   ```bash
   npx wrangler login
   ```

   That opens your browser to authorise the CLI.

3. Create the storage namespace:

   ```bash
   npx wrangler kv namespace create BOARD
   ```

   Copy the printed `id` into `wrangler.toml`, replacing `PASTE_KV_NAMESPACE_ID_HERE`.

4. Ship it:

   ```bash
   npx wrangler deploy
   ```

   Wrangler prints a URL like `https://scoundrel-board.<your-subdomain>.workers.dev`.

5. Put that URL into `BOARD_API` at the top of the leaderboard section in
   `../js/ui.js`, then commit and push.

This repo's copy already points at a deployed Worker. The steps above are for
running your own — fork the game, deploy, and swap `BOARD_API`. Leave it empty
and the game falls back to the old GitHub-issue flow instead, so nothing breaks.

## Endpoints

| Method | Path     | Purpose                                                     |
| ------ | -------- | ----------------------------------------------------------- |
| `GET`  | `/board` | `{ classic: [...], gauntlet: [...] }`                        |
| `POST` | `/score` | body `{name, score, mode, detail, time, won}` → `{ok, rank}` |

`time` is the run in whole seconds and `won` says whether it was completed.
Both are optional — entries submitted before the clock existed simply have
`time: null`, and the board renders them with a dash.

Stored order is always score-descending, so which 50 entries survive does not
depend on the clock. Ranking by time is a view the game applies over the same
entries, and it only ranks runs where `won` is true: dying in the first room is
the fastest way to the bottom of the dungeon, and it should not top a board.

## What it rejects

Initials are forced to `[A-Z0-9]{1,3}` and detail lines to a punctuation-free
charset, so neither can carry markup into the page. Scores must be integers
within a per-mode ceiling (well above a perfect run — the point is to reject
`1e30`, not to police skill), and each IP is capped at 20 submissions/hour.

Times outside 1s–24h are stored as `null` rather than clamped: an out-of-range
value means the client is broken or lying, and a silently clamped `0` would sit
at the top of the time board forever. `won` must be a real boolean, so a truthy
`"yes"` cannot fake a completed run.

It cannot stop a determined person from POSTing a plausible score directly:
the score is computed on the player's own machine, so no free design can. The
board is honour-system, which is what the in-game note says.

## Editing the board

To wipe or hand-edit scores:

```bash
npx wrangler kv key get --binding=BOARD "board:v1" --remote
npx wrangler kv key put --binding=BOARD "board:v1" '{"classic":[],"gauntlet":[]}' --remote
```
