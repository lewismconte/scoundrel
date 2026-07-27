# SCOUNDREL — a dungeon crawling card game

A dungeon crawling card game built on top of **Scoundrel** (the 2011 solo card-crawl by
Zach Gage & Kurt Bieg), wearing its best **Balatro** outfit. Zero build step, zero
dependencies — double-click `index.html` and play.

**Two modes:**

- **CLASSIC RUN** — the original game, faithfully: one 44-card dungeon, no shops, no
  bosses, no mercy. Scored for the leaderboard, so everyone competes on the same deck.
- **THE GAUNTLET** — the full ride: 3 acts × (2 floors + a boss), 23 Jokers, shops and
  deckbuilding. Starts at an outfitting camp where your first pick is free, and **the deck
  grows as you descend**: 44 cards in Act I, the court joins for Act II (49), and the crown
  jewels complete the full 54 in Act III — right as the monsters toughen up.

**Arcade extras:** runs autosave to your device (continue any time), and there's a global
**top-50 leaderboard per mode** — powered entirely by GitHub: submitting a score opens a
pre-filled GitHub issue, a bot validates it, commits it to `leaderboard.json`, and Pages
serves the updated board. No server, no database, no running costs.

## How to run

Open `index.html` in any modern browser. That's it. (For dev, any static server works:
`python -m http.server --directory scoundrel`.) Plays on **desktop and mobile** — the
layout reflows to a stacked, thumb-friendly view on phones, and there's a **fullscreen**
button in the sidebar next to mute.

## The game

**Core Scoundrel rules, kept faithful:**

- The dungeon is a deck. Each **room** deals 4 cards; resolve them one at a time and the
  last one carries into the next room.
- **♠ ♣ are monsters** — fight barehanded (take full value) or with a weapon (take value −
  power). Weapons **degrade**: each kill must be *weaker than the last*.
- **♦ are weapons**, **♥ are potions** (only the first potion per room works).
- You may **flee** an untouched room — never twice in a row.

**The roguelike layer:**

- **3 acts × (2 floors + a boss)**. Floors are your dungeon deck reshuffled; clearing one
  earns gold and opens the shop.
- **22 Jokers** — passive relics in the Balatro sense (Whetstone, Vampire Fang, Guardian
  Angel, Oiled Blade…). Five slots. Choose them well.
- **The Smuggler's Camp** between floors: buy Jokers, add cards to your deck, remove cards
  from it, patch up, reroll the wares.
- **All 54 cards** exist: red face cards are one-shot **Allies** (The Blacksmith reforges
  your weapon, The Templar grants shield…), red aces are legendaries (the **Kingslayer**,
  the **Elixir of Life**), and the two printed Jokers are **Jesters** that grant a random
  Joker on sight.
- **Bosses** end each act: waves of 3 actions — spend them on room cards or **STRIKE** —
  then the boss hits back. Each has a gimmick (Enrage / Miasma / royal escalation).
- **Floor modifiers** from Act II (Plague, Horde, Brittle Steel, Darkness, Blood Moon).

**Campaigns:** The Classic Crawl (pure 44), Knave's Gauntlet (Joker head-start, 15 HP),
The Full 54 (everything in the deck, monsters +1).

## Art direction

Pixel art, generated at runtime — no sprite sheets:

- All creature/item art is **emoji rasterized at ~14px onto a canvas**, alpha-crunched
  (hard edges) and posterized (6 levels/channel), then scaled up with
  `image-rendering: pixelated`. Instant 16×16-style sprites for every card, joker and boss.
- Suit symbols are hand-drawn **8×8 pixel maps** in `js/pixel.js`.
- Fonts: **Jersey 10** (display) + **Silkscreen** (body), flat colours, hard offset
  shadows, bevelled panels, dithered checkerboard felt, scanlines. Motion stays smooth —
  pixel assets, Balatro juice.
- **The table is laid out like the printed rules diagram**: face-down Dungeon pile on the
  left, the room of 4, face-up Discard on the right, weapon-in-play with its fan of slain
  monsters beneath. Click either pile to browse it.
- **Cards physically fly**: deals stream out of the Dungeon pile, slain monsters land on
  your weapon stack, potions fly into your HP, barehanded monsters lunge at you, Jesters
  fly to the joker bar, and fleeing hurls the whole room back into the deck.
- **Q/K/A monsters are minibosses**: black-hole aura — stepped-rotation vortex, collapsing
  suction rings, dark wisps pulled in from the felt, and a pulsing dread glow.
- **Mobile**: on ≤720px the desktop row becomes a compact top vitals bar + a stacked table
  (piles on top, room in a 2×2 grid, weapon below). Hover tooltips become **tap-to-reveal**
  on touch devices so Joker text is reachable by thumb, and `touch-action` kills the tap
  delay. Fullscreen button hides itself on devices that can't fullscreen an element (iPhone).

## Files

```
index.html      shell
style.css       the felt, the cards, the pixels
js/pixel.js     runtime pixel-sprite pipeline (emoji → crunched canvas + suit maps)
js/sfx.js       synthesized Web Audio sound effects
js/data.js      cards, jokers, bosses, modifiers, campaigns
js/engine.js    game rules + state machine (emits events)
js/ui.js        rendering, floaters, shake, particles, modals
js/main.js      boot & wiring
```

Stats and mute preference persist in `localStorage`.

## Credits

- Scoundrel rules by **Zach Gage & Kurt Bieg** ([rules PDF](http://stfj.net/art/2011/Scoundrel.pdf))
- Feel and juice principles inspired by **Balatro** (LocalThunk) and the
  [Balatro-Feel](https://github.com/mixandjam/Balatro-Feel) breakdown by mixandjam
