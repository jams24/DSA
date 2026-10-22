import { BOSS_HEARTS, BOSS_HP } from "./engine";

export interface BossResult {
  won: boolean;
  heartsLeft: number;
  bossHp: number;
  /** how many of the given answers were consumed before the fight ended */
  used: number;
  correct: number;
}

/** Replays a fight from an ordered list of right/wrong answers. */
export function simulateBoss(results: boolean[]): BossResult {
  let hp = BOSS_HP;
  let hearts = BOSS_HEARTS;
  let used = 0;
  let correct = 0;
  for (const ok of results) {
    if (hp === 0 || hearts === 0) break;
    used++;
    if (ok) {
      hp--;
      correct++;
    } else hearts--;
  }
  return { won: hp === 0, heartsLeft: hearts, bossHp: hp, used, correct };
}
