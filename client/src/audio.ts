// 효과음과 배경음악은 파일 없이 WebAudio로 만든다 (저작권 문제가 없다)
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bgmGain: GainNode | null = null;
let delay: DelayNode | null = null;
let bgmTimer = 0;
const settings = (() => {
  try {
    return JSON.parse(localStorage.getItem("fishing.audio") ?? "{}");
  } catch {
    return {};
  }
})() as { volume?: number; muted?: boolean };
let volume = settings.volume ?? 0.6;
let muted = settings.muted ?? false;

function save() {
  try {
    localStorage.setItem("fishing.audio", JSON.stringify({ volume, muted }));
  } catch {
    // 저장 못 해도 이번 접속에는 문제없다
  }
}

/** 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허용한다 */
export function initAudio() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(ctx.destination);
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.35;
  delay = ctx.createDelay(1);
  delay.delayTime.value = 0.32;
  const fb = ctx.createGain();
  fb.gain.value = 0.35;
  delay.connect(fb).connect(delay);
  bgmGain.connect(master);
  bgmGain.connect(delay);
  delay.connect(master);
}

export function getAudio() {
  return { volume, muted };
}
export function setVolume(v: number) {
  volume = v;
  if (master) master.gain.value = muted ? 0 : v;
  save();
}
export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : volume;
  save();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, dest: AudioNode, slideTo?: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, gain: number, from: number, to: number) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(from, start);
  f.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master);
  src.start(start);
}

export const sfx = {
  cast() {
    if (!ctx || !master) return;
    noise(ctx.currentTime, 0.45, 0.35, 600, 2600);
  },
  splash() {
    if (!ctx || !master) return;
    noise(ctx.currentTime, 0.4, 0.4, 1800, 500);
  },
  bite() {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    tone(880, t, 0.12, "triangle", 0.35, master);
    tone(1320, t + 0.1, 0.18, "triangle", 0.35, master);
  },
  reel() {
    if (!ctx || !master) return;
    tone(300, ctx.currentTime, 0.2, "sawtooth", 0.1, master, 700);
  },
  success(rarity: string) {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const notes = rarity === "mythic" ? [523, 659, 784, 1047, 1319, 1568, 2093] : rarity === "legendary" ? [523, 659, 784, 1047, 1319, 1568] : rarity === "veryRare" ? [523, 659, 784, 1047] : rarity === "rare" ? [523, 659, 784] : [523, 784];
    notes.forEach((n, i) => tone(n, t + i * 0.11, 0.35, "triangle", 0.3, master!));
  },
  /** 신화가 걸렸을 때: 사이렌처럼 올라가는 소리와 화려한 화음 */
  mythicHook() {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    tone(300, t, 0.45, "sawtooth", 0.16, master, 1300);
    tone(1300, t + 0.45, 0.45, "sawtooth", 0.14, master, 500);
    [784, 988, 1175, 1568, 2093].forEach((n, i) => tone(n, t + 0.12 + i * 0.08, 0.5, "triangle", 0.25, master!));
  },
  /** 발작 직전 3-2-1: 숫자가 줄수록 높은 소리 */
  countdown(n: number) {
    if (!ctx || !master) return;
    tone(n === 1 ? 1100 : n === 2 ? 880 : 700, ctx.currentTime, 0.2, "square", 0.22, master);
  },
  fail() {
    if (!ctx || !master) return;
    tone(330, ctx.currentTime, 0.35, "sine", 0.3, master, 150);
  },
  click() {
    if (!ctx || !master) return;
    tone(720, ctx.currentTime, 0.06, "square", 0.08, master);
  },
};

const SCALES: Record<string, { notes: number[]; bpm: number; type: OscillatorType }> = {
  lake: { notes: [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3], bpm: 70, type: "triangle" },
  pier: { notes: [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3], bpm: 92, type: "sine" },
  ice: { notes: [440, 523.3, 587.3, 659.3, 784, 880, 1046.5], bpm: 56, type: "sine" },
  cruise: { notes: [261.6, 329.6, 392, 440, 523.3, 659.3, 784], bpm: 108, type: "triangle" },
};

export function startBgm(mapId: string) {
  stopBgm();
  if (!ctx || !bgmGain) return;
  const sc = SCALES[mapId] ?? SCALES.lake;
  let step = 0;
  const beat = 60 / sc.bpm;
  const play = () => {
    if (!ctx || !bgmGain) return;
    const t = ctx.currentTime + 0.05;
    const i = Math.floor(Math.random() * sc.notes.length);
    if (step % 2 === 0) tone(sc.notes[i], t, beat * 1.6, sc.type, 0.22, bgmGain);
    if (step % 8 === 0) tone(sc.notes[0] / 2, t, beat * 6, "sine", 0.18, bgmGain);
    if (step % 4 === 3 && Math.random() < 0.6) tone(sc.notes[(i + 2) % sc.notes.length] * 2, t + beat * 0.5, beat, sc.type, 0.1, bgmGain);
    step++;
  };
  play();
  bgmTimer = window.setInterval(play, beat * 1000);
}

export function stopBgm() {
  clearInterval(bgmTimer);
}
