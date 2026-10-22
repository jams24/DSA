// Tiny chiptune sound effects synthesized with WebAudio — no audio files to load.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !enabled) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slide?: number } = {}) {
  const a = audio();
  if (!a) return;
  const { type = "square", vol = 0.04, at = 0, slide } = opts;
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.05, { vol: 0.025 }),
  correct: () => {
    tone(784, 0.08);
    tone(1046, 0.14, { at: 0.08 });
  },
  wrong: () => tone(220, 0.25, { type: "sawtooth", vol: 0.03, slide: 110 }),
  xp: () => {
    tone(988, 0.06, { vol: 0.03 });
    tone(1318, 0.1, { at: 0.06, vol: 0.03 });
  },
  hit: () => {
    tone(180, 0.12, { type: "square", vol: 0.05, slide: 60 });
    tone(1200, 0.05, { at: 0.02, vol: 0.02 });
  },
  hurt: () => tone(140, 0.3, { type: "sawtooth", vol: 0.05, slide: 70 }),
  achievement: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { at: i * 0.09, vol: 0.035 })),
  levelUp: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.14, { at: i * 0.08, vol: 0.04, type: "triangle" })),
  victory: () =>
    [523, 523, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, i === 6 ? 0.4 : 0.12, { at: i * 0.12, vol: 0.04 })),
  defeat: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, { at: i * 0.22, vol: 0.04, type: "triangle" })),
  tick: () => tone(1500, 0.02, { vol: 0.015 }),
};
