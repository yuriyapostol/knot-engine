import { describe, expect, it } from 'vitest'
import { validateImageRepresentation } from './validateImageRepresentation'
import { validateGeometry2D } from './validateGeometry'

describe('image representation contract', () => {
  it('accepts relative, HTTPS and matching data URL references', () => {
    for (const src of ['./knot.svg', 'https://example.org/knot.png', 'data:image/svg+xml,%3Csvg%3E']) {
      const mimeType = src.endsWith('.png') ? 'image/png' : 'image/svg+xml'
      expect(validateImageRepresentation({ mimeType, src }).valid).toBe(true)
    }
  })
  it('rejects unsafe schemes and mismatched data MIME', () => {
    for (const src of ['javascript:alert(1)', 'http://example.org/a.png', 'data:image/png;base64,AAAA']) {
      expect(validateImageRepresentation({ mimeType: 'image/svg+xml', src }).valid).toBe(false)
    }
  })
})
describe('2D crossing types', () => {
  const base = {
    coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } },
    elements: [
      { id: 'a', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[0, 0], [1, 1]] },
      { id: 'b', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[0, 1], [1, 0]] },
    ],
  }
  it('preserves legacy classical records without type', () => {
    const data = { ...base, crossings: [
      { id: 'x', element: 'a', underElement: 'b' },
      { id: 'x', element: 'b', overElement: 'a' },
    ] }
    const result = validateGeometry2D(data)
    expect(result.valid).toBe(true)
    if (result.valid) expect(JSON.stringify(result.data)).not.toContain('"type":"classical"')
  })
  it.each(['unknown', 'virtual'] as const)('accepts %s crossings', type => {
    expect(validateGeometry2D({ ...base, crossings: [
      { id: 'x', element: 'a', type, otherElement: 'b' },
      { id: 'x', element: 'b', type, otherElement: 'a' },
    ] }).valid).toBe(true)
  })
  it('rejects mixed crossing types', () => {
    expect(validateGeometry2D({ ...base, crossings: [
      { id: 'x', element: 'a', type: 'virtual', otherElement: 'b' },
      { id: 'x', element: 'b', type: 'unknown', otherElement: 'a' },
    ] }).valid).toBe(false)
  })
})
