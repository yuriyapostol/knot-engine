import { expect, it } from 'vitest'
import { convertDTToPD, convertDTTo2D, validateDTCode, validatePDCode, validateGeometry2D } from '../src/core'
import { locateCrossings } from '../src/components/geometry2d'
import type { DTCode } from '../src/core'

const dt = (code: DTCode['code']): DTCode => ({ convention: 'dt-signed-even', code })

it('converts a trefoil DT traversal into a planar PD and valid 2D geometry', () => {
  const input = dt([4,6,2]), before = JSON.stringify(input)
  expect(validateDTCode(input).valid).toBe(true)
  const pd = convertDTToPD(input)
  expect(validatePDCode(pd).valid).toBe(true)
  expect(pd.crossings).toHaveLength(3)
  const geometry = convertDTTo2D(input)
  expect(validateGeometry2D(geometry).valid).toBe(true)
  expect(geometry.elements).toHaveLength(1)
  expect(locateCrossings(geometry)).toHaveLength(6)
  expect(JSON.stringify(input)).toBe(before)
})

it('supports isolated and disconnected crossing graphs', () => {
  for (const code of [[2], [[2],[4]]] as DTCode['code'][]) {
    const input = dt(code)
    expect(validateDTCode(input).valid).toBe(true)
    const pd = convertDTToPD(input)
    expect(validatePDCode(pd).valid).toBe(true)
    const geometry = convertDTTo2D(input)
    expect(validateGeometry2D(geometry).valid).toBe(true)
  }
})

it('rejects invalid DT codes and refuses unbounded rotation searches', () => {
  expect(() => convertDTTo2D(dt([2,2]))).toThrow()
  expect(() => convertDTToPD(dt(Array.from({ length: 17 }, (_, i) => 2*i+2)))).toThrow(/16 crossings/)
})
