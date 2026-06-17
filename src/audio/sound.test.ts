import { describe, it, expect } from 'vitest';
import { noteToFreq, sequenceDuration, SE, BGM, BGM_ACTION, type Tone } from './sound';

describe('noteToFreq', () => {
  it('A4 = 440Hz', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 5);
  });

  it('C4 ≈ 261.63Hz', () => {
    expect(noteToFreq('C4')).toBeCloseTo(261.626, 2);
  });

  it('1オクターブ上で周波数2倍', () => {
    expect(noteToFreq('A5')).toBeCloseTo(880, 5);
  });

  it('シャープを解釈する（A#4 ≈ 466.16Hz）', () => {
    expect(noteToFreq('A#4')).toBeCloseTo(466.164, 2);
  });

  it('不正な音名は例外', () => {
    expect(() => noteToFreq('H4')).toThrow();
    expect(() => noteToFreq('A')).toThrow();
  });
});

describe('sequenceDuration', () => {
  it('各トーンの長さの合計', () => {
    const seq: Tone[] = [{ note: 'C5', dur: 0.1 }, { note: null, dur: 0.2 }, { note: 'E5', dur: 0.3 }];
    expect(sequenceDuration(seq)).toBeCloseTo(0.6, 5);
  });

  it('空シーケンスは0', () => {
    expect(sequenceDuration([])).toBe(0);
  });
});

describe('音色データの妥当性', () => {
  it('全SEのノートが有効な音名（noteToFreq が通る）', () => {
    for (const def of Object.values(SE)) {
      for (const tone of def.seq) {
        if (tone.note) expect(() => noteToFreq(tone.note as string)).not.toThrow();
        expect(tone.dur).toBeGreaterThan(0);
      }
    }
  });

  it('BGM(育成/アクション) は非空で全ノートが有効・正の長さ', () => {
    for (const track of [BGM, BGM_ACTION]) {
      expect(track.length).toBeGreaterThan(0);
      for (const tone of track) {
        if (tone.note) expect(() => noteToFreq(tone.note as string)).not.toThrow();
        expect(tone.dur).toBeGreaterThan(0);
      }
      expect(sequenceDuration(track)).toBeGreaterThan(0);
    }
  });
});
