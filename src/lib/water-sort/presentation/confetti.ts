import confetti from "canvas-confetti";

export function fireLevelCompleteConfetti(): void {
  void confetti({
    particleCount: 80,
    spread: 68,
    startVelocity: 34,
    origin: {x: 0.5, y: 0.58},
    disableForReducedMotion: true,
  });
}
