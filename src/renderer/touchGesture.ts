// Return only the part of a vertical drag that cannot rotate beyond the limits.
export function verticalDrag(phi: number, dy: number, speed: number, min: number, max: number) {
  const angle = Math.max(min, Math.min(max, phi - dy * speed))
  const consumed = (phi - angle) / speed
  return { angle, scroll: -(dy - consumed) }
}
