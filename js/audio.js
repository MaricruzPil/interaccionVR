export class AudioFeedback {
  constructor() {
    this.context = null;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  tone(frequency, duration, type = 'sine', gainValue = 0.035, delay = 0) {
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  start() {
    this.tone(420, 0.1, 'triangle');
    this.tone(630, 0.14, 'triangle', 0.03, 0.08);
  }

  grab() {
    this.tone(260, 0.05, 'sine', 0.018);
  }

  release() {
    this.tone(180, 0.045, 'sine', 0.014);
  }

  correct() {
    this.tone(660, 0.1, 'triangle');
    this.tone(880, 0.16, 'triangle', 0.03, 0.08);
  }

  error() {
    this.tone(160, 0.16, 'square', 0.022);
  }

  finish() {
    this.tone(520, 0.12, 'triangle');
    this.tone(780, 0.12, 'triangle', 0.03, 0.12);
    this.tone(1040, 0.24, 'triangle', 0.03, 0.24);
  }
}
