/* ============================================================
   DATA — cards, jokers, bosses, floor modifiers, campaigns
   Suits: S♠ C♣ = monsters | D♦ = weapons | H♥ = potions
   Red faces = Allies, Red aces = legendaries, X = the 2 Jokers
   ============================================================ */
const DATA = (() => {

  let _cid = 0;
  const newId = () => 'c' + (++_cid);

  const SUIT_SYM = { S: '♠', C: '♣', H: '♥', D: '♦', X: '🃏' };
  const RANK_SYM = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const rankLabel = r => RANK_SYM[r] || String(r);

  const MONSTERS = {
    2:  { name: 'Rat',          emoji: '🐀' },
    3:  { name: 'Bat',          emoji: '🦇' },
    4:  { name: 'Imp',          emoji: '👿' },
    5:  { name: 'Goblin',       emoji: '👺' },
    6:  { name: 'Skeleton',     emoji: '💀' },
    7:  { name: 'Cultist',      emoji: '🕯️' },
    8:  { name: 'Ghoul',        emoji: '🧟' },
    9:  { name: 'Werewolf',     emoji: '🐺' },
    10: { name: 'Ogre',         emoji: '👹' },
    11: { name: 'Vampire',      emoji: '🧛' },
    12: { name: 'Witch',        emoji: '🧙' },
    13: { name: 'Black Knight', emoji: '🛡️' },
    14: { name: 'Dragon',       emoji: '🐉' },
  };

  const WEAPONS = {
    2:  { name: 'Shiv',       emoji: '🔪' },
    3:  { name: 'Dagger',     emoji: '🗡️' },
    4:  { name: 'Cudgel',     emoji: '🏏' },
    5:  { name: 'Hatchet',    emoji: '🪓' },
    6:  { name: 'Mace',       emoji: '🔨' },
    7:  { name: 'Shortsword', emoji: '🗡️' },
    8:  { name: 'War Axe',    emoji: '🪓' },
    9:  { name: 'Longsword',  emoji: '⚔️' },
    10: { name: 'Greatsword', emoji: '⚔️' },
    14: { name: 'Kingslayer', emoji: '👑' },
  };

  const POTIONS = {
    2:  { name: 'Weak Salve',    emoji: '🧂' },
    3:  { name: 'Herbal Tonic',  emoji: '🌿' },
    4:  { name: 'Red Draught',   emoji: '🧪' },
    5:  { name: 'Healing Brew',  emoji: '⚗️' },
    6:  { name: 'Soothing Balm', emoji: '🫙' },
    7:  { name: 'Vital Serum',   emoji: '💉' },
    8:  { name: 'Crimson Flask', emoji: '🍷' },
    9:  { name: 'Troll Blood',   emoji: '🩸' },
    10: { name: 'Phoenix Tears', emoji: '🔥' },
  };

  // Red face cards + Ace of Hearts = one-shot Allies
  const ALLIES = {
    'D11': { name: 'The Squire',    emoji: '🧰', short: 'degrade reset',   desc: 'Polishes your weapon: degradation reset.', effect: 'polish' },
    'D12': { name: 'The Duchess',   emoji: '💎', short: '+2 pwr, forever', desc: 'Bejewels your weapon: +2 power, permanently.', effect: 'sharpen2' },
    'D13': { name: 'The Blacksmith',emoji: '🔨', short: '+3 pwr & reset',  desc: 'Reforges your weapon: +3 power AND degradation reset.', effect: 'reforge' },
    'H11': { name: 'The Bard',      emoji: '🎻', short: 'heal 7 (free)',   desc: 'A rousing song: heal 7 (ignores potion limit).', effect: 'heal7' },
    'H12': { name: 'The Priestess', emoji: '✨', short: 'heal 10 (free)',  desc: 'A blessing: heal 10 (ignores potion limit).', effect: 'heal10' },
    'H13': { name: 'The Templar',   emoji: '🛡️', short: '+7 shield',       desc: 'Stands guard: gain 7 shield.', effect: 'shield7' },
    'H14': { name: 'Elixir of Life',emoji: '❤️‍🔥', short: 'full heal',      desc: 'Heal to full (ignores potion limit).', effect: 'fullheal' },
    'X0':  { name: 'The Jester',    emoji: '🃏', short: 'random Joker!',   desc: 'Grants a random Joker! (+15 gold if your slots are full)', effect: 'jester' },
  };

  function kindOf(suit, rank) {
    if (suit === 'X') return 'wild';
    if (suit === 'S' || suit === 'C') return 'monster';
    if (suit === 'D') return (rank >= 11 && rank <= 13) ? 'ally' : 'weapon'; // A♦ = 14 weapon
    if (suit === 'H') return (rank >= 11) ? 'ally' : 'potion';               // A♥ = ally (elixir)
    return 'monster';
  }

  function makeCard(suit, rank) {
    return { id: newId(), suit, rank, kind: kindOf(suit, rank) };
  }
  function cloneCard(c) {
    return { ...c, id: newId() };
  }

  function cardName(c) {
    if (c.kind === 'monster') return MONSTERS[c.rank].name;
    if (c.kind === 'weapon')  return WEAPONS[c.rank].name;
    if (c.kind === 'potion')  return POTIONS[c.rank].name;
    const a = ALLIES[c.suit + c.rank];
    return a ? a.name : '???';
  }
  function cardEmoji(c) {
    if (c.kind === 'monster') return MONSTERS[c.rank].emoji;
    if (c.kind === 'weapon')  return WEAPONS[c.rank].emoji;
    if (c.kind === 'potion')  return POTIONS[c.rank].emoji;
    const a = ALLIES[c.suit + c.rank];
    return a ? a.emoji : '❓';
  }
  function allyDef(c) { return ALLIES[c.suit + c.rank]; }

  // classic Scoundrel deck: 44 cards (no red faces, no red aces, no jokers)
  function classicPool() {
    const pool = [];
    for (const suit of ['S', 'C']) for (let r = 2; r <= 14; r++) pool.push(makeCard(suit, r)); // 26 monsters
    for (let r = 2; r <= 10; r++) pool.push(makeCard('D', r)); // 9 weapons
    for (let r = 2; r <= 10; r++) pool.push(makeCard('H', r)); // 9 potions
    return pool;
  }
  // the full 54: classic + red faces + red aces + 2 jokers
  function full54Pool() {
    const pool = classicPool();
    for (const suit of ['D', 'H']) for (let r = 11; r <= 13; r++) pool.push(makeCard(suit, r));
    pool.push(makeCard('D', 14)); // Kingslayer
    pool.push(makeCard('H', 14)); // Elixir of Life
    pool.push(makeCard('X', 0));  // Jester
    pool.push(makeCard('X', 0));  // Jester
    return pool;
  }

  /* ---------------- JOKERS (passive relics) ---------------- */
  const JOKERS = [
    { id: 'whetstone', name: 'Whetstone',       emoji: '🪨', cost: 22, desc: 'Your weapon can also slay monsters of EQUAL value to its last kill.' },
    { id: 'fang',      name: 'Vampire Fang',    emoji: '🦷', cost: 25, desc: 'Heal 1 whenever you slay with your weapon.' },
    { id: 'knuckles',  name: 'Brass Knuckles',  emoji: '👊', cost: 20, desc: 'Barehanded fights: take 2 less damage.' },
    { id: 'herbalist', name: 'Herbalist',       emoji: '🌿', cost: 22, desc: 'You can drink 2 potions per room.' },
    { id: 'coin',      name: 'Lucky Coin',      emoji: '🪙', cost: 18, desc: '+1 gold for every monster slain.' },
    { id: 'map',       name: 'Cartographer',    emoji: '🗺️', cost: 16, desc: 'You may flee rooms twice in a row.' },
    { id: 'pact',      name: 'Blood Pact',      emoji: '🩸', cost: 24, desc: '+5 max HP (and heal 5 when acquired).' },
    { id: 'adrenaline',name: 'Adrenaline',      emoji: '⚡', cost: 18, desc: 'Weapon power +3 while you are at 5 HP or less.' },
    { id: 'flask',     name: 'Bottomless Flask',emoji: '🍶', cost: 20, desc: 'Potions heal +2.' },
    { id: 'tax',       name: 'Tax Collector',   emoji: '💰', cost: 18, desc: 'Bosses drop DOUBLE gold.' },
    { id: 'idol',      name: 'Cursed Idol',     emoji: '🗿', cost: 15, desc: '+2 gold per slain monster, but −3 max HP.' },
    { id: 'duelist',   name: "Duelist's Code",  emoji: '🤺', cost: 17, desc: '+5 gold when your weapon slays a monster of value 10+.' },
    { id: 'alchemist', name: 'Alchemist',       emoji: '⚗️', cost: 15, desc: 'Wasted potions turn into gold (half their value).' },
    { id: 'angel',     name: 'Guardian Angel',  emoji: '👼', cost: 30, desc: 'Once per floor: fatal damage leaves you at 1 HP instead.' },
    { id: 'berserk',   name: 'Berserker',       emoji: '😤', cost: 20, desc: 'Barehanded slays earn bonus gold equal to the monster\'s value.' },
    { id: 'quarter',   name: 'Quartermaster',   emoji: '🎖️', cost: 22, desc: 'Start every floor with 5 shield.' },
    { id: 'mirror',    name: 'Mirror Plate',    emoji: '🪞', cost: 24, desc: 'The first damage you take each room is reduced by 3.' },
    { id: 'oil',       name: 'Oiled Blade',     emoji: '🛢️', cost: 26, desc: 'Only monsters of value 8+ degrade your weapon.' },
    { id: 'piggy',     name: 'Piggy Bank',      emoji: '🐷', cost: 15, desc: 'Entering a shop: +1 gold per 10 held (max +5).' },
    { id: 'key',       name: 'Skeleton Key',    emoji: '🗝️', cost: 12, desc: 'Your first shop reroll is free, every shop.' },
    { id: 'cloak',     name: 'Phantom Cloak',   emoji: '👻', cost: 14, desc: 'Heal 2 whenever you flee a room.' },
    { id: 'crown',     name: 'Crown of Greed',  emoji: '👑', cost: 16, desc: 'Floor-clear bonus: +10 extra gold.' },
  ];
  const jokerById = id => JOKERS.find(j => j.id === id);

  /* ---------------- BOSSES (one per act) ---------------- */
  const BOSSES = [
    {
      id: 'gatekeeper', name: 'THE GATEKEEPER', emoji: '🧌',
      hp: 25, power: 4, gold: 25,
      trait: 'Enrage — at half HP its Power increases by 2.',
    },
    {
      id: 'plaguedoctor', name: 'THE PLAGUE DOCTOR', emoji: '🐦‍⬛',
      hp: 35, power: 5, gold: 40,
      trait: 'Miasma — potions only heal HALF during this fight.',
    },
    {
      id: 'scoundrelking', name: 'THE SCOUNDREL KING', emoji: '🎭',
      hp: 48, power: 6, gold: 60,
      trait: 'Long Live the King — regenerates 3 HP and gains +1 Power every wave.',
    },
  ];

  /* ---------------- FLOOR MODIFIERS ---------------- */
  const FLOORMODS = [
    { id: 'plague',   name: 'Plague',       emoji: '☠️', desc: 'Potions only heal half (rounded down).' },
    { id: 'horde',    name: 'Horde',        emoji: '🧟', desc: '4 extra monsters lurk on this floor.' },
    { id: 'brittle',  name: 'Brittle Steel',emoji: '🧊', desc: 'Weapons shatter after 3 kills.' },
    { id: 'darkness', name: 'Darkness',     emoji: '🌑', desc: 'Rooms only hold 3 cards.' },
    { id: 'bloodmoon',name: 'Blood Moon',   emoji: '🌕', desc: 'Monsters +1 value, but slays give +2 gold.' },
  ];
  const modById = id => FLOORMODS.find(m => m.id === id);

  /* ---------------- CAMPAIGNS ---------------- */
  const CAMPAIGNS = [
    {
      id: 'classic', name: 'The Classic Crawl', emoji: '🏰', diff: 'BALANCED',
      desc: 'The original 44-card dungeon. 20 HP. Build your legend from nothing.',
      hp: 20, gold: 0, pool: 'classic', startJokers: 0, monsterBonus: 0,
    },
    {
      id: 'knave', name: "Knave's Gauntlet", emoji: '🎲', diff: 'TRICKY',
      desc: 'Start with a random Joker and 20 gold — but only 15 max HP.',
      hp: 15, gold: 20, pool: 'classic', startJokers: 1, monsterBonus: 0,
    },
    {
      id: 'full54', name: 'The Full 54', emoji: '🃏', diff: 'CHAOTIC',
      desc: 'Every card in the deck — Allies, red Aces, both Jesters. But all monsters hit +1 harder.',
      hp: 20, gold: 0, pool: 'full54', startJokers: 0, monsterBonus: 1,
    },
  ];
  const campaignById = id => CAMPAIGNS.find(c => c.id === id);

  /* ---------------- SHOP card offerings ---------------- */
  function randomShopCard(rng) {
    const roll = rng();
    if (roll < 0.30) { // weapon 4-10
      const r = 4 + Math.floor(rng() * 7);
      return { card: makeCard('D', r), price: r + 2 };
    } else if (roll < 0.60) { // potion 4-10
      const r = 4 + Math.floor(rng() * 7);
      return { card: makeCard('H', r), price: r + 1 };
    } else if (roll < 0.85) { // ally
      const opts = ['D11', 'D12', 'D13', 'H11', 'H12', 'H13'];
      const k = opts[Math.floor(rng() * opts.length)];
      return { card: makeCard(k[0], parseInt(k.slice(1))), price: 15 + (parseInt(k.slice(1)) - 11) * 3 };
    } else if (roll < 0.95) { // red ace
      const k = rng() < 0.5 ? ['D', 14] : ['H', 14];
      return { card: makeCard(k[0], k[1]), price: 30 };
    }
    return { card: makeCard('X', 0), price: 25 }; // the Jester
  }

  return {
    SUIT_SYM, rankLabel, MONSTERS, WEAPONS, POTIONS, ALLIES,
    JOKERS, jokerById, BOSSES, FLOORMODS, modById, CAMPAIGNS, campaignById,
    makeCard, cloneCard, cardName, cardEmoji, allyDef,
    classicPool, full54Pool, randomShopCard, newId,
  };
})();
