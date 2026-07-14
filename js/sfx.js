/* ============================================================
   SFX — tiny Web Audio synth for game feedback sounds
   No samples, everything synthesized. SFX.play('name')
   ============================================================ */
const SFX = (() => {
  let ctx = null;
  let muted = localStorage.getItem('scoundrel_mute') === '1';

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // simple tone helper
  function tone({ freq = 440, type = 'square', dur = 0.12, vol = 0.18, slide = 0, delay = 0, attack = 0.005 }) {
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // noise burst helper (slashes, hits, shuffles)
  function noise({ dur = 0.15, vol = 0.2, delay = 0, hp = 400, lp = 6000, slide = 0 }) {
    const c = ac();
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const hpf = c.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp;
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(lp, t0);
    if (slide) lpf.frequency.exponentialRampToValueAtTime(Math.max(100, lp + slide), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hpf).connect(lpf).connect(g).connect(c.destination);
    src.start(t0);
  }

  const bank = {
    click:  () => tone({ freq: 700, type: 'triangle', dur: 0.06, vol: 0.12 }),
    hover:  () => tone({ freq: 380, type: 'sine', dur: 0.04, vol: 0.05 }),
    deal:   () => { noise({ dur: 0.09, vol: 0.12, hp: 900, lp: 5200 }); tone({ freq: 520, type: 'triangle', dur: 0.05, vol: 0.07, delay: 0.02 }); },
    flip:   () => noise({ dur: 0.07, vol: 0.1, hp: 1200 }),
    slash:  () => { noise({ dur: 0.16, vol: 0.28, hp: 1800, lp: 9000, slide: -6500 }); tone({ freq: 220, type: 'sawtooth', dur: 0.1, vol: 0.1, slide: -120 }); },
    thud:   () => { tone({ freq: 110, type: 'sine', dur: 0.22, vol: 0.35, slide: -70 }); noise({ dur: 0.1, vol: 0.15, hp: 80, lp: 900 }); },
    hurt:   () => { tone({ freq: 160, type: 'sawtooth', dur: 0.25, vol: 0.22, slide: -90 }); noise({ dur: 0.18, vol: 0.14, hp: 200, lp: 1600 }); },
    heal:   () => { tone({ freq: 620, type: 'sine', dur: 0.14, vol: 0.14 }); tone({ freq: 830, type: 'sine', dur: 0.16, vol: 0.13, delay: 0.08 }); tone({ freq: 1040, type: 'sine', dur: 0.2, vol: 0.11, delay: 0.16 }); },
    shield: () => { tone({ freq: 300, type: 'triangle', dur: 0.16, vol: 0.16 }); tone({ freq: 450, type: 'triangle', dur: 0.2, vol: 0.13, delay: 0.07 }); },
    coin:   () => { tone({ freq: 990, type: 'square', dur: 0.06, vol: 0.1 }); tone({ freq: 1320, type: 'square', dur: 0.14, vol: 0.1, delay: 0.05 }); },
    buy:    () => { tone({ freq: 660, type: 'square', dur: 0.07, vol: 0.12 }); tone({ freq: 880, type: 'square', dur: 0.07, vol: 0.12, delay: 0.07 }); tone({ freq: 1100, type: 'square', dur: 0.12, vol: 0.12, delay: 0.14 }); },
    equip:  () => { noise({ dur: 0.12, vol: 0.16, hp: 2500, lp: 9500 }); tone({ freq: 1500, type: 'triangle', dur: 0.1, vol: 0.1, delay: 0.04 }); },
    flee:   () => { noise({ dur: 0.25, vol: 0.14, hp: 600, lp: 3800, slide: -2600 }); tone({ freq: 500, type: 'triangle', dur: 0.18, vol: 0.08, slide: -220 }); },
    error:  () => tone({ freq: 150, type: 'square', dur: 0.15, vol: 0.14 }),
    joker:  () => { tone({ freq: 520, type: 'square', dur: 0.08, vol: 0.12 }); tone({ freq: 780, type: 'square', dur: 0.08, vol: 0.12, delay: 0.09 }); tone({ freq: 650, type: 'square', dur: 0.08, vol: 0.12, delay: 0.18 }); tone({ freq: 1040, type: 'square', dur: 0.18, vol: 0.13, delay: 0.27 }); },
    roar:   () => { tone({ freq: 90, type: 'sawtooth', dur: 0.7, vol: 0.3, slide: -35 }); tone({ freq: 135, type: 'sawtooth', dur: 0.6, vol: 0.2, slide: -50, delay: 0.05 }); noise({ dur: 0.5, vol: 0.12, hp: 100, lp: 700 }); },
    bosshit:() => { tone({ freq: 180, type: 'sawtooth', dur: 0.2, vol: 0.22, slide: -100 }); noise({ dur: 0.2, vol: 0.2, hp: 300, lp: 3000, slide: -2400 }); },
    die:    () => { tone({ freq: 240, type: 'sawtooth', dur: 0.9, vol: 0.25, slide: -190 }); tone({ freq: 160, type: 'square', dur: 1.0, vol: 0.15, slide: -120, delay: 0.15 }); },
    fanfare:() => { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'square', dur: i === 3 ? 0.5 : 0.14, vol: 0.14, delay: i * 0.13 })); },
    bosskill:() => { tone({ freq: 70, type: 'sine', dur: 0.8, vol: 0.4, slide: -30 }); noise({ dur: 0.6, vol: 0.25, hp: 60, lp: 1200, slide: -900 }); [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.16, vol: 0.12, delay: 0.4 + i * 0.12 })); },
    snap:   () => { noise({ dur: 0.08, vol: 0.3, hp: 2000, lp: 10000 }); tone({ freq: 2200, type: 'triangle', dur: 0.06, vol: 0.12 }); },
  };

  return {
    play(name) { if (muted || !bank[name]) return; try { bank[name](); } catch (e) { /* audio blocked until gesture */ } },
    toggleMute() { muted = !muted; localStorage.setItem('scoundrel_mute', muted ? '1' : '0'); return muted; },
    isMuted() { return muted; },
    unlock() { try { ac(); } catch (e) {} },
  };
})();
