/* ============================================================
   ENGINE — game state + rules
   Core Scoundrel: rooms of 4, resolve 3 & carry 1, flee rules,
   weapon degradation, one potion per room.
   Roguelike layer: 3 acts × (2 floors + boss), jokers, gold, shop.

   The engine mutates S and emits events; UI drains them to
   render juice (floaters, shake, particles).
   ============================================================ */
const S = {}; // run state (global on purpose — it's a toy)

const E = (() => {

  /* ---------- utils ---------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- event queue (drained by UI) ---------- */
  let evq = [];
  const emit = (type, data = {}) => evq.push({ type, ...data });
  const drain = () => { const q = evq; evq = []; return q; };

  /* ---------- meta stats (localStorage) ---------- */
  function loadMeta() {
    try { return JSON.parse(localStorage.getItem('scoundrel_meta')) || {}; } catch (e) { return {}; }
  }
  function saveMeta(patch) {
    const m = loadMeta();
    Object.assign(m, patch);
    localStorage.setItem('scoundrel_meta', JSON.stringify(m));
    return m;
  }

  /* ---------- joker helpers ---------- */
  const hasJoker = id => S.jokers && S.jokers.includes(id);

  function addJoker(id) {
    S.jokers.push(id);
    if (id === 'pact') { S.maxHp += 5; S.hp += 5; }
    if (id === 'idol') { S.maxHp = Math.max(1, S.maxHp - 3); S.hp = clamp(S.hp, 1, S.maxHp); }
    emit('jokerGained', { id });
  }
  function removeJoker(id) {
    const i = S.jokers.indexOf(id);
    if (i < 0) return;
    S.jokers.splice(i, 1);
    if (id === 'pact') { S.maxHp = Math.max(1, S.maxHp - 5); S.hp = clamp(S.hp, 1, S.maxHp); }
    if (id === 'idol') { S.maxHp += 3; }
  }
  function unownedJokers() { return DATA.JOKERS.filter(j => !hasJoker(j.id)); }

  /* ---------- derived values ---------- */
  function monsterBonus() {
    let b = S.campaign.monsterBonus + (S.act >= 3 ? 1 : 0);
    if (S.floorMod === 'bloodmoon') b += 1;
    return b;
  }
  function effRank(card) {
    return card.kind === 'monster' ? card.rank + monsterBonus() : card.rank;
  }
  function weaponPower() {
    if (!S.weapon) return 0;
    let p = S.weapon.card.rank + S.weapon.bonus;
    if (hasJoker('adrenaline') && S.hp <= 5) p += 3;
    return p;
  }
  function canUseWeapon(card) {
    if (!S.weapon) return false;
    const m = effRank(card);
    if (S.weapon.lastSlain == null) return true;
    return hasJoker('whetstone') ? m <= S.weapon.lastSlain : m < S.weapon.lastSlain;
  }
  function previewDamage(card, mode) {
    const m = effRank(card);
    if (mode === 'weapon') return Math.max(0, m - weaponPower());
    return Math.max(0, m - (hasJoker('knuckles') ? 2 : 0));
  }
  function potionHeal(card) {
    let h = card.rank + (hasJoker('flask') ? 2 : 0);
    if (S.floorMod === 'plague') h = Math.floor(h / 2);
    if (S.boss && S.boss.id === 'plaguedoctor') h = Math.floor(h / 2);
    return h;
  }
  function strikeDamage() { return S.weapon ? weaponPower() : 2; }
  function roomSize() { return S.floorMod === 'darkness' ? 3 : 4; }
  function canFlee() {
    return !S.boss && !S.over && S.room.length > 0 && S.roomResolved === 0 &&
      (!S.fledLast || hasJoker('map'));
  }

  /* ============================================================
     RUN LIFECYCLE
     ============================================================ */
  function newRun(campId) {
    const camp = DATA.campaignById(campId);
    Object.assign(S, {
      campaign: camp,
      act: 1, stage: 0, floorNum: 0,
      maxHp: camp.hp, hp: camp.hp, shield: 0, gold: camp.gold,
      weapon: null,
      jokers: [], jokerSlots: 5,
      pool: camp.pool === 'full54' ? DATA.full54Pool() : DATA.classicPool(),
      deck: [], room: [], discard: [],
      fledLast: false, potionsThisRoom: 0, roomResolved: 0,
      mirrorUsed: false, angelUsed: false,
      floorMod: null,
      boss: null, actionsLeft: 0, bossDeck: [], bossDiscard: [],
      shop: null,
      stats: { kills: 0, bareKills: 0, dmgTaken: 0, healed: 0, goldEarned: 0, floors: 0, bosses: 0, fled: 0 },
      over: false,
    });
    saveMeta({ runs: (loadMeta().runs || 0) + 1 });
    for (let i = 0; i < camp.startJokers; i++) {
      const opts = unownedJokers();
      addJoker(opts[Math.floor(Math.random() * opts.length)].id);
    }
    startFloor();
    UI.showScreen('game');
  }

  function startFloor() {
    S.floorNum++;
    S.boss = null;
    S.floorMod = (S.act >= 2) ? DATA.FLOORMODS[Math.floor(Math.random() * DATA.FLOORMODS.length)].id : null;
    S.deck = shuffle(S.pool.map(DATA.cloneCard));
    if (S.floorMod === 'horde') {
      for (let i = 0; i < 4; i++) {
        S.deck.push(DATA.makeCard(Math.random() < 0.5 ? 'S' : 'C', 5 + Math.floor(Math.random() * 6)));
      }
      shuffle(S.deck);
    }
    S.room = [];
    S.discard = [];
    S.fledLast = false;
    S.angelUsed = false;
    if (S.weapon) S.weapon.kills = 0; // brittle counts per-floor
    if (hasJoker('quarter')) S.shield = Math.max(S.shield, 5);
    dealRoom();
    emit('floorStart');
    UI.showScreen('game');
    UI.renderAll(true);
  }

  function dealRoom() {
    while (S.room.length < roomSize() && S.deck.length > 0) {
      S.room.push(S.deck.pop());
    }
    S.roomResolved = 0;
    S.potionsThisRoom = 0;
    S.mirrorUsed = false;
  }

  /* ============================================================
     DAMAGE / HEAL / GOLD
     ============================================================ */
  function applyMirror(dmg) {
    if (dmg > 0 && hasJoker('mirror') && !S.mirrorUsed) {
      S.mirrorUsed = true;
      const nd = Math.max(0, dmg - 3);
      if (nd < dmg) emit('mirror', { blocked: dmg - nd });
      return nd;
    }
    return dmg;
  }

  function takeDamage(dmg, src) {
    if (dmg <= 0) { emit('nodmg', { src }); return; }
    if (S.shield > 0) {
      const sa = Math.min(S.shield, dmg);
      S.shield -= sa; dmg -= sa;
      emit('shieldHit', { amt: sa });
    }
    if (dmg <= 0) return;
    S.hp -= dmg;
    S.stats.dmgTaken += dmg;
    emit('dmg', { amt: dmg, src });
    if (S.hp <= 0) {
      if (hasJoker('angel') && !S.angelUsed) {
        S.hp = 1; S.angelUsed = true;
        emit('saved');
      } else {
        die();
      }
    }
  }

  function heal(amt) {
    const h = Math.min(amt, S.maxHp - S.hp);
    if (h > 0) { S.hp += h; S.stats.healed += h; emit('heal', { amt: h }); }
    else emit('healFull');
    return h;
  }

  function addGold(amt) {
    if (amt <= 0) return;
    S.gold += amt;
    S.stats.goldEarned += amt;
    emit('gold', { amt });
  }

  function die() {
    S.over = true;
    const m = loadMeta();
    saveMeta({ deaths: (m.deaths || 0) + 1, bestFloor: Math.max(m.bestFloor || 0, S.floorNum) });
    emit('death');
  }

  /* ============================================================
     CARD RESOLUTION
     ============================================================ */
  // resolved cards go face-up on the discard (boss fights recycle theirs)
  function discardPush(...cards) {
    (S.boss ? S.bossDiscard : S.discard).push(...cards);
  }

  function resolveCard(id, choice) {
    if (S.over) return drain();
    const idx = S.room.findIndex(c => c.id === id);
    if (idx < 0) return drain();
    const card = S.room[idx];

    let staysInPlay = false; // on the weapon stack or equipped — not discarded yet
    if (card.kind === 'monster') {
      if (choice === 'weapon' && !canUseWeapon(card)) return drain(); // stale click
      const mode = choice === 'weapon' ? 'weapon' : 'bare';
      fight(card, mode);
      staysInPlay = mode === 'weapon'; // (a shattered weapon discards its own stack)
    } else if (card.kind === 'weapon') {
      equip(card);
      staysInPlay = true;
    } else if (card.kind === 'potion') {
      drink(card);
    } else if (card.kind === 'ally') {
      allyEffect(card);
    } else if (card.kind === 'wild') {
      jester();
    }

    const i2 = S.room.findIndex(c => c.id === id);
    if (i2 >= 0) S.room.splice(i2, 1);
    S.roomResolved++;
    if (!staysInPlay) discardPush(card);

    if (!S.over) afterResolve();
    return drain();
  }

  function fight(card, mode) {
    const m = effRank(card);
    let dmg;
    if (mode === 'weapon') {
      dmg = Math.max(0, m - weaponPower());
      if (!hasJoker('oil') || m >= 8) S.weapon.lastSlain = m;
      S.weapon.kills++;
      S.weapon.stack.push(card);
      emit('slay', { card, mode, dmg });
      if (hasJoker('fang')) heal(1);
    } else {
      dmg = Math.max(0, m - (hasJoker('knuckles') ? 2 : 0));
      emit('slay', { card, mode, dmg });
      S.stats.bareKills++;
    }
    dmg = applyMirror(dmg);
    takeDamage(dmg, 'monster');
    if (S.over) return;

    // gold for the kill
    let g = Math.ceil(m / 2);
    if (hasJoker('coin')) g += 1;
    if (hasJoker('idol')) g += 2;
    if (hasJoker('duelist') && mode === 'weapon' && m >= 10) g += 5;
    if (hasJoker('berserk') && mode === 'bare') g += m;
    if (S.floorMod === 'bloodmoon') g += 2;
    addGold(g);
    S.stats.kills++;

    // brittle steel: weapon shatters after 3 kills
    if (mode === 'weapon' && S.floorMod === 'brittle' && S.weapon.kills >= 3) {
      discardPush(S.weapon.card, ...S.weapon.stack);
      S.weapon = null;
      emit('shatter');
    }
  }

  function equip(card) {
    if (S.weapon) discardPush(S.weapon.card, ...S.weapon.stack);
    S.weapon = { card, bonus: 0, lastSlain: null, kills: 0, stack: [] };
    emit('equip', { card });
  }

  function drink(card) {
    const limit = hasJoker('herbalist') ? 2 : 1;
    if (S.potionsThisRoom >= limit) {
      emit('wasted', { card });
      if (hasJoker('alchemist')) addGold(Math.ceil(card.rank / 2));
      return;
    }
    S.potionsThisRoom++;
    heal(potionHeal(card));
  }

  function allyEffect(card) {
    const def = DATA.allyDef(card);
    emit('ally', { card });
    switch (def.effect) {
      case 'polish':
        if (S.weapon) { S.weapon.lastSlain = null; emit('polish'); }
        else emit('noWeapon');
        break;
      case 'sharpen2':
        if (S.weapon) { S.weapon.bonus += 2; emit('sharpen', { amt: 2 }); }
        else emit('noWeapon');
        break;
      case 'reforge':
        if (S.weapon) { S.weapon.bonus += 3; S.weapon.lastSlain = null; emit('sharpen', { amt: 3 }); }
        else emit('noWeapon');
        break;
      case 'heal7': heal(7); break;
      case 'heal10': heal(10); break;
      case 'shield7': S.shield += 7; emit('shield', { amt: 7 }); break;
      case 'fullheal': heal(S.maxHp); break;
      case 'jester': jester(); break;
    }
  }

  function jester() {
    const opts = unownedJokers();
    if (S.jokers.length < S.jokerSlots && opts.length > 0) {
      const j = opts[Math.floor(Math.random() * opts.length)];
      addJoker(j.id);
      emit('jester', { joker: j });
    } else {
      addGold(15);
      emit('jester', { gold: 15 });
    }
  }

  function afterResolve() {
    if (S.boss) {
      S.actionsLeft--;
      if (S.actionsLeft <= 0) bossTurn();
      return;
    }
    if (S.room.length <= 1 && S.deck.length > 0) {
      S.fledLast = false; // a room was survived honestly
      dealRoom();
      emit('newRoom');
    } else if (S.deck.length === 0 && S.room.length === 0) {
      floorCleared();
    }
  }

  function flee() {
    if (!canFlee()) return drain();
    S.deck.unshift(...shuffle(S.room.slice())); // to the bottom (we pop from the end)
    S.room = [];
    S.stats.fled++;
    emit('fled');
    if (hasJoker('cloak')) heal(2);
    dealRoom();
    S.fledLast = true;
    return drain();
  }

  function floorCleared() {
    S.stats.floors++;
    const m = loadMeta();
    saveMeta({ bestFloor: Math.max(m.bestFloor || 0, S.floorNum) });
    let bonus = 10 + (hasJoker('crown') ? 10 : 0);
    addGold(bonus);
    emit('floorClear', { bonus });
  }

  /* ============================================================
     BOSS FIGHTS
     ============================================================ */
  function startBoss() {
    const def = DATA.BOSSES[S.act - 1];
    S.floorMod = null;
    S.boss = { ...def, maxHp: def.hp, hp: def.hp, wave: 1, enraged: false };
    S.angelUsed = false;
    if (S.weapon) S.weapon.kills = 0;
    if (hasJoker('quarter')) S.shield = Math.max(S.shield, 5);

    // small recycling deck of minions & supplies
    const bd = [];
    for (let i = 0; i < 8; i++) bd.push(DATA.makeCard(Math.random() < 0.5 ? 'S' : 'C', 4 + Math.floor(Math.random() * 6)));
    bd.push(DATA.makeCard('D', 5), DATA.makeCard('D', 7));
    bd.push(DATA.makeCard('H', 5), DATA.makeCard('H', 7));
    S.bossDeck = shuffle(bd);
    S.bossDiscard = [];
    S.deck = []; S.room = [];
    dealBossRoom();
    S.actionsLeft = 3;
    emit('bossStart', { boss: def });
    UI.showScreen('game');
    UI.renderAll(true);
    UI.bossSplash(def);
  }

  function dealBossRoom() {
    while (S.room.length < 4 && (S.bossDeck.length > 0 || S.bossDiscard.length > 1)) {
      if (S.bossDeck.length === 0) {
        S.bossDeck = shuffle(S.bossDiscard.map(DATA.cloneCard));
        S.bossDiscard = [];
      }
      S.room.push(S.bossDeck.pop());
    }
    S.potionsThisRoom = 0;
    S.mirrorUsed = false;
    S.roomResolved = 0;
  }

  function strikeBoss() {
    if (!S.boss || S.over || S.actionsLeft <= 0) return drain();
    const dmg = strikeDamage();
    S.boss.hp -= dmg;
    emit('bossDmg', { amt: dmg });
    if (S.boss.hp <= 0) { bossDefeated(); return drain(); }
    checkEnrage();
    S.actionsLeft--;
    if (S.actionsLeft <= 0) bossTurn();
    return drain();
  }

  function checkEnrage() {
    if (S.boss && S.boss.id === 'gatekeeper' && !S.boss.enraged && S.boss.hp <= S.boss.maxHp / 2) {
      S.boss.enraged = true;
      S.boss.power += 2;
      emit('enrage');
    }
  }

  function bossTurn() {
    const b = S.boss;
    let dmg = applyMirror(b.power);
    emit('bossAttack', { amt: dmg });
    takeDamage(dmg, 'boss');
    if (S.over) return;
    // next wave
    b.wave++;
    if (b.id === 'scoundrelking') {
      const regen = Math.min(3, b.maxHp - b.hp);
      if (regen > 0) { b.hp += regen; emit('bossRegen', { amt: regen }); }
      b.power++;
      emit('escalate', { power: b.power });
    }
    dealBossRoom();
    S.actionsLeft = 3;
    emit('wave', { wave: b.wave });
  }

  function bossDefeated() {
    const def = S.boss;
    S.stats.bosses++;
    S.boss = null;
    S.room = [];
    let g = def.gold * (hasJoker('tax') ? 2 : 1);
    addGold(g);
    heal(8);
    emit('bossDead', { boss: def, gold: g });
    if (S.act >= 3) {
      victory();
    } else {
      // reward: pick 1 of 3 jokers, or take gold
      const opts = shuffle(unownedJokers().slice()).slice(0, 3);
      S.pendingReward = { jokers: opts, gold: 25 };
      emit('reward', { jokers: opts, gold: 25 });
    }
  }

  function pickReward(jokerId) {
    if (!S.pendingReward) return drain();
    if (jokerId && S.jokers.length < S.jokerSlots) {
      addJoker(jokerId);
    } else {
      addGold(S.pendingReward.gold);
    }
    S.pendingReward = null;
    return drain();
  }

  function victory() {
    S.over = true;
    const m = loadMeta();
    saveMeta({ wins: (m.wins || 0) + 1, bestFloor: Math.max(m.bestFloor || 0, S.floorNum) });
    emit('victory');
  }

  /* ============================================================
     SHOP
     ============================================================ */
  function openShop() {
    let piggy = 0;
    if (hasJoker('piggy')) {
      piggy = Math.min(5, Math.floor(S.gold / 10));
      addGold(piggy);
    }
    S.shop = {
      items: genShopItems(),
      healUses: 3,
      rerolls: 0,
      rerollCost: hasJoker('key') ? 0 : 5,
      removeCost: 12,
    };
    UI.showScreen('shop');
    UI.renderShop();
    if (piggy > 0) UI.floatCenter('🐷 +' + piggy + ' interest', 'gold');
  }

  function genShopItems() {
    const items = [];
    const jopts = shuffle(unownedJokers().slice());
    for (let i = 0; i < 2 && i < jopts.length; i++) {
      items.push({ type: 'joker', joker: jopts[i], price: jopts[i].cost, sold: false });
    }
    while (items.length < 4) {
      const { card, price } = DATA.randomShopCard(Math.random);
      items.push({ type: 'card', card, price, sold: false });
    }
    return items;
  }

  function buyItem(i) {
    const it = S.shop.items[i];
    if (!it || it.sold || S.gold < it.price) { emit('cant'); return drain(); }
    if (it.type === 'joker' && S.jokers.length >= S.jokerSlots) { emit('slotsFull'); return drain(); }
    S.gold -= it.price;
    it.sold = true;
    if (it.type === 'joker') addJoker(it.joker.id);
    else S.pool.push(it.card);
    emit('bought', { item: it });
    return drain();
  }

  function buyHeal() {
    if (S.shop.healUses <= 0 || S.gold < 8 || S.hp >= S.maxHp) { emit('cant'); return drain(); }
    S.gold -= 8;
    S.shop.healUses--;
    heal(5);
    return drain();
  }

  function rerollShop() {
    if (S.gold < S.shop.rerollCost) { emit('cant'); return drain(); }
    S.gold -= S.shop.rerollCost;
    S.shop.rerolls++;
    S.shop.rerollCost = 5 + S.shop.rerolls * 2;
    S.shop.items = genShopItems();
    emit('reroll');
    return drain();
  }

  function removeCardFromPool(cardId) {
    if (S.gold < S.shop.removeCost) { emit('cant'); return drain(); }
    const i = S.pool.findIndex(c => c.id === cardId);
    if (i < 0) return drain();
    S.gold -= S.shop.removeCost;
    const [c] = S.pool.splice(i, 1);
    emit('removed', { card: c });
    return drain();
  }

  function sellJoker(id) {
    if (!hasJoker(id)) return drain();
    removeJoker(id);
    addGold(5);
    emit('soldJoker', { id });
    return drain();
  }

  function leaveShop() {
    S.shop = null;
    if (S.stage === 0) { S.stage = 1; startFloor(); }
    else if (S.stage === 1) { S.stage = 2; startBoss(); }
    else { S.act++; S.stage = 0; startFloor(); }
  }

  /* ---------- public API ---------- */
  return {
    newRun, resolveCard, flee, strikeBoss, pickReward,
    openShop, buyItem, buyHeal, rerollShop, removeCardFromPool, sellJoker, leaveShop,
    hasJoker, effRank, weaponPower, canUseWeapon, previewDamage, potionHeal,
    strikeDamage, canFlee, roomSize, monsterBonus,
    drain, loadMeta,
  };
})();
