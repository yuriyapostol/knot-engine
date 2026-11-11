import { describe, expect, it } from 'vitest'
import { tracePDComponents } from '../src/core/tracePDComponents'
import type { PDCode } from '../src/core/knot'

describe('PD strand tracing', () => {
  const trefoil: PDCode = {
    convention: 'pd-ccw-under-first',
    crossings: [[1, 5, 2, 4], [3, 1, 4, 6], [5, 3, 6, 2]],
  }

  it('traces the trefoil as one closed component with two visits per crossing', () => {
    const components = tracePDComponents(trefoil)
    expect(components).toHaveLength(1)
    expect(components[0].visits).toHaveLength(6)
    for (let crossing = 0; crossing < 3; crossing++) {
      const visits = components[0].visits.filter(v => v.crossing === crossing)
      expect(visits).toHaveLength(2)
      expect(visits.map(v => v.under).sort()).toEqual([false, true])
    }
  })

  it('preserves isolated crossing-free components', () => {
    const components = tracePDComponents({ ...trefoil, unlinkedComponents: 2 })
    expect(components).toHaveLength(3)
    expect(components.slice(1).map(component => component.visits)).toEqual([[], []])
  })

  it('rejects malformed PD before tracing', () => {
    expect(() => tracePDComponents({ convention: 'pd-ccw-under-first', crossings: [[1, 2, 3, 4]] })).toThrow()
  })
})
