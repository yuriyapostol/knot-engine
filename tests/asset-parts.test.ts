import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../v1/spec/schema/knot-asset.schema.json'
import gridSchema from '../v1/spec/schema/grid-diagram.schema.json'
import grid from '../v1/spec/examples/assets/grid-diagram.json'
import open from '../v1/spec/examples/assets/open-rope.json'
import { composeKnotAsset, selectKnotAsset, validateKnotAsset, validateGridDiagram, resolveKnotAsset } from '../src/core'

describe('asset fragments and grid diagrams', () => {
  it('validates a standalone grid subschema', () => {
    const ajv = new Ajv2020({ strictTypes: false }).addSchema(schema)
    expect(ajv.compile(gridSchema)(grid.diagrams[0])).toBe(true)
    expect(validateGridDiagram(grid.diagrams[0], { strict: true }).valid).toBe(true)
  })
  it('rejects grid permutations, bounds, lengths and overlapping markers', () => {
    for (const change of [{ x: [0, 0, 2, 3, 4] }, { o: [2, 3, 4, 0, 5] }, { x: [0, 1] }, { o: [0, 3, 4, 1, 2] }]) {
      const value = structuredClone(grid)
      Object.assign(value.diagrams[0], change)
      expect(validateKnotAsset(value, { strict: true }).valid).toBe(false)
      const standalone = validateGridDiagram(value.diagrams[0], { strict: true })
      expect(standalone.valid).toBe(false)
      if (!standalone.valid) expect(standalone.issues.every(issue => !issue.path.startsWith('diagrams'))).toBe(true)
    }
    expect(() => resolveKnotAsset(grid)).toThrow()
  })
  it('selects dependency-complete views and composes without sharing mutable data', () => {
    const source = { ...open, diagrams: grid.diagrams }
    const geometry = selectKnotAsset(source, { representations: [open.representations[0].id] })
    const diagram = selectKnotAsset(source, { diagrams: ['grid'] })
    expect(diagram.elements).toEqual([])
    expect(diagram.representations).toEqual([])
    const combined = composeKnotAsset([geometry, diagram])
    expect(validateKnotAsset(combined, { strict: true }).valid).toBe(true)
    expect(combined.diagrams).toEqual(grid.diagrams)
    combined.diagrams![0].x[0] = 4
    expect(grid.diagrams[0].x[0]).toBe(0)
    expect(resolveKnotAsset(geometry).curves.length).toBe(1)
  })
  it('rejects unknown selections, mixed knots and conflicting IDs', () => {
    expect(() => selectKnotAsset(grid, { diagrams: ['missing'] })).toThrow()
    expect(() => composeKnotAsset([grid, open])).toThrow()
    expect(() => composeKnotAsset([grid, { ...grid, diagrams: [{ ...grid.diagrams[0], o: [1, 2, 3, 4, 0] }] }])).toThrow()
    expect(() => composeKnotAsset([])).toThrow()
    expect(composeKnotAsset([grid, grid]).diagrams).toHaveLength(1)
  })
})
