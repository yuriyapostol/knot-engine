import { expect, it } from 'vitest'
import { convertPDToDT, convertDTToPD, validatePDCode, validateDTCode } from '../src/core'
import type { PDCode, DTCode } from '../src/core'

const pd = (crossings: PDCode['crossings'], unlinkedComponents?: number): PDCode =>
  ({ convention: 'pd-ccw-under-first', crossings, ...(unlinkedComponents === undefined ? {} : { unlinkedComponents }) })
const dt = (code: DTCode['code']): DTCode => ({ convention: 'dt-signed-even', code })

it('converts the trefoil to DT deterministically without mutating PD', () => {
  const input = pd([[1,5,2,4],[3,1,4,6],[5,3,6,2]])
  const before = JSON.stringify(input)
  const first = convertPDToDT(input)
  expect(validateDTCode(first).valid).toBe(true)
  expect(convertPDToDT(input)).toEqual(first)
  expect(JSON.stringify(input)).toBe(before)
  expect(validatePDCode(convertDTToPD(first)).valid).toBe(true)
})

it('round-trips signed-even trefoil DT through PD', () => {
  const input = dt([4,6,2])
  const output = convertPDToDT(convertDTToPD(input))
  expect(validateDTCode(output).valid).toBe(true)
  expect((output.code as number[]).map(Math.abs)).toHaveLength(3)
})

it('converts a two-component PD link', () => {
  const input = pd([[6,1,7,2],[8,3,5,4],[2,5,3,6],[4,7,1,8]])
  expect(validatePDCode(input).valid).toBe(true)
  const output = convertPDToDT(input)
  expect(validateDTCode(output).valid).toBe(true)
  expect(Array.isArray(output.code[0])).toBe(true)
})

it('rejects PD traversals not representable by signed-even DT', () => {
  expect(() => convertPDToDT(pd([],2))).toThrow(/Crossing-free/)
})
