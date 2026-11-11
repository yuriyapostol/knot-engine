import { expect, it } from 'vitest'
import { convertPDTo2D, validateGeometry2D, validatePDCode } from '../src/core'
import { locateCrossings } from '../src/components/geometry2d'
import type { PDCode } from '../src/core'

const pd = (crossings: PDCode['crossings'], unlinkedComponents?: number): PDCode => ({
  convention: 'pd-ccw-under-first', crossings, ...(unlinkedComponents === undefined ? {} : { unlinkedComponents }),
})

it('converts the trefoil into a closed 2D curve with three crossings', () => {
  const input = pd([[1,5,2,4],[3,1,4,6],[5,3,6,2]])
  const before = JSON.stringify(input)
  const output = convertPDTo2D(input)
  expect(JSON.stringify(input)).toBe(before)
  expect(output.elements).toHaveLength(1)
  expect(output.crossings).toHaveLength(6)
  expect(validateGeometry2D(output).valid).toBe(true)
  expect(locateCrossings(output)).toHaveLength(6)
})

it('converts a two-component link and preserves crossing passage order', () => {
  const input = pd([[6,1,7,2],[8,3,5,4],[2,5,3,6],[4,7,1,8]])
  expect(validatePDCode(input).valid).toBe(true)
  const output = convertPDTo2D(input)
  expect(output.elements).toHaveLength(2)
  expect(output.crossings).toHaveLength(8)
  expect(validateGeometry2D(output).valid).toBe(true)
  expect(locateCrossings(output)).toHaveLength(8)
})

it('supports crossing-free circles and disconnected crossing graphs', () => {
  for (const input of [
    pd([], 2),
    pd([[1,1,2,2]], 1),
    pd([[1,1,2,2],[3,3,4,4]], 1),
  ]) {
    expect(validatePDCode(input).valid).toBe(true)
    const output = convertPDTo2D(input)
    expect(validateGeometry2D(output).valid).toBe(true)
    expect(locateCrossings(output)).toHaveLength(input.crossings.length * 2)
  }
})

it('rejects invalid rotation systems', () => {
  expect(() => convertPDTo2D(pd([[1,2,1,2]]))).toThrow()
})
