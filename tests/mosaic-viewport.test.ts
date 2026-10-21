import { describe, expect, it } from 'vitest'
import { mosaicPanCenter } from '../src/components/mosaicViewport'

describe('mosaic viewport panning', () => {
  it('uses the shorter side when the viewport is wide', () => {
    expect(mosaicPanCenter([4,4], 100, 50, 8, 800, 400)).toEqual([2,5])
  })
  it('uses the shorter side when the viewport is tall', () => {
    expect(mosaicPanCenter([4,4], 100, -50, 8, 400, 800)).toEqual([2,3])
  })
  it('preserves center for zero-sized viewports', () => {
    expect(mosaicPanCenter([4,4], 100, 50, 8, 0, 400)).toEqual([4,4])
  })
  it('does not mutate the initial camera center', () => {
    const initial: [number,number] = [4,4]
    mosaicPanCenter(initial, 20, 10, 8, 400, 400)
    expect(initial).toEqual([4,4])
  })
})
