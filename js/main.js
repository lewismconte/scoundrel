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

  const muteBtn = $('#btn-mute');
  const syncMute = () => muteBtn.textContent = SFX.isMuted() ? '🔇' : '🔊';
  muteBtn.addEventListener('click', () => { SFX.toggleMute(); SFX.play('click'); syncMute(); });
  syncMute();

  // fullscreen (hidden on devices that can't fullscreen an element, e.g. iPhone Safari)
  const fsBtn = $('#btn-fullscreen');
  const root = document.documentElement;
  const reqFS = root.requestFullscreen || root.webkitRequestFullscreen;
  const exitFS = document.exitFullscreen || document.webkitExitFullscreen;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (!reqFS) {
    fsBtn.style.display = 'none';
  } else {
    fsBtn.addEventListener('click', () => {
      SFX.play('click');
      if (fsEl()) exitFS.call(document);
      else reqFS.call(root);
    });
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
      document.addEventListener(ev, () => {
        const on = !!fsEl();
        fsBtn.classList.toggle('active', on);
        fsBtn.title = on ? 'Exit fullscreen' : 'Fullscreen';
      }));
  }

  $('#btn-abandon').addEventListener('click', () => { SFX.play('click'); UI.modalAbandon(); });
  $('#deck-pile').addEventListener('click', () => { SFX.play('flip'); UI.modalDeckView(); });
  $('#discard-pile').addEventListener('click', () => { SFX.play('flip'); UI.modalDiscardView(); });

  // --- shop ---
  $('#btn-delve').addEventListener('click', () => { SFX.play('click'); E.leaveShop(); });

  // --- game over ---
  $('#btn-again').addEventListener('click', () => { SFX.play('click'); UI.renderMenu(); UI.showScreen('menu'); });

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
  document.querySelector('.tc1').innerHTML = 'A' + PIX.suitImg('S', 22);
  document.querySelector('.tc2').innerHTML = PIX.emojiImg('🃏', 14, 48);
  document.querySelector('.tc3').innerHTML = 'K' + PIX.suitImg('H', 22);

  // boot
  UI.particleLoop();
  UI.renderMenu();
  UI.showScreen('menu');
})();
