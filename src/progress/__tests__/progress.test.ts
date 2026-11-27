import { continueLevel, initialProgress, normalizeProgress, recordCompletion } from '../progress';
import { normalizeSettings, DEFAULT_SETTINGS } from '../../settings/settings';

const order = ['1', '2', '3'];

describe('progress', () => {
  it('starts with only the first level unlocked', () => {
    expect(initialProgress(order).unlocked).toEqual(['1']);
  });

  it('completing a level unlocks the next and keeps the best result', () => {
    let p = recordCompletion(initialProgress(order), order, '1', 9);
    expect(p.unlocked).toEqual(['1', '2']);
    p = recordCompletion(p, order, '1', 12);
    expect(p.completed['1'].bestMoves).toBe(9);
    p = recordCompletion(p, order, '1', 7);
    expect(p.completed['1'].bestMoves).toBe(7);
  });

  it('survives a save/load round trip and repairs bad data', () => {
    const p = recordCompletion(initialProgress(order), order, '1', 5);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)), order)).toEqual(p);
    expect(normalizeProgress('garbage', order)).toEqual(initialProgress(order));
    expect(normalizeProgress({ version: 1, unlocked: ['zz'], completed: { '2': { bestMoves: 3 } } }, order).unlocked).toEqual([
      '1',
      '3',
    ]);
  });

  it('continues from the last unfinished level', () => {
    let p = recordCompletion(initialProgress(order), order, '1', 5);
    expect(continueLevel(p, order)).toBe('2');
    p = { ...p, lastPlayed: '1' };
    expect(continueLevel(p, order)).toBe('2');
  });
});

describe('settings', () => {
  it('fills defaults', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ sound: false }).sound).toBe(false);
  });
});
