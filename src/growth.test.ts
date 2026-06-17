import { describe, it, expect } from 'vitest';
import { stageOf, stageNoOf } from './store/gameStore';

// MainScene が体重から組み立てるスプライトキー（命名規則: creature_<stageNo>_<form>_stop）。
// 用意済みの素材ファイル名と一致することを担保する。
const stopKey = (weight: number) =>
  `creature_${stageNoOf(weight)}_${stageOf(weight)}_stop`;

describe('成長ステージ判定（スプライト切替の基礎）', () => {
  it('体重 < 10kg は baby (stage 1)', () => {
    expect(stageOf(5)).toBe('baby');
    expect(stageNoOf(5)).toBe(1);
    expect(stageOf(9.9)).toBe('baby');
  });

  it('10kg 以上 25kg 未満は child (stage 2)', () => {
    expect(stageOf(10)).toBe('child');
    expect(stageNoOf(10)).toBe(2);
    expect(stageOf(24.9)).toBe('child');
  });

  it('25kg 以上は adult (stage 3)', () => {
    expect(stageOf(25)).toBe('adult');
    expect(stageNoOf(25)).toBe(3);
    expect(stageOf(100)).toBe('adult');
  });

  it('組み立てたキーが用意済みの素材ファイル名と一致する', () => {
    expect(stopKey(5)).toBe('creature_1_baby_stop');
    expect(stopKey(15)).toBe('creature_2_child_stop');
    expect(stopKey(30)).toBe('creature_3_adult_stop');
  });
});
