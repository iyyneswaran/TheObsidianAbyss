/** Preserve fixed game time across late callbacks, while bounding work after a stall. */
export function fixedClock(step: number, advance: () => void) {
  let remainder = 0;
  return (delta: number) => {
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    remainder = Math.min(step * 4, remainder + delta);
    const count = Math.floor((remainder + 1e-7) / step);
    remainder = Math.max(0, remainder - count * step);
    for (let i = 0; i < count; i++) advance();
    return count;
  };
}
