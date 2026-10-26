import { isCompleteVial } from "../domain/solved";
import type { AppliedMove } from "../domain/types";

export const COMBO_GRACE_MILLISECONDS = 500;
export const COMBO_MAX_FONT_LEVEL = 15;

export function comboFontSizePixels(count: number): number {
  const level = Math.max(2, Math.min(COMBO_MAX_FONT_LEVEL, count));
  return 32 + (level - 2) * (32 / (COMBO_MAX_FONT_LEVEL - 2));
}

export function isComboEligible(move: AppliedMove, capacity: number): boolean {
  const source = move.previousBoard[move.move.sourceVialIndex];
  return source !== undefined && !isCompleteVial(source, capacity);
}

/**
 * Logical combo awards are associated with the accepted presentation IDs, not
 * exposed until their actual GSAP presentations begin.
 */
export class ComboTracker {
  private queued = new Map<number, number | null>();
  private activeEligible = new Set<number>();
  private lastEligibleFinishAt = -Infinity;
  private chainCount = 0;

  accept(id: number, move: AppliedMove, capacity: number, now: number): void {
    if (this.queued.has(id)) return;
    if (!isComboEligible(move, capacity)) {
      this.queued.set(id, null);
      return;
    }
    const linked = this.activeEligible.size > 0
      || now <= this.lastEligibleFinishAt + COMBO_GRACE_MILLISECONDS;
    this.chainCount = linked ? this.chainCount + 1 : 1;
    this.queued.set(id, this.chainCount);
    this.activeEligible.add(id);
    // Accepted pours can be queued behind animations. A queued eligible pour
    // keeps the chain active without revealing its count to the player.
  }

  start(id: number): number | null {
    return this.queued.get(id) ?? null;
  }

  finish(id: number, now: number): void {
    if (!this.queued.has(id)) return;
    const count = this.queued.get(id);
    this.queued.delete(id);
    if (count === null) return;
    this.activeEligible.delete(id);
    if (this.activeEligible.size === 0) this.lastEligibleFinishAt = now;
  }

  reset(): void {
    this.queued.clear();
    this.activeEligible.clear();
    this.chainCount = 0;
    this.lastEligibleFinishAt = -Infinity;
  }
}
