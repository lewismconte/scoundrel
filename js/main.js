/* ============================================================
   MAIN — boot & global wiring
   ============================================================ */
(() => {
  const $ = s => document.querySelector(s);

  // audio unlock on first gesture (browser autoplay policy)
  window.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  // --- sidebar / global buttons ---
  $('#btn-flee').addEventListener('click', () => UI.fleeWithFlight());

  $('#btn-howto').addEventListener('click', () => { SFX.play('click'); UI.modalHowTo(); });
  $('#btn-howto2').addEventListener('click', () => { SFX.play('click'); UI.modalHowTo(); });

  // mute — one state, two buttons (menu + game sidebar)
  const muteBtns = [$('#btn-mute'), $('#btn-mute-menu')].filter(Boolean);
  const syncMute = () => muteBtns.forEach(b => b.textContent = SFX.isMuted() ? '🔇' : '🔊');
  muteBtns.forEach(b => b.addEventListener('click', () => { SFX.toggleMute(); SFX.play('click'); syncMute(); }));
  syncMute();

  // fullscreen — same deal (hidden on devices that can't fullscreen an element, e.g. iPhone Safari)
  const fsBtns = [$('#btn-fullscreen'), $('#btn-fullscreen-menu')].filter(Boolean);
  const root = document.documentElement;
  const reqFS = root.requestFullscreen || root.webkitRequestFullscreen;
  const exitFS = document.exitFullscreen || document.webkitExitFullscreen;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (!reqFS) {
    fsBtns.forEach(b => b.style.display = 'none');
  } else {
    fsBtns.forEach(b => b.addEventListener('click', () => {
      SFX.play('click');
      if (fsEl()) exitFS.call(document);
      else reqFS.call(root);
    }));
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
      document.addEventListener(ev, () => {
        const on = !!fsEl();
        fsBtns.forEach(b => {
          b.classList.toggle('active', on);
          b.title = on ? 'Exit fullscreen' : 'Fullscreen';
        });
      }));
  }

  $('#btn-abandon').addEventListener('click', () => { SFX.play('click'); UI.modalAbandon(); });
  $('#deck-pile').addEventListener('click', () => { SFX.play('flip'); UI.modalDeckView(); });
  $('#discard-pile').addEventListener('click', () => { SFX.play('flip'); UI.modalDiscardView(); });

  // --- shop ---
  $('#btn-delve').addEventListener('click', () => { SFX.play('click'); E.leaveShop(); });

  // --- menu: modes, continue, leaderboard ---
  $('#mode-classic').addEventListener('click', () => { SFX.unlock(); SFX.play('joker'); E.newClassicRun(); });
  $('#mode-gauntlet').addEventListener('click', () => { SFX.unlock(); SFX.play('joker'); E.newRun(); });
  $('#btn-continue').addEventListener('click', () => { SFX.unlock(); SFX.play('deal'); UI.resumeRun(); });
  $('#btn-board').addEventListener('click', () => { SFX.play('click'); UI.modalLeaderboard(); });

  // --- game over ---
  $('#btn-again').addEventListener('click', () => { SFX.play('click'); UI.renderMenu(); UI.showScreen('menu'); });
  $('#btn-submit-score').addEventListener('click', () => { SFX.play('click'); UI.modalSubmitScore(); });

  // click anywhere else closes monster choosers
  document.addEventListener('click', e => {
    if (!e.target.closest('.card')) {
      document.querySelectorAll('.chooser').forEach(el => el.remove());
    }
  });

  // esc closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal-wrap').classList.contains('hidden')) UI.closeModal();
  });

  // pixel-sprite dressing for static chrome
  $('#hp-heart').innerHTML = PIX.emojiImg('❤️', 12, 34);
  document.querySelector('.tc1').innerHTML = 'A' + PIX.suitImg('S', 18);
  document.querySelector('.tc2').innerHTML = PIX.emojiImg('🃏', 14, 38);
  document.querySelector('.tc3').innerHTML = 'K' + PIX.suitImg('H', 18);
  document.querySelector('#mode-classic .mode-emoji').innerHTML = PIX.emojiImg('🗡️', 12, 36);
  document.querySelector('#mode-gauntlet .mode-emoji').innerHTML = PIX.emojiImg('🃏', 12, 36);

  // boot
  UI.particleLoop();
  UI.renderMenu();
  UI.showScreen('menu');
})();
