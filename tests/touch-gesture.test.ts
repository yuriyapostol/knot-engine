import { describe, expect, it } from 'vitest'
import { verticalDrag } from '../src/renderer/touchGesture'

const min = 0.05, max = Math.PI - 0.05, speed = 0.01

describe('touch rotation and page scrolling', () => {
  it('consumes vertical movement inside the angle limits', () => {
    const drag = verticalDrag(1.5, 30, speed, min, max)
    expect(drag.angle).toBeCloseTo(1.2)
    expect(drag.scroll).toBeCloseTo(0)
  })
  it('scrolls only the unused movement when a drag reaches either limit', () => {
    const upper = verticalDrag(min + 0.1, 30, speed, min, max)
    expect(upper.angle).toBe(min)
    expect(upper.scroll).toBeCloseTo(-20)
    const lower = verticalDrag(max - 0.1, -30, speed, min, max)
    expect(lower.angle).toBe(max)
    expect(lower.scroll).toBeCloseTo(20)
  })
  it('scrolls continued outward movement and immediately rotates on reversal', () => {
    expect(verticalDrag(min, 20, speed, min, max).scroll).toBe(-20)
    expect(verticalDrag(max, -20, speed, min, max).scroll).toBe(20)
    const fromMin = verticalDrag(min, -20, speed, min, max)
    expect(fromMin.angle).toBeCloseTo(min + 0.2)
    expect(fromMin.scroll).toBeCloseTo(0)
    const fromMax = verticalDrag(max, 20, speed, min, max)
    expect(fromMax.angle).toBeCloseTo(max - 0.2)
    expect(fromMax.scroll).toBeCloseTo(0)
  })
})
