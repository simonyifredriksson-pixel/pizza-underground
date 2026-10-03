/* Audio.js - every sound is synthesised, there are no audio files.
   The context is created on the first click (browsers insist). Music is a
   small generative "suspicious jazz" loop: walking bass, brushed hats and a
   sneaky melody that gets tenser when the police are after you. */

let ctx = null;

export class Audio {
  constructor() {
    this.enabled = false;
    this.vol = 0.8; this.musicVol = 0.45;
    this.listener = { x: 0, z: 0 };
    this.step = 0; this.next = 0; this.tense = 0; this.musicOn = true;
  }

  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.enabled = true;
    this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
    const n = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // car engine + fire crackle beds
    this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 45;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 420;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(ef); ef.connect(this.engGain); this.engGain.connect(this.sfx); this.eng.start();
    this.fire = this._bed('bandpass', 1800, 0.7);
    this.rainBed = this._bed('highpass', 2500, 0.5);
    this.siren = ctx.createOscillator(); this.siren.type = 'triangle'; this.siren.frequency.value = 700;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.siren.connect(this.sirenGain); this.sirenGain.connect(this.sfx); this.siren.start();
  }

  _bed(type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
    return { src, f, g };
  }

  setVolume(v, m) {
    this.vol = v; this.musicVol = m;
    if (!ctx) return;
    this.master.gain.value = v; this.music.gain.value = m * 0.5;
  }

  _att(pos, ref = 12) {
    if (!pos) return 1;
    const d = Math.hypot(pos.x - this.listener.x, pos.z - this.listener.z);
    return 1 / (1 + d / ref);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, att = 0.005, slide = 0, delay = 0, dest = null) {
    if (!ctx || vol < 0.002) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, type = 'lowpass', freq = 1000, q = 1, sweep = 0, delay = 0, dest = null) {
    if (!ctx || vol < 0.002) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  /* ---------------- effects ---------------- */
  click() { this.tone(900, 0.05, 'triangle', 0.08); }
  pickup() { this.tone(520, 0.08, 'triangle', 0.12, 0.003, 1.5); }
  drop() { this.tone(300, 0.1, 'triangle', 0.12, 0.003, 0.6); }
  coin() { this.tone(1320, 0.08, 'square', 0.05); this.tone(1760, 0.25, 'square', 0.05, 0.005, 0, 0.07); }
  cash() { for (let i = 0; i < 4; i++) this.tone(1100 + i * 220, 0.12, 'square', 0.04, 0.003, 0, i * 0.06); this.noise(0.2, 0.08, 'highpass', 4000, 1, 0, 0.25); }
  deny() { this.tone(200, 0.18, 'square', 0.08, 0.005, 0.7); }
  ding() { this.tone(1568, 0.5, 'sine', 0.18); this.tone(2093, 0.7, 'sine', 0.14, 0.005, 0, 0.18); }
  phone() { for (let i = 0; i < 2; i++) { this.tone(1760, 0.08, 'square', 0.05, 0.002, 0, i * 0.16); this.tone(2200, 0.08, 'square', 0.05, 0.002, 0, i * 0.16 + 0.08); } }
  squish(pos) { const a = this._att(pos); this.noise(0.18, 0.2 * a, 'lowpass', 600, 2, 0.5); this.tone(140, 0.14, 'sine', 0.12 * a, 0.004, 0.6); }
  splat(pos) { const a = this._att(pos); this.noise(0.12, 0.18 * a, 'bandpass', 900, 1.5, 0.4); }
  sizzle(pos) { const a = this._att(pos); this.noise(0.6, 0.06 * a, 'highpass', 5000, 0.8); }
  ovenDoor(pos) { const a = this._att(pos); this.tone(180, 0.15, 'square', 0.06 * a, 0.004, 0.8); this.noise(0.12, 0.1 * a, 'lowpass', 500); }
  timerDing(pos) { const a = this._att(pos, 20); this.tone(2400, 0.35, 'sine', 0.15 * a); this.tone(2400, 0.35, 'sine', 0.12 * a, 0.005, 0, 0.22); }
  boom(pos) { const a = this._att(pos, 30); this.noise(1.2, 0.5 * a, 'lowpass', 900, 0.7, 0.15); this.tone(70, 0.8, 'sine', 0.4 * a, 0.005, 0.4); }
  crash(pos) { const a = this._att(pos, 30); this.noise(0.9, 0.5 * a, 'lowpass', 3000, 0.6, 0.1); this.noise(0.4, 0.3 * a, 'highpass', 3500, 1); for (let i = 0; i < 6; i++) this.tone(800 + Math.random() * 2400, 0.25, 'triangle', 0.05 * a, 0.002, 0.5, 0.05 + i * 0.07); }
  thud(pos) { const a = this._att(pos); this.tone(110, 0.15, 'sine', 0.25 * a, 0.003, 0.5); this.noise(0.1, 0.1 * a, 'lowpass', 400); }
  whoosh() { this.noise(0.4, 0.15, 'bandpass', 800, 1.5, 3); }
  spray() { this.noise(0.25, 0.12, 'highpass', 2500, 0.6); }
  cheer() { for (let i = 0; i < 5; i++) this.tone(523 * [1, 1.25, 1.5, 2, 2.5][i], 0.25, 'triangle', 0.1, 0.005, 0, i * 0.08); }
  fail() { [392, 370, 349, 262].forEach((f, i) => this.tone(f, i === 3 ? 0.8 : 0.25, 'sawtooth', 0.06, 0.01, i === 3 ? 0.9 : 0, i * 0.28)); }
  whistle() { this.tone(1800, 0.3, 'sine', 0.12, 0.01, 1.3); this.tone(2400, 0.4, 'sine', 0.12, 0.01, 0.7, 0.3); }
  hey(pos) { const a = this._att(pos, 25); this.tone(260, 0.3, 'sawtooth', 0.12 * a, 0.01, 1.3); }
  honk(pos) { const a = this._att(pos, 25); this.tone(330, 0.3, 'square', 0.08 * a); this.tone(415, 0.3, 'square', 0.08 * a); }
  /** babble - a little chipmunk mumble while a line of dialogue appears */
  babble(pitch = 1) { for (let i = 0; i < 3; i++) this.tone((180 + Math.random() * 160) * pitch, 0.06, 'square', 0.035, 0.004, 1.2, i * 0.07); }
  bleep() { this.tone(1000, 0.35, 'sine', 0.12, 0.002); }
  scream(pos) { const a = this._att(pos, 20); this.tone(700, 0.9, 'sawtooth', 0.09 * a, 0.02, 1.6); this.noise(0.9, 0.12 * a, 'bandpass', 1600, 2, 1.4); }

  /* ---------------- per frame ---------------- */
  update(dt, w) {
    if (!ctx) return;
    const t = ctx.currentTime;
    this.engGain.gain.setTargetAtTime(w.engine ? 0.05 + w.engine * 0.06 : 0, t, 0.1);
    this.eng.frequency.setTargetAtTime(40 + (w.engine || 0) * 90, t, 0.1);
    this.fire.g.gain.setTargetAtTime(Math.min(0.25, (w.fire || 0) * 0.08), t, 0.3);
    this.rainBed.g.gain.setTargetAtTime((w.rain || 0) * 0.14, t, 0.5);
    const s = w.siren || 0;
    this.sirenGain.gain.setTargetAtTime(s * 0.035, t, 0.2);
    if (s) this.siren.frequency.setValueAtTime(650 + 250 * (Math.sin(t * 4) > 0 ? 1 : 0), t);
    this.tense = w.tense || 0;
    this._music(t);
  }

  _music(t) {
    if (!this.musicOn) return;
    if (this.next < t - 1) this.next = t + 0.1;
    const tempo = this.tense ? 0.16 : 0.24;
    while (this.next < t + 0.2) {
      const st = this.step++, at = this.next - t;
      // walking bass in a minor key: the "we are doing crimes" groove
      const bass = this.tense ? [55, 55, 65.4, 58.3, 55, 55, 73.4, 69.3] : [55, 65.4, 73.4, 82.4, 87.3, 82.4, 73.4, 65.4];
      if (st % 2 === 0) this.tone(bass[(st / 2) % 8], tempo * 1.8, 'triangle', 0.22, 0.01, 0, at, this.music);
      // brushed hat
      this.noise(0.05, st % 2 ? 0.04 : 0.02, 'highpass', 7000, 0.7, 0, at, this.music);
      if (st % 8 === 4) this.noise(0.12, 0.07, 'bandpass', 1800, 0.8, 0, at, this.music);
      // sneaky melody, sparse
      const mel = [440, 0, 523, 0, 494, 440, 0, 0, 392, 0, 440, 0, 330, 0, 0, 0];
      const m = mel[st % 16];
      if (m && (st >> 4) % 2 === 1) this.tone(m * (this.tense ? 1.06 : 1), tempo * 1.2, 'square', 0.025, 0.01, 0, at, this.music);
      this.next += tempo;
    }
  }
}
