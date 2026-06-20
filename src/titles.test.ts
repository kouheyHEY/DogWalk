import { describe, it, expect } from 'vitest';
import { titleFor, isTitleMilestone, TITLES } from './titles';

describe('titleFor', () => {
  it('5回未満は称号なし', () => {
    expect(titleFor(0)).toBeNull();
    expect(titleFor(4)).toBeNull();
  });

  it('5の倍数で称号が上がる', () => {
    expect(titleFor(5)).toBe('みならいのぬし');
    expect(titleFor(10)).toBe('いちにんまえのぬし');
    expect(titleFor(25)).toBe('でんせつのぬし');
  });

  it('途中の回数は到達済みの最高称号を返す', () => {
    expect(titleFor(7)).toBe('みならいのぬし');
    expect(titleFor(24)).toBe('めいじんのぬし');
  });

  it('TITLES を超えたら最後の称号に ★n', () => {
    expect(titleFor(30)).toBe(`${TITLES[TITLES.length - 1]}★1`);
    expect(titleFor(40)).toBe(`${TITLES[TITLES.length - 1]}★3`);
  });
});

describe('isTitleMilestone', () => {
  it('5の倍数のときだけ true', () => {
    expect(isTitleMilestone(5)).toBe(true);
    expect(isTitleMilestone(10)).toBe(true);
    expect(isTitleMilestone(6)).toBe(false);
    expect(isTitleMilestone(0)).toBe(false);
  });
});
