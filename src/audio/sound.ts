// 軽量チップチューン音源（WebAudio）。
// MIDI ファイルはブラウザでそのまま再生できないため、レトロな矩形波/三角波を
// その場で合成する。BGM のメロディは下記 BGM 配列がシード（docs にも .mid を同梱）。
//
// 純粋関数（noteToFreq / sequenceDuration）と音色データは import 時に
// ブラウザ API へ触れないので、Node 環境のユニットテストから安全に読める。

export type Tone = { note: string | null; dur: number }; // dur=秒, note=null は休符

const SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

// 音名（例 'A4', 'C#5'）→ 周波数(Hz)。平均律, A4=440。
export function noteToFreq(note: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`invalid note: ${note}`);
  const semis = SEMITONE[m[1]] + (parseInt(m[2], 10) - 4) * 12 - 9; // A4 からの半音差
  return 440 * Math.pow(2, semis / 12);
}

// シーケンス総再生時間(秒)。BGM ループ長の算出に使う。
export function sequenceDuration(seq: Tone[]): number {
  return seq.reduce((s, t) => s + t.dur, 0);
}

export type SeName = 'feed' | 'sleep' | 'pickup' | 'achievement';

type SeDef = { type: OscillatorType; vol: number; seq: Tone[] };

// 効果音（短いチップチューン）
export const SE: Record<SeName, SeDef> = {
  feed: { type: 'square', vol: 0.25, seq: [{ note: 'C5', dur: 0.08 }, { note: 'E5', dur: 0.12 }] },
  sleep: { type: 'triangle', vol: 0.25, seq: [{ note: 'A4', dur: 0.14 }, { note: 'E4', dur: 0.22 }] },
  pickup: { type: 'square', vol: 0.2, seq: [{ note: 'E6', dur: 0.07 }] },
  achievement: {
    type: 'square', vol: 0.22,
    seq: [{ note: 'C5', dur: 0.09 }, { note: 'E5', dur: 0.09 }, { note: 'G5', dur: 0.09 }, { note: 'C6', dur: 0.2 }],
  },
};

const BEAT = 0.36; // 1拍の秒数（やさしめテンポ）
const q = (note: string | null): Tone => ({ note, dur: BEAT });
const h = (note: string | null): Tone => ({ note, dur: BEAT * 2 });

// 育成画面の BGM（C メジャー・たまごっち風のやさしい循環）
export const BGM: Tone[] = [
  q('C5'), q('E5'), q('G5'), q('E5'),
  q('A4'), q('C5'), q('E5'), q('C5'),
  q('F4'), q('A4'), q('C5'), q('A4'),
  q('G4'), q('B4'), h('D5'),
];

const ABEAT = 0.18; // アクションは速めテンポ
const a = (note: string | null): Tone => ({ note, dur: ABEAT });

// アクション画面の BGM（軽快な循環・少し元気め）
export const BGM_ACTION: Tone[] = [
  a('E5'), a('G5'), a('A5'), a('G5'), a('E5'), a('D5'), a('E5'), a(null),
  a('C5'), a('E5'), a('G5'), a('E5'), a('A5'), a('G5'), a('E5'), a(null),
  a('D5'), a('F5'), a('A5'), a('F5'), a('D5'), a('C5'), a('D5'), a(null),
  a('G4'), a('B4'), a('D5'), a('B4'), a('E5'), a('D5'), a('C5'), a(null),
];

export type BgmTrack = 'care' | 'action';
const BGM_TRACKS: Record<BgmTrack, { seq: Tone[]; type: OscillatorType; vol: number }> = {
  care: { seq: BGM, type: 'triangle', vol: 0.16 },
  action: { seq: BGM_ACTION, type: 'square', vol: 0.13 },
};

const MUTE_KEY = 'dogwalk-muted';

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;
  private bgmTimer: ReturnType<typeof setTimeout> | null = null;
  private bgmRunning = false;
  private currentTrack: BgmTrack | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this._muted = localStorage.getItem(MUTE_KEY) === '1';
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  // ブラウザの自動再生制限を解くため、最初のユーザー操作で呼ぶ。
  unlock(): void {
    const c = this.ensure();
    if (c && c.state === 'suspended') void c.resume();
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  private blip(freq: number, start: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    // 短いアタック→指数減衰のシンプルなエンベロープ
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  playSE(name: SeName): void {
    this.unlock();
    if (!this.ctx) return;
    const def = SE[name];
    let t = this.ctx.currentTime;
    for (const tone of def.seq) {
      if (tone.note) this.blip(noteToFreq(tone.note), t, tone.dur, def.type, def.vol);
      t += tone.dur;
    }
  }

  startBgm(track: BgmTrack = 'care'): void {
    this.unlock();
    if (!this.ctx) return;
    if (this.bgmRunning && this.currentTrack === track) return; // 同じ曲は二重起動しない
    this.stopBgm(); // 別の曲が鳴っていたら止めて切替
    this.bgmRunning = true;
    this.currentTrack = track;
    const def = BGM_TRACKS[track];
    const loopLen = sequenceDuration(def.seq);
    const schedule = () => {
      if (!this.bgmRunning || !this.ctx) return;
      let t = this.ctx.currentTime + 0.05;
      for (const tone of def.seq) {
        if (tone.note) this.blip(noteToFreq(tone.note), t, tone.dur * 0.95, def.type, def.vol);
        t += tone.dur;
      }
      this.bgmTimer = setTimeout(schedule, loopLen * 1000);
    };
    schedule();
  }

  stopBgm(): void {
    this.bgmRunning = false;
    this.currentTrack = null;
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const sound = new SoundManager();
