import type { VialAnchor } from "./render-state";

export function measureVialAnchors(
  boardElement: HTMLElement,
  vialElements: ReadonlyMap<number, HTMLElement>,
  vialCount: number,
): VialAnchor[] {
  const boardRect = boardElement.getBoundingClientRect();
  return Array.from({length: vialCount}, (_, vialIndex) => {
    const element = vialElements.get(vialIndex);
    if (element === undefined) return {x: 0, y: 0, width: 1, height: 1};
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  });
}
