// Small procedural audio bus: original cues + a gentle market loop.
// No external assets, so the build stays fully offline.

const MELODY = [0, 2, 4, 7, 9, 7, 4, 2, 5, 7, 9, 12, 9, 7, 5, 2];
const CAMPAIGN_ROOTS = [0, 5, 7, 4];
const TOWN_ROOTS = [0, 3, 5, 4];

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.music = 0.5;
    this.sfx = 0.7;
    this.muted = false;
    this.timer = null;
    this.step = 0;
    this.mood = 'campaign';
    this.energy = 0.25;
    this.lastCue = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.music * 0.3;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfx * 0.5;
    this.sfxGain.connect(this.master);
  }

  applySettings({ music, sfx, muted }) {
    if (typeof music === 'number') this.music = music;
    if (typeof sfx === 'number') this.sfx = sfx;
    if (typeof muted === 'boolean') this.muted = muted;
    if (this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.music * 0.3, this.ctx.currentTime, 0.08);
      this.sfxGain.gain.value = this.sfx * 0.5;
      this.master.gain.value = this.muted ? 0 : 1;
    }
  }

  note(freq, dur, type = 'sine', gain = 0.2, dest = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  cue(name) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (this.lastCue[name] && now - this.lastCue[name] < 90) return;
    this.lastCue[name] = now;
    switch (name) {
      case 'place': this.note(523, 0.09, 'triangle', 0.16); break;
      case 'error': this.note(196, 0.16, 'square', 0.06); break;
      case 'complete': this.note(698, 0.1, 'triangle', 0.12); break;
      case 'produce': this.note(392, 0.05, 'sine', 0.03); break;
      case 'good': this.note(784, 0.09, 'sine', 0.1); break;
      case 'customer': this.note(440, 0.08, 'sine', 0.06); break;
      case 'leave': this.note(330, 0.18, 'sine', 0.06); break;
      case 'melt': this.note(415, 0.2, 'sine', 0.08); this.note(311, 0.26, 'sine', 0.06); break;
      case 'order':
        this.note(523, 0.12, 'triangle', 0.14);
        this.note(659, 0.14, 'triangle', 0.12);
        this.note(784, 0.2, 'triangle', 0.12);
        break;
      case 'unlock':
        this.note(392, 0.14, 'triangle', 0.12);
        this.note(523, 0.14, 'triangle', 0.12);
        this.note(659, 0.22, 'triangle', 0.12);
        break;
      default: break;
    }
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.step = 0;
    this.timer = setInterval(() => {
      if (!this.ctx || this.muted || this.music <= 0.001) return;
      const roots = this.mood === 'town' ? TOWN_ROOTS : CAMPAIGN_ROOTS;
      const root = roots[Math.floor(this.step / 16) % roots.length];
      const semi = MELODY[this.step % MELODY.length];
      const freq = 261.63 * Math.pow(2, (root + semi) / 12);

      // Soft felt-piano-like melody, a held triangle chord, and a warm low pulse.
      this.note(freq, 0.48, 'sine', 0.032, this.musicGain);
      if (this.step % 4 === 0) {
        const chord = this.step % 8 === 0 ? [0, 4, 7] : [0, 3, 7];
        chord.forEach((tone, index) => {
          const chordRoot = 130.81 * Math.pow(2, root / 12);
          this.note(chordRoot * Math.pow(2, tone / 12), 1.75, 'triangle', index === 0 ? 0.012 : 0.007, this.musicGain);
        });
        this.note(65.41 * Math.pow(2, root / 12), 1.15, 'sine', 0.026, this.musicGain);
      }
      if (this.step % 16 === 6) this.note(freq * 2, 0.72, 'triangle', 0.014, this.musicGain);
      if (this.energy > 0.65 && this.step % 8 === 3) this.note(freq * 1.5, 0.22, 'sine', 0.009, this.musicGain);
      this.step++;
    }, 560);
  }

  setMood(town = false) {
    this.mood = town ? 'town' : 'campaign';
  }

  setEnergy(value = 0) {
    this.energy = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  stopMusic() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
