/* ============================================================
   UI — rendering + juice.
   The engine emits events; playEvents() turns them into
   floaters, screen shake, particles and sounds.
   ============================================================ */
const UI = (() => {

  const $ = s => document.querySelector(s);
  const ROMAN = { 1: 'I', 2: 'II', 3: 'III' };
  const TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches
    || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let busy = false;          // blocks input during resolve animations
  let knownIds = new Set();  // room cards already on the table (for deal anims)
  let tipEl = null, tipTimer = 0;

  /* ============================ screens ============================ */
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
    if ($('#tooltip')) hideTip();
  }

  /* ============================ tooltip ============================ */
  const tooltip = () => $('#tooltip');
  function hideTip() { tooltip().classList.add('hidden'); tipEl = null; }
  // tap-to-reveal: position the tooltip above (or below) an element, no cursor
  function showTipAt(el, html) {
    const t = tooltip();
    t.innerHTML = html;
    t.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.offsetWidth / 2;
    let y = r.top - t.offsetHeight - 8;
    if (y < 8) y = r.bottom + 8;
    x = Math.max(8, Math.min(x, window.innerWidth - t.offsetWidth - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - t.offsetHeight - 8));
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function attachTooltip(el, html) {
    el.addEventListener('mouseenter', () => { tooltip().innerHTML = html; tooltip().classList.remove('hidden'); });
    el.addEventListener('mousemove', e => {
      const t = tooltip();
      const x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 10);
      const y = Math.min(e.clientY + 14, window.innerHeight - t.offsetHeight - 10);
      t.style.left = x + 'px'; t.style.top = y + 'px';
    });
    el.addEventListener('mouseleave', () => tooltip().classList.add('hidden'));
    if (TOUCH) {
      el.addEventListener('click', () => {
        if (tipEl === el && !tooltip().classList.contains('hidden')) { hideTip(); return; }
        showTipAt(el, html); tipEl = el;
        clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 3400);
      });
    }
  }

  /* ============================ card DOM ============================ */
  function cardSub(card) {
    if (card.kind === 'monster') return 'deals ' + E.effRank(card);
    if (card.kind === 'weapon') return 'power ' + card.rank;
    if (card.kind === 'potion') return 'heals ' + E.potionHeal(card);
    const a = DATA.allyDef(card);
    return a ? a.short : '';
  }

  function cardEl(card) {
    const el = document.createElement('div');
    el.className = `card suit-${card.suit} kind-${card.kind}`;
    el.dataset.id = card.id;
    el.style.setProperty('--bob-dur', (3 + Math.random() * 1.4).toFixed(2) + 's');
    el.style.setProperty('--bob-delay', (-Math.random() * 3).toFixed(2) + 's');
    const rl = card.suit === 'X' ? '*' : DATA.rankLabel(card.rank);
    const suit = PIX.suitImg(card.suit, 14);
    el.innerHTML = `
      <div class="corner tl"><span class="rank">${rl}</span>${suit}</div>
      <div class="corner br"><span class="rank">${rl}</span>${suit}</div>
      <div class="c-emoji">${PIX.emojiImg(DATA.cardEmoji(card), 14, 56)}</div>
      <div class="c-name">${DATA.cardName(card)}</div>
      <div class="c-sub">${cardSub(card)}</div>`;
    if (card.kind === 'monster' && E.monsterBonus() > 0) {
      el.innerHTML += `<div class="badge">+${E.monsterBonus()}</div>`;
    }
    if (card.kind === 'monster' && card.rank >= 12) el.classList.add('miniboss');
    if (card.kind === 'ally' || card.kind === 'wild') {
      const a = DATA.allyDef(card);
      attachTooltip(el, `<div class="tt-name">${PIX.emojiImg(a.emoji, 10, 16)} ${a.name}</div><div class="tt-desc">${a.desc}</div>`);
    }
    // hover tilt (the balatro wiggle)
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', (px * 16) + 'deg');
      el.style.setProperty('--rx', (-py * 14) + 'deg');
    });
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    });
    return el;
  }

  function cardMiniEl(card) {
    const el = document.createElement('div');
    el.className = `card-mini suit-${card.suit}`;
    el.dataset.id = card.id;
    const rl = card.suit === 'X' ? '*' : DATA.rankLabel(card.rank);
    el.innerHTML = `
      <div class="m-rank">${rl}${card.suit === 'X' ? '' : PIX.suitImg(card.suit, 9)}</div>
      <div class="m-emoji">${PIX.emojiImg(DATA.cardEmoji(card), 12, 32)}</div>
      <div class="m-name">${DATA.cardName(card)}</div>`;
    return el;
  }

  function jokerEl(def, opts = {}) {
    const el = document.createElement('div');
    el.className = 'joker';
    el.dataset.jid = def.id;
    el.style.setProperty('--bob-dur', (3 + Math.random() * 1.5).toFixed(2) + 's');
    el.style.setProperty('--bob-delay', (-Math.random() * 3).toFixed(2) + 's');
    el.innerHTML = `<div class="j-emoji">${PIX.emojiImg(def.emoji, 12, 36)}</div><div class="j-name">${def.name}</div>`;
    attachTooltip(el, `<div class="tt-name">${PIX.emojiImg(def.emoji, 10, 16)} ${def.name}</div><div class="tt-desc">${def.desc}</div>`);
    if (opts.sellable) {
      el.classList.add('sellable');
      const x = document.createElement('button');
      x.className = 'j-sell';
      x.textContent = '$';
      x.title = 'Sell for 5 gold';
      x.addEventListener('click', ev => {
        ev.stopPropagation();
        playEvents(E.sellJoker(def.id));
        renderShop();
      });
      el.appendChild(x);
    }
    return el;
  }

  /* ============================ renderers ============================ */
  function renderAll(freshDeal) {
    if (freshDeal) knownIds = new Set();
    renderSidebar();
    renderPiles();
    $('#jokerbar').style.display = S.mode === 'classic' ? 'none' : '';
    if (S.mode !== 'classic') renderJokers();
    renderRoom();
    renderBoss();
  }

  function renderSidebar() {
    const stageName = S.stage === 2 ? 'BOSS FIGHT' : `FLOOR ${S.stage + 1}`;
    $('#floor-label').textContent = S.mode === 'classic'
      ? 'CLASSIC - THE DUNGEON'
      : `ACT ${ROMAN[S.act] || S.act} - ${stageName}`;
    document.querySelector('.gold-block').style.display = S.mode === 'classic' ? 'none' : '';
    const modEl = $('#floor-mod');
    if (S.floorMod) {
      const m = DATA.modById(S.floorMod);
      modEl.textContent = `${m.name.toUpperCase()} - ${m.desc}`;
      modEl.classList.add('on');
    } else modEl.classList.remove('on');

    $('#hp-num').textContent = S.hp;
    $('#hp-max').textContent = '/' + S.maxHp;
    $('#hp-orb').classList.toggle('low', S.hp <= 5 && !S.over);
    $('#shield-num').textContent = S.shield;
    $('#shield-chip').classList.toggle('on', S.shield > 0);
    $('#gold-num').textContent = S.gold;

    const fleeBtn = $('#btn-flee');
    fleeBtn.disabled = !E.canFlee() || busy;
    fleeBtn.textContent = S.fledLast && !E.hasJoker('map') ? "CAN'T FLEE TWICE" : 'FLEE ROOM';
  }

  /* the dungeon pile, discard pile and weapon-in-play — the tabletop layout */
  function renderPiles() {
    const deckN = S.boss ? S.bossDeck.length : S.deck.length;
    $('#deck-num').textContent = deckN;
    $('#deck-pile').classList.toggle('empty', deckN === 0);

    const disc = S.boss ? S.bossDiscard : (S.discard || []);
    $('#discard-num').textContent = disc.length;
    const top = $('#discard-top');
    top.innerHTML = '';
    if (disc.length === 0) {
      top.innerHTML = '<div class="pile-empty"></div>';
    } else {
      disc.slice(-3).forEach(c => top.appendChild(cardMiniEl(c)));
    }

    const slot = $('#weapon-slot');
    slot.innerHTML = '';
    const info = $('#weapon-info');
    if (S.weapon) {
      const stack = document.createElement('div');
      stack.className = 'wstack';
      const n = S.weapon.stack.length;
      stack.style.width = (74 + n * 24) + 'px';
      const wEl = cardMiniEl(S.weapon.card);
      wEl.style.left = '0px'; wEl.style.zIndex = 1;
      stack.appendChild(wEl);
      S.weapon.stack.forEach((c, i) => {
        const m = cardMiniEl(c);
        m.style.left = (24 + i * 24) + 'px';
        m.style.zIndex = 2 + i;
        m.style.rotate = (2 + i) + 'deg';
        stack.appendChild(m);
      });
      slot.appendChild(stack);
      let txt = `PWR ${E.weaponPower()}`;
      if (S.weapon.bonus > 0) txt += ` (+${S.weapon.bonus})`;
      const lim = S.weapon.lastSlain == null
        ? '<span class="degrade">fresh edge - slays anything</span>'
        : `<span class="degrade">next kill must be ${E.hasJoker('whetstone') ? '&lt;=' : '&lt;'} ${S.weapon.lastSlain}</span>`;
      info.innerHTML = txt + lim;
    } else {
      slot.innerHTML = '<div class="weapon-empty">bare hands<br>(full damage)</div>';
      info.innerHTML = '';
    }
  }

  function renderJokers(container, sellable) {
    const bar = container || $('#jokerbar');
    bar.innerHTML = '';
    S.jokers.forEach(id => bar.appendChild(jokerEl(DATA.jokerById(id), { sellable })));
    for (let i = S.jokers.length; i < S.jokerSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'jslot-empty';
      slot.innerHTML = PIX.emojiImg('🃏', 10, 28);
      bar.appendChild(slot);
    }
  }

  function renderRoom() {
    const room = $('#room');
    hideTip();
    // remember where surviving cards were (FLIP slide)
    const oldRects = new Map();
    room.querySelectorAll('.card').forEach(el => {
      if (el.dataset.id) oldRects.set(el.dataset.id, el.getBoundingClientRect());
    });
    room.innerHTML = '';
    const fresh = [];
    S.room.forEach(card => {
      const el = cardEl(card);
      if (!knownIds.has(card.id)) fresh.push(el);
      el.addEventListener('click', () => onCardClick(card, el));
      const wrap = document.createElement('div');
      wrap.className = 'cardwrap';
      if (el.classList.contains('miniboss')) {
        // the black hole sits UNDER the card, framing it
        wrap.innerHTML = '<div class="aura"><div class="aura-spokes"></div><div class="aura-ring"></div><div class="aura-ring r2"></div></div>';
      }
      wrap.appendChild(el);
      room.appendChild(wrap);
    });
    knownIds = new Set(S.room.map(c => c.id));

    // carried cards visibly slide to their new slot
    room.querySelectorAll('.card').forEach(el => {
      const old = oldRects.get(el.dataset.id);
      if (!old || fresh.includes(el)) return;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left, dy = old.top - now.top;
      if (dx || dy) el.animate(
        [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.3,.9,.4,1)' });
    });

    // new cards fly out of the dungeon pile, staggered
    const deckEl = $('#deck-pile .pb1');
    const deckRect = deckEl ? deckEl.getBoundingClientRect() : null;
    fresh.forEach((el, i) => {
      if (!deckRect) return;
      const r = el.getBoundingClientRect();
      const dx = (deckRect.left + deckRect.width / 2) - (r.left + r.width / 2);
      const dy = (deckRect.top + deckRect.height / 2) - (r.top + r.height / 2);
      el.animate([
        { transform: `translate(${dx}px,${dy}px) scale(.28) rotate(-24deg)`, opacity: .7, offset: 0 },
        { transform: `translate(${dx * .35}px,${dy * .35 - 40}px) scale(.75) rotate(8deg)`, opacity: 1, offset: .55 },
        { transform: 'translate(8px,-6px) scale(1.05) rotate(2deg)', offset: .82 },
        { transform: 'none', offset: 1 },
      ], { duration: 460, delay: i * 90, easing: 'cubic-bezier(.25,.8,.35,1)', fill: 'backwards' });
      setTimeout(() => SFX.play('flip'), i * 90);
    });
    if (fresh.length > 0) SFX.play('deal');

    if (S.over) $('#room-banner').textContent = '';
    else if (S.boss) $('#room-banner').textContent = `WAVE ${S.boss.wave} - play cards or STRIKE the boss`;
    else if (S.room.length === 0 && S.deck.length === 0) $('#room-banner').textContent = '';
    else $('#room-banner').textContent = 'resolve cards - the last one carries over';
  }

  function renderBoss() {
    const bar = $('#bossbar');
    if (!S.boss) { bar.classList.add('hidden'); return; }
    const b = S.boss;
    bar.classList.remove('hidden');
    bar.classList.toggle('rage', !!b.enraged);
    const pct = Math.max(0, 100 * b.hp / b.maxHp);
    bar.innerHTML = `
      <div class="boss-emoji">${PIX.emojiImg(b.emoji, 14, 60)}</div>
      <div class="boss-mid">
        <div class="boss-name">${b.name}</div>
        <div class="boss-trait">${b.trait}</div>
        <div class="boss-hpbar"><div class="boss-hpfill" style="width:${pct}%"></div></div>
        <div class="boss-hptext">${Math.max(0, b.hp)} / ${b.maxHp} HP</div>
      </div>
      <div class="boss-right">
        <div class="boss-power">PWR ${b.power}</div>
        <div class="action-pips">${[1, 2, 3].map(i => `<div class="pip ${i > S.actionsLeft ? 'used' : ''}"></div>`).join('')}</div>
        <button class="btn btn-strike" id="btn-strike">STRIKE (${E.strikeDamage()})</button>
      </div>`;
    $('#btn-strike').addEventListener('click', () => {
      if (busy || S.over) return;
      SFX.play('slash');
      playEvents(E.strikeBoss(), bar.getBoundingClientRect());
      renderAll();
    });
  }

  /* ============================ interactions ============================ */
  function closeChoosers() {
    document.querySelectorAll('.chooser').forEach(el => el.remove());
  }

  function onCardClick(card, node) {
    if (busy || S.over || S.pendingReward) return;
    if (S.boss && S.actionsLeft <= 0) return;

    if (card.kind === 'monster') {
      const existing = node.querySelector('.chooser');
      closeChoosers();
      if (existing) return; // toggle off
      SFX.play('click');
      const ch = document.createElement('div');
      ch.className = 'chooser';
      const bare = E.previewDamage(card, 'bare');
      let html = '';
      if (S.weapon) {
        if (E.canUseWeapon(card)) {
          html += `<button class="ch-w">WEAPON - take ${E.previewDamage(card, 'weapon')}</button>`;
        } else {
          html += `<button class="ch-w" disabled>TOO WORN (need ${E.hasJoker('whetstone') ? '&lt;=' : '&lt;'} ${S.weapon.lastSlain})</button>`;
        }
      }
      html += `<button class="ch-b">BARE HANDS - take ${bare}</button>`;
      ch.innerHTML = html;
      const wBtn = ch.querySelector('.ch-w');
      if (wBtn && !wBtn.disabled) wBtn.addEventListener('click', ev => { ev.stopPropagation(); doResolve(card, 'weapon', node); });
      ch.querySelector('.ch-b').addEventListener('click', ev => { ev.stopPropagation(); doResolve(card, 'bare', node); });
      node.appendChild(ch);
    } else {
      closeChoosers();
      doResolve(card, null, node);
    }
  }

  /* fly a card's clone across the screen to a destination element */
  function flyTo(node, destSel, opts = {}) {
    const from = node.getBoundingClientRect();
    const destEl = destSel && document.querySelector(destSel);
    let to = destEl ? destEl.getBoundingClientRect() : null;
    if (!to || (!to.width && !to.height)) to = { left: window.innerWidth / 2, top: -160, width: 0, height: 0 };
    const clone = node.cloneNode(true);
    const ch = clone.querySelector('.chooser');
    if (ch) ch.remove();
    clone.classList.add('flying');
    clone.style.left = from.left + 'px';
    clone.style.top = from.top + 'px';
    clone.style.width = from.width + 'px';
    clone.style.height = from.height + 'px';
    $('#floaters').appendChild(clone);
    (node.closest('.cardwrap') || node).style.visibility = 'hidden';
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    const spin = opts.spin != null ? opts.spin : (dx < 0 ? -14 : 14);
    const anim = clone.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * .45}px,${dy * .45 - 46}px) scale(.78) rotate(${spin}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx}px,${dy}px) scale(.28) rotate(${spin * 2}deg)`, opacity: .3 },
    ], { duration: opts.dur || 430, delay: opts.delay || 0, easing: 'cubic-bezier(.45,.1,.6,1)', fill: 'backwards' });
    anim.onfinish = () => {
      clone.remove();
      if (opts.burst) spawnBurst(to.left + to.width / 2, to.top + to.height / 2, opts.burst, 10);
    };
    anim.oncancel = () => clone.remove();
    // hidden tabs pause animations; never let clones outlive their welcome
    setTimeout(() => { if (clone.isConnected) clone.remove(); }, (opts.dur || 430) + (opts.delay || 0) + 3000);
  }

  const ALLY_DEST = {
    polish: '#weapon-slot', sharpen2: '#weapon-slot', reforge: '#weapon-slot',
    heal7: '#hp-orb', heal10: '#hp-orb', fullheal: '#hp-orb', shield7: '#hp-orb',
    jester: '#jokerbar',
  };

  function doResolve(card, choice, node) {
    if (busy) return;
    busy = true;
    closeChoosers();
    hideTip();
    const rect = node.getBoundingClientRect();
    let dest, burst;
    if (card.kind === 'monster') {
      SFX.play(choice === 'weapon' ? 'slash' : 'thud');
      dest = choice === 'weapon' ? '#weapon-slot' : '#hp-orb';
      burst = choice === 'weapon' ? ['#f5b942', '#fff2c9'] : ['#e5484d', '#7e1c1f'];
      spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, ['#e5484d', '#8f2d2d', '#f5b942'], 14);
    } else if (card.kind === 'weapon') {
      SFX.play('equip');
      dest = '#weapon-slot'; burst = ['#f5b942', '#fff2c9'];
    } else if (card.kind === 'potion') {
      SFX.play('flip');
      dest = '#hp-orb'; burst = ['#52d97a', '#a5f3c0'];
    } else if (card.kind === 'ally') {
      SFX.play('flip');
      dest = ALLY_DEST[DATA.allyDef(card).effect] || '#hp-orb'; burst = ['#4a9df0', '#cfe3ff'];
    } else {
      SFX.play('flip');
      dest = '#jokerbar'; burst = ['#9b6df2', '#f5b942'];
    }
    flyTo(node, dest, { burst });

    setTimeout(() => {
      const evs = E.resolveCard(card.id, choice);
      busy = false;
      renderAll();
      playEvents(evs, rect);
    }, 230);
  }

  /* flee: the whole room flies back into the deck */
  function fleeWithFlight() {
    if (busy || !E.canFlee()) { SFX.play('error'); return; }
    busy = true;
    SFX.play('flee');
    document.querySelectorAll('#room .card').forEach((el, i) => {
      flyTo(el, '#deck-pile .pb1', { dur: 360, delay: i * 60, spin: -16 });
    });
    setTimeout(() => {
      busy = false;
      playEvents(E.flee());
      renderAll(true);
    }, 380);
  }

  /* ============================ event juice ============================ */
  function rectCenter(sel) {
    const el = $(sel);
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function playEvents(evs, anchorRect) {
    const anchor = anchorRect
      ? { x: anchorRect.left + anchorRect.width / 2, y: anchorRect.top + anchorRect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2.4 };
    let delay = 0;
    const step = 150;
    /* Juice is staggered over seconds, so a player who abandons and starts a new
       run mid-sequence can have the old run's callbacks land in the new one. Every
       deferred callback belongs to the run that queued it and is dropped otherwise. */
    const tok = E.runToken();
    const alive = () => E.runToken() === tok;
    const later = fn => { setTimeout(() => { if (alive()) fn(); }, delay); delay += step; };
    const after = (ms, fn) => setTimeout(() => { if (alive()) fn(); }, ms);

    evs.forEach(ev => {
      switch (ev.type) {
        case 'slay': if (ev.card.kind === 'monster' && ev.card.rank >= 12) later(() => {
          shake(true);
          spawnBurst(anchor.x, anchor.y, ['#9b6df2', '#5a2a80', '#1a0b28', '#f5b942'], 26);
        }); break;
        case 'dmg': later(() => {
          const p = rectCenter('#hp-orb');
          floatAt(p.x, p.y - 30, '-' + ev.amt, 'hurt');
          $('#hp-orb').classList.remove('pulse'); void $('#hp-orb').offsetWidth;
          $('#hp-orb').classList.add('pulse');
          SFX.play(ev.src === 'boss' ? 'bosshit' : 'hurt');
          shake(ev.amt >= 6);
          hurtFlash();
          spawnBurst(p.x, p.y, ['#e5484d', '#7e1c1f'], 10);
          renderSidebar();
        }); break;
        case 'shieldHit': later(() => {
          const p = rectCenter('#shield-chip');
          floatAt(p.x, p.y - 10, '-' + ev.amt + ' SHIELD', 'info');
          SFX.play('shield');
          renderSidebar();
        }); break;
        case 'nodmg': later(() => floatAt(anchor.x, anchor.y - 40, 'FLAWLESS!', 'info')); break;
        case 'mirror': later(() => floatAt(anchor.x, anchor.y - 20, 'BLOCKED ' + ev.blocked, 'info')); break;
        case 'heal': later(() => {
          const p = rectCenter('#hp-orb');
          floatAt(p.x, p.y - 30, '+' + ev.amt, 'heal');
          SFX.play('heal');
          spawnBurst(p.x, p.y, ['#52d97a', '#a5f3c0'], 12);
          renderSidebar();
        }); break;
        case 'healFull': later(() => floatAt(rectCenter('#hp-orb').x, rectCenter('#hp-orb').y - 30, 'FULL', 'info')); break;
        case 'shield': later(() => {
          floatAt(rectCenter('#hp-orb').x, rectCenter('#hp-orb').y - 30, '+' + ev.amt + ' SHIELD', 'info');
          SFX.play('shield');
          renderSidebar();
        }); break;
        case 'gold': later(() => {
          const p = rectCenter('#gold-num');
          floatAt(p.x, p.y - 10, '+' + ev.amt + 'g', 'gold');
          SFX.play('coin');
          spawnBurst(p.x, p.y, ['#f5b942', '#fff2c9'], 8);
          renderSidebar();
          if ($('#screen-shop').classList.contains('active')) $('#shop-gold').textContent = S.gold;
        }); break;
        case 'wasted': later(() => { floatAt(anchor.x, anchor.y - 30, 'WASTED!', 'info'); SFX.play('error'); }); break;
        case 'shatter': later(() => {
          const p = rectCenter('#weapon-slot');
          floatAt(p.x, p.y - 20, 'SNAPPED!', 'hurt');
          SFX.play('snap'); shake(false);
          renderPiles();
        }); break;
        case 'polish': later(() => floatAt(rectCenter('#weapon-slot').x, rectCenter('#weapon-slot').y - 20, 'POLISHED!', 'info')); break;
        case 'sharpen': later(() => floatAt(rectCenter('#weapon-slot').x, rectCenter('#weapon-slot').y - 20, '+' + ev.amt + ' PWR', 'gold')); break;
        case 'noWeapon': later(() => floatAt(anchor.x, anchor.y - 30, 'NO WEAPON', 'info')); break;
        case 'saved': later(() => { floatCenter('SAVED!', 'heal big'); SFX.play('heal'); }); break;
        case 'jester': later(() => {
          SFX.play('joker');
          floatCenter(ev.joker ? ev.joker.name + '!' : '+' + ev.gold + ' GOLD!', 'gold big');
          renderJokers();
        }); break;
        case 'fled': later(() => { SFX.play('flee'); floatCenter('You slip away...', 'info'); }); break;
        case 'floorClear': later(() => {
          SFX.play('fanfare');
          floatCenter('FLOOR CLEARED! +' + ev.bonus + 'g', 'gold big');
          after(1500, () => { if (!S.over) E.openShop(); });
        }); break;
        case 'bossAttack': later(() => {
          floatCenter('THE BOSS HITS FOR ' + ev.amt + '!', 'hurt');
        }); break;
        case 'bossDmg': later(() => {
          const p = rectCenter('#bossbar');
          floatAt(p.x, p.y - 20, '-' + ev.amt, 'hurt big');
          spawnBurst(p.x, p.y, ['#ff5f64', '#f5b942'], 12);
          renderBoss();
        }); break;
        case 'enrage': later(() => { SFX.play('roar'); floatCenter('ENRAGED!', 'hurt big'); shake(true); renderBoss(); }); break;
        case 'bossRegen': later(() => { floatAt(rectCenter('#bossbar').x, rectCenter('#bossbar').y - 20, '+' + ev.amt, 'heal'); renderBoss(); }); break;
        case 'escalate': later(() => { floatAt(rectCenter('#bossbar').x, rectCenter('#bossbar').y - 20, 'PWR ' + ev.power + '!', 'hurt'); renderBoss(); }); break;
        case 'wave': later(() => renderAll()); break;
        case 'bossDead': later(() => {
          SFX.play('bosskill');
          shake(true);
          floatCenter(ev.boss.name + ' FALLS!', 'gold big');
        }); break;
        case 'reward': later(() => after(1200, () => modalBossReward(ev))); break;
        case 'death': later(() => { SFX.play('die'); shake(true); after(1100, () => gameOver(false)); }); break;
        case 'victory': later(() => after(1500, () => gameOver(true))); break;
        case 'cant': later(() => SFX.play('error')); break;
        case 'slotsFull': later(() => { SFX.play('error'); floatCenter('JOKER SLOTS FULL!', 'info'); }); break;
        case 'bought': later(() => { SFX.play('buy'); renderShop(); }); break;
        case 'reroll': later(() => { SFX.play('deal'); renderShop(); }); break;
        case 'removed': later(() => { SFX.play('snap'); }); break;
        case 'soldJoker': later(() => SFX.play('coin')); break;
        case 'jokerGained': later(() => renderJokers()); break;
      }
    });
  }

  /* ============================ juice primitives ============================ */
  function floatAt(x, y, text, cls) {
    const el = document.createElement('div');
    el.className = 'floater ' + (cls || '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('#floaters').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  function floatCenter(text, cls) {
    floatAt(window.innerWidth / 2, window.innerHeight * 0.32, text, cls);
  }
  function shake(big) {
    const app = $('#app');
    app.classList.remove('shake', 'bigshake');
    void app.offsetWidth;
    app.classList.add(big ? 'bigshake' : 'shake');
  }
  function hurtFlash() {
    const app = $('#app');
    app.classList.add('hurt-flash');
    setTimeout(() => app.classList.remove('hurt-flash'), 120);
  }

  /* particles */
  const parts = [];
  function spawnBurst(x, y, palette, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5,
        g: 0.22, life: 1,
        decay: 0.02 + Math.random() * 0.02,
        size: 3 + Math.random() * 5,
        color: palette[Math.floor(Math.random() * palette.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
      });
    }
  }
  function particleLoop() {
    const cv = $('#fx');
    const ctx = cv.getContext('2d');
    // dark wisps spiral into miniboss cards
    setInterval(() => {
      document.querySelectorAll('#screen-game.active .card.miniboss').forEach(el => {
        if (el.checkVisibility && !el.checkVisibility()) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * Math.PI * 2;
          const rad = 90 + Math.random() * 55;
          const speed = 2 + Math.random() * 1.5;
          parts.push({
            x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad,
            vx: -Math.cos(a) * speed, vy: -Math.sin(a) * speed,
            g: 0, life: 1, decay: speed / rad,
            size: 2 + Math.random() * 3,
            color: ['#1a0b28', '#5a2a80', '#8a4fc0', '#2e1545'][Math.floor(Math.random() * 4)],
            rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .4,
          });
        }
      });
    }, 420);
    function frame() {
      if (cv.width !== window.innerWidth) cv.width = window.innerWidth;
      if (cv.height !== window.innerHeight) cv.height = window.innerHeight;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.g;
        p.rot += p.vr; p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ============================ modals ============================ */
  /* A "sticky" modal owns a decision the run cannot continue without (the boss
     reward). Escape and stray clicks must not dismiss it — only the code that
     consumes the decision may, by passing force. */
  function openModal(html, sticky) {
    $('#modal').innerHTML = html;
    $('#modal').dataset.sticky = sticky ? '1' : '';
    $('#modal-wrap').classList.remove('hidden');
  }
  function closeModal(force) {
    if (!force && $('#modal').dataset.sticky === '1') { SFX.play('error'); return; }
    $('#modal').dataset.sticky = '';
    $('#modal-wrap').classList.add('hidden');
    hideTip();
  }

  // pixel icon for modal headings
  const hIcon = e => PIX.emojiImg(e, 12, 26, 'h-ico');

  function modalHowTo() {
    openModal(`
      <h2>${hIcon('📜')} HOW TO PLAY</h2>
      <p>You are a scoundrel fleeing through a dungeon made of cards. Survive 3 acts - two floors and a boss each - and escape with the loot.</p>
      <h3>Rooms</h3>
      <ul>
        <li>Each room deals <b>4 cards</b>. Resolve them one at a time - when <b>one card remains</b>, it carries into the next room.</li>
        <li>You may <b>FLEE</b> a room before touching any card (cards go to the bottom of the deck) - but never twice in a row.</li>
      </ul>
      <h3>The cards</h3>
      <ul>
        <li><b>Spades &amp; Clubs are monsters</b> - fight barehanded (take full value) or with your weapon (take value minus weapon power).</li>
        <li><b>Diamonds are weapons</b> - equip one at a time. A weapon <b>degrades</b>: each monster it slays must be <i>weaker than the last</i>.</li>
        <li><b>Hearts are potions</b> - heal their value, but only the <b>first potion each room</b> works.</li>
        <li><b>Red faces &amp; aces</b> - Allies and legendary cards that join the dungeon as the acts advance (and turn up in shops).</li>
        <li><b>Jesters</b> - grant a random Joker on sight.</li>
      </ul>
      <h3>The run</h3>
      <ul>
        <li>Slaying monsters earns <b>gold</b>. Spend it in the camp between floors: <b>Jokers</b> (passive powers), new cards for your dungeon deck, card removal, healing.</li>
        <li><b>Bosses</b> end each act: spend 3 actions per wave on room cards or <b>STRIKE</b> - then the boss hits back.</li>
        <li>Each act the <b>deck grows</b> - 44 cards, then 49, then the full 54 - alongside floor modifiers and tougher monsters. Death is forever. Good luck, scoundrel.</li>
      </ul>
      <p class="credit-line">Based on the card game <b>Scoundrel</b> by <b>Zach Gage &amp; Kurt Bieg</b> (2011). This is an unofficial, non-commercial fan adaptation - not affiliated with or endorsed by the original creators. Feel inspired by Balatro (LocalThunk).</p>
      <div class="modal-foot"><button class="btn" id="modal-close">GOT IT</button></div>`);
    $('#modal-close').addEventListener('click', () => { SFX.play('click'); closeModal(); });
  }

  function sortedPool(cards) {
    const order = { monster: 0, weapon: 1, potion: 2, ally: 3, wild: 4 };
    return cards.slice().sort((a, b) => (order[a.kind] - order[b.kind]) || (a.rank - b.rank) || a.suit.localeCompare(b.suit));
  }

  function modalPileView(cards, title) {
    openModal(`
      <h2>${title} (${cards.length})</h2>
      <div class="deck-grid readonly" id="deck-grid"></div>
      <div class="modal-foot"><button class="btn" id="modal-close">CLOSE</button></div>`);
    const g = $('#deck-grid');
    sortedPool(cards).forEach(c => g.appendChild(cardMiniEl(c)));
    $('#modal-close').addEventListener('click', () => { SFX.play('click'); closeModal(); });
  }
  function modalDeckView() {
    modalPileView(S.boss ? S.bossDeck : S.deck, 'THE DUNGEON');
  }
  function modalDiscardView() {
    modalPileView(S.boss ? S.bossDiscard : (S.discard || []), 'DISCARD');
  }

  function modalRemoveCard() {
    openModal(`
      <h2>REMOVE A CARD - ${S.shop.removeCost}g</h2>
      <p>Permanently remove one card from your dungeon deck. You hold <b id="rm-gold">${S.gold}</b> gold.</p>
      <div class="deck-grid" id="deck-grid"></div>
      <div class="modal-foot"><button class="btn btn-ghost" id="modal-close">NEVER MIND</button></div>`);
    const g = $('#deck-grid');
    sortedPool(S.pool).forEach(c => {
      const m = cardMiniEl(c);
      m.addEventListener('click', () => {
        if (S.gold < S.shop.removeCost) { SFX.play('error'); return; }
        SFX.play('snap');
        playEvents(E.removeCardFromPool(c.id));
        closeModal();
        renderShop();
        floatCenter('Removed ' + DATA.cardName(c), 'info');
      });
      g.appendChild(m);
    });
    $('#modal-close').addEventListener('click', () => { SFX.play('click'); closeModal(); });
  }

  function modalBossReward(ev) {
    openModal(`
      <h2>SPOILS OF WAR</h2>
      <p>Choose a Joker${S.jokers.length >= S.jokerSlots ? ' <b>(slots full!)</b>' : ''} - or take the gold.</p>
      <div class="reward-row" id="reward-row"></div>
      <div class="modal-foot"><button class="btn btn-go" id="reward-gold">TAKE ${ev.gold} GOLD</button></div>`, true);
    const row = $('#reward-row');
    // the reward is only banked if the engine still had one to give — never
    // resurrect an abandoned run by opening its camp regardless
    const take = id => {
      if (!S.pendingReward) return;
      playEvents(E.pickReward(id));
      closeModal(true);
      E.openShop();
    };
    ev.jokers.forEach(j => {
      const el = jokerEl(j);
      el.addEventListener('click', () => {
        if (S.jokers.length >= S.jokerSlots) { SFX.play('error'); floatCenter('JOKER SLOTS FULL!', 'info'); return; }
        SFX.play('joker');
        take(j.id);
      });
      row.appendChild(el);
    });
    $('#reward-gold').addEventListener('click', () => { SFX.play('coin'); take(null); });
  }

  function modalAbandon() {
    openModal(`
      <h2>ABANDON RUN?</h2>
      <p>This scoundrel will be lost to the dungeon.</p>
      <div class="modal-foot">
        <button class="btn" id="ab-yes">ABANDON</button>
        <button class="btn btn-ghost" id="ab-no">KEEP FIGHTING</button>
      </div>`);
    $('#ab-yes').addEventListener('click', () => { SFX.play('click'); closeModal(); S.over = true; E.clearSave(); renderMenu(); showScreen('menu'); });
    $('#ab-no').addEventListener('click', () => { SFX.play('click'); closeModal(); });
  }

  /* ============================ leaderboard & score submit ============================ */
  const REPO = 'lewismconte/scoundrel';
  /* Cloudflare Worker that accepts scores without a GitHub login (see worker/README.md).
     While this is empty the game falls back to the GitHub-issue flow, so the board keeps
     working either way. */
  const BOARD_API = 'https://scoundrel-board.lewismconte.workers.dev';

  /* Board entries come off the network and land in innerHTML. The worker already
     restricts them to a markup-free charset, but escaping here means a bad entry
     can never execute even if it arrives from somewhere else. */
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function modalSubmitScore() {
    const fsc = S.finalScore;
    if (!fsc) return;
    const saved = localStorage.getItem('scoundrel_initials') || '';
    const online = !!BOARD_API;
    openModal(`
      <h2>${hIcon('\u{1F3C6}')} SUBMIT SCORE - ${fsc.score}</h2>
      <p>Enter your arcade initials:</p>
      <div style="text-align:center;margin:14px 0">
        <input class="initials-input" id="initials" maxlength="3" value="${esc(saved)}" placeholder="AAA">
      </div>
      <p id="submit-note">${online
        ? 'Your score goes straight to the global board - no account, no sign-in.'
        : 'Submitting opens <b>GitHub</b> with a pre-filled score report - sign in and press <b>Submit new issue</b>. A bot verifies it and the board updates in a couple of minutes. No account? Your score still counts on this device\'s local board.'}</p>
      <div class="modal-foot">
        <button class="btn btn-go" id="submit-go">${online ? 'SEND IT' : 'OPEN GITHUB &gt;&gt;'}</button>
        <button class="btn btn-ghost" id="modal-close">${online ? 'CANCEL' : 'CANCEL'}</button>
      </div>`);
    const inp = $('#initials');
    inp.focus();

    const initials = () => (inp.value || 'AAA').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3) || 'AAA';

    $('#submit-go').addEventListener('click', () => {
      const name = initials();
      localStorage.setItem('scoundrel_initials', name);
      const entry = { name, score: fsc.score, mode: fsc.mode, detail: fsc.detail };

      if (!online) { // legacy path: hand the entry to the GitHub issue bot
        const body = 'Automated score submission for the SCOUNDREL leaderboard.\n' +
          'Just press **Submit new issue** - a bot records it and closes this.\n\n' +
          '```json\n' + JSON.stringify(entry) + '\n```\n';
        const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`[SCORE] ${name} ${fsc.score} (${fsc.mode})`)}&body=${encodeURIComponent(body)}`;
        SFX.play('coin');
        window.open(url, '_blank');
        closeModal();
        return;
      }

      const btn = $('#submit-go');
      btn.disabled = true;
      btn.textContent = 'SENDING...';
      SFX.play('coin');
      fetch(BOARD_API.replace(/\/$/, '') + '/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
        .then(r => r.json().then(j => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (!ok || !j.ok) throw new Error(j && j.error ? j.error : 'rejected');
          SFX.play('fanfare');
          const note = $('#submit-note');
          if (note) {
            note.innerHTML = j.rank
              ? `<b>ON THE BOARD AT #${j.rank}</b> - well fought, ${esc(name)}.`
              : `Recorded, but it did not crack the top 50 this time.`;
          }
          btn.textContent = 'DONE';
          const close = $('#modal-close');
          if (close) close.textContent = 'CLOSE';
        })
        .catch(err => {
          SFX.play('error');
          const note = $('#submit-note');
          if (note) note.textContent = `Could not reach the board (${err.message}). Your score is still saved on this device.`;
          btn.disabled = false;
          btn.textContent = 'TRY AGAIN';
        });
    });
    $('#modal-close').addEventListener('click', () => { SFX.play('click'); closeModal(); });
  }

  function boardRows(list) {
    if (!list || list.length === 0) return '<tr><td colspan="4" style="opacity:.5;padding:14px">no scores yet - be the first!</td></tr>';
    return list.map((s, i) => `
      <tr>
        <td class="b-rank">${i + 1}</td>
        <td class="b-name">${esc(String(s.name || '???').slice(0, 3).toUpperCase())}</td>
        <td><div class="b-detail">${esc(s.detail)}${s.date ? ' - ' + esc(s.date) : ''}</div></td>
        <td class="b-score">${esc(s.score)}</td>
      </tr>`).join('');
  }

  function modalLeaderboard() {
    openModal(`
      <h2>${hIcon('\u{1F3C6}')} LEADERBOARD</h2>
      <div class="board-tabs">
        <button class="btn on" id="tab-classic">CLASSIC</button>
        <button class="btn" id="tab-gauntlet">GAUNTLET</button>
      </div>
      <div id="board-body"><p style="opacity:.6">fetching scores...</p></div>
      <p class="board-note" id="board-note">Top 50 per mode. Scores are player-submitted and honour-system - settle disputes with a duel.</p>
      <div class="modal-foot"><button class="btn" id="modal-close">CLOSE</button></div>`);
    $('#modal-close').addEventListener('click', () => { SFX.play('click'); closeModal(); });

    let board = null, tab = 'classic';
    const render = () => {
      const body = $('#board-body');
      if (!body) return;
      if (board) {
        body.innerHTML = `<table class="board-table"><tr><th>#</th><th>WHO</th><th></th><th style="text-align:right">SCORE</th></tr>${boardRows(board[tab])}</table>`;
      } else {
        const local = E.localScores().filter(s => s.mode === tab);
        body.innerHTML = `<p style="opacity:.7;font-size:9px;margin-bottom:8px">couldn't reach the online board - showing this device's scores.</p>
          <table class="board-table"><tr><th>#</th><th>WHO</th><th></th><th style="text-align:right">SCORE</th></tr>${boardRows(local.map(s => ({ ...s, name: 'YOU' })))}</table>`;
      }
    };
    const setTab = t => {
      tab = t;
      $('#tab-classic').classList.toggle('on', t === 'classic');
      $('#tab-gauntlet').classList.toggle('on', t === 'gauntlet');
      render();
    };
    $('#tab-classic').addEventListener('click', () => { SFX.play('click'); setTab('classic'); });
    $('#tab-gauntlet').addEventListener('click', () => { SFX.play('click'); setTab('gauntlet'); });
    // live worker board first, the committed JSON as a fallback if it is unreachable
    const sources = BOARD_API
      ? [BOARD_API.replace(/\/$/, '') + '/board', 'leaderboard.json?t=' + Date.now()]
      : ['leaderboard.json?t=' + Date.now()];
    const tryNext = i => {
      if (i >= sources.length) { render(); return; }
      fetch(sources[i])
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
        .then(j => { board = j; render(); })
        .catch(() => tryNext(i + 1));
    };
    tryNext(0);
    render();
  }

  /* the dungeon grows: reveal the 5 cards joining the deck this act */
  function modalDeckGrows(cards, act) {
    SFX.play('joker');
    openModal(`
      <h2>${act >= 3 ? 'THE FULL 54' : 'THE DUNGEON GROWS'}</h2>
      <p>${act >= 3
        ? 'The final five slip into your deck - the dungeon is complete, and every monster now hits <b>+1</b> harder.'
        : 'The court arrives. Five new cards shuffle into your dungeon from here on:'}</p>
      <div class="reward-row" id="grow-row"></div>
      <div class="modal-foot"><button class="btn btn-go" id="modal-close">BRING IT ON</button></div>`);
    const row = $('#grow-row');
    cards.forEach(c => {
      const m = cardMiniEl(c);
      const a = DATA.allyDef(c);
      if (a) attachTooltip(m, `<div class="tt-name">${PIX.emojiImg(a.emoji, 10, 16)} ${a.name}</div><div class="tt-desc">${a.desc}</div>`);
      row.appendChild(m);
    });
    $('#modal-close').addEventListener('click', () => { SFX.play('click'); closeModal(); });
  }

  /* ============================ boss splash ============================ */
  function bossSplash(def) {
    SFX.play('roar');
    const el = document.createElement('div');
    el.className = 'boss-splash';
    el.innerHTML = `
      <div class="bs-emoji">${PIX.emojiImg(def.emoji, 16, 128)}</div>
      <div class="bs-name">${def.name}</div>
      <div class="bs-trait">${def.trait}</div>`;
    document.body.appendChild(el);
    shake(true);
    setTimeout(() => el.remove(), 2450);
  }

  /* ============================ shop ============================ */
  function renderShop() {
    if (!S.shop) return; // left the camp before a deferred redraw landed
    const free = S.shop.freePicks > 0;
    document.querySelector('#screen-shop .shop-head h2').textContent =
      S.shop.outfitting ? (free ? 'OUTFITTING - FIRST PICK IS FREE' : 'OUTFITTING') : "THE SMUGGLER'S CAMP";
    $('#btn-delve').innerHTML = S.shop.outfitting ? 'ENTER THE DUNGEON &gt;&gt;' : 'DELVE DEEPER &gt;&gt;';
    $('#shop-gold').textContent = S.gold;
    renderJokers($('#shop-jokerbar'), true);

    const wrap = $('#shop-items');
    wrap.innerHTML = '';
    S.shop.items.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'shop-item' + (it.sold ? ' sold' : '');
      if (it.type === 'joker') {
        el.appendChild(jokerEl(it.joker));
        el.innerHTML += `<div class="si-desc">${it.joker.desc}</div>`;
      } else {
        el.appendChild(cardMiniEl(it.card));
        const d = it.card.kind === 'ally' || it.card.kind === 'wild'
          ? DATA.allyDef(it.card).desc
          : (it.card.kind === 'weapon' ? `Weapon, power ${it.card.rank}. Added to your dungeon deck.` : `Potion, heals ${it.card.rank}. Added to your dungeon deck.`);
        el.innerHTML += `<div class="si-desc">${d}</div>`;
      }
      el.innerHTML += `<div class="price-tag">${free && !it.sold ? 'FREE' : it.price + 'g'}</div>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = it.sold ? 'SOLD' : (free ? 'TAKE' : 'BUY');
      btn.disabled = it.sold || (!free && S.gold < it.price) || (it.type === 'joker' && S.jokers.length >= S.jokerSlots);
      btn.addEventListener('click', () => playEvents(E.buyItem(i)));
      el.appendChild(btn);
      // re-attach tooltip for joker (innerHTML += nuked listeners)
      if (it.type === 'joker') {
        const jEl = el.querySelector('.joker');
        if (jEl) attachTooltip(jEl, `<div class="tt-name">${PIX.emojiImg(it.joker.emoji, 10, 16)} ${it.joker.name}</div><div class="tt-desc">${it.joker.desc}</div>`);
      }
      wrap.appendChild(el);
    });

    const sv = $('#shop-services');
    sv.innerHTML = '';
    const mkService = (label, sub, disabled, fn) => {
      const b = document.createElement('button');
      b.className = 'btn service-btn';
      b.innerHTML = `${label}<small>${sub}</small>`;
      b.disabled = disabled;
      b.addEventListener('click', fn);
      sv.appendChild(b);
    };
    mkService('PATCH UP +5 HP', `${E.HEAL_COST}g - ${S.shop.healUses} left`,
      S.shop.healUses <= 0 || S.gold < E.HEAL_COST || S.hp >= S.maxHp,
      () => playEvents(E.buyHeal()));
    mkService('REMOVE A CARD', `${S.shop.removeCost}g`, S.gold < S.shop.removeCost,
      () => { SFX.play('click'); modalRemoveCard(); });
    mkService('REROLL WARES', S.shop.rerollCost === 0 ? 'FREE' : `${S.shop.rerollCost}g`, S.gold < S.shop.rerollCost,
      () => playEvents(E.rerollShop()));
  }

  /* ============================ menu & game over ============================ */
  function renderMenu() {
    const save = E.savedRun();
    const cont = $('#btn-continue');
    cont.style.display = save ? '' : 'none';
    if (save) {
      cont.textContent = save.mode === 'classic'
        ? `CONTINUE - CLASSIC (${save.hp} HP)`
        : `CONTINUE - ACT ${ROMAN[save.act] || save.act} (${save.hp} HP)`;
    }
    const m = E.loadMeta();
    $('#menu-stats').textContent = (m.runs || 0) > 0
      ? `runs ${m.runs || 0} - wins ${m.wins || 0} - deaths ${m.deaths || 0} - best floor ${m.bestFloor || 0}`
      : 'no runs yet - pick a mode';
  }

  /* restore a saved run onto the right screen */
  function resumeRun() {
    if (!E.resume()) { renderMenu(); return; }
    if (S.pendingReward) {
      showScreen('game');
      renderAll(true);
      modalBossReward(S.pendingReward);
    } else if (S.shop) {
      showScreen('shop');
      renderShop();
    } else {
      showScreen('game');
      renderAll(true);
    }
  }

  function gameOver(victory) {
    if (!S.finalScore) return; // the run that died has already been replaced
    const scr = $('#screen-over');
    scr.classList.toggle('victory', victory);
    $('#over-title').textContent = victory ? 'ESCAPED!' : 'SLAIN';
    $('#over-sub').textContent = victory
      ? `${S.campaign.name} conquered! the scoundrel rides into legend`
      : S.mode === 'classic'
        ? `Classic Run - the dungeon keeps its dead`
        : `${S.campaign.name} - dead on floor ${S.floorNum}, Act ${ROMAN[S.act] || S.act}`;
    const fsc = S.finalScore;
    const best = E.localScores().filter(s => s.mode === fsc.mode)[0];
    $('#over-score').innerHTML = `
      <div class="score-panel">
        <div class="s-label">SCORE - ${fsc.mode.toUpperCase()}</div>
        <div class="s-value">${fsc.score}</div>
        <div class="s-detail">${fsc.detail}${best ? ` - device best ${best.score}` : ''}</div>
      </div>`;
    const st = S.stats;
    $('#over-stats').innerHTML = `
      <div><span>Monsters slain</span><span class="v">${st.kills}</span></div>
      <div><span>Barehanded kills</span><span class="v">${st.bareKills}</span></div>
      <div><span>Damage taken</span><span class="v">${st.dmgTaken}</span></div>
      <div><span>HP healed</span><span class="v">${st.healed}</span></div>
      <div><span>Gold earned</span><span class="v">${st.goldEarned}</span></div>
      <div><span>Floors cleared</span><span class="v">${st.floors}</span></div>
      <div><span>Bosses felled</span><span class="v">${st.bosses}</span></div>
      <div><span>Rooms fled</span><span class="v">${st.fled}</span></div>`;
    if (victory) SFX.play('fanfare');
    showScreen('over');
  }

  return {
    showScreen, renderAll, renderSidebar, renderPiles, renderJokers, renderRoom, renderBoss, renderShop,
    renderMenu, resumeRun, playEvents, floatAt, floatCenter, shake, hurtFlash, spawnBurst, particleLoop,
    openModal, closeModal, modalHowTo, modalDeckView, modalDiscardView, modalAbandon, modalBossReward,
    modalLeaderboard, modalSubmitScore, modalDeckGrows,
    bossSplash, gameOver, flyTo, fleeWithFlight,
    get busy() { return busy; },
  };
})();
