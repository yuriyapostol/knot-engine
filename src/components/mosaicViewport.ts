/**
 * SVG uses a square viewBox with xMidYMid meet: the actual scale is based on
 * the shorter rendered dimension, not the width or height independently.
 * Plane camera coordinates use upward-positive Y; SVG screen Y points down.
 */
export function mosaicPanCenter(
  initial: readonly [number, number],
  deltaX: number,
  deltaY: number,
  visibleHeight: number,
  width: number,
  height: number,
): [number, number] {
  const side = Math.min(width, height)
  if (!Number.isFinite(side) || side <= 0) return [...initial]
  const unitsPerPixel = visibleHeight / side
  return [
    initial[0] - deltaX * unitsPerPixel,
    initial[1] + deltaY * unitsPerPixel,
  ]
}
