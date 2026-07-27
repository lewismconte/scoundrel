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

Until `BOARD_API` is filled in, the game automatically falls back to the old
GitHub-issue flow, so nothing breaks in the meantime.

## Endpoints

| Method | Path     | Purpose                                        |
| ------ | -------- | ---------------------------------------------- |
| `GET`  | `/board` | `{ classic: [...], gauntlet: [...] }`          |
| `POST` | `/score` | body `{name, score, mode, detail}` → `{ok, rank}` |

## What it rejects

Initials are forced to `[A-Z0-9]{1,3}` and detail lines to a punctuation-free
charset, so neither can carry markup into the page. Scores must be integers
within a per-mode ceiling (well above a perfect run — the point is to reject
`1e30`, not to police skill), and each IP is capped at 20 submissions/hour.

It cannot stop a determined person from POSTing a plausible score directly:
the score is computed on the player's own machine, so no free design can. The
board is honour-system, which is what the in-game note says.

## Editing the board

To wipe or hand-edit scores:

```bash
npx wrangler kv key get --binding=BOARD "board:v1" --remote
npx wrangler kv key put --binding=BOARD "board:v1" '{"classic":[],"gauntlet":[]}' --remote
```
