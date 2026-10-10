import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { KnotViewer } from '../src'
import { KNOT_ASSET_LIMITS, resolveKnotAsset, resolveKnotModelV1, validateKnotAsset, validateKnotModelV1, validateModel, ViewerError, type KnotAsset, type Representation, type Snapshot, type CurveGeometry } from '../src/core'
import { buildGeometry } from '../src/geometry/build'
import open from '../examples/assets/open-rope.json'
import sequence from '../examples/assets/variants.json'
import diagram from '../examples/assets/diagram-crossings.json'
import legacy from '../examples/models/twisted-loop.json'

const asset = () => structuredClone(sequence) as KnotAsset
const first = (a: KnotAsset) => a.representations[0].snapshots[0] as Snapshot<3>
const geometry = (a: KnotAsset): CurveGeometry => first(a).elements[0].geometry
const issues = (a: unknown) => {
  const result = validateKnotAsset(a, { strict: true })
  expect(result.valid).toBe(false)
  if (result.valid) throw new Error('Expected invalid asset')
  return result.issues
}

describe('KnotAsset validation', () => {
  for (const file of readdirSync('examples/assets').filter(f => f.endsWith('.json'))) {
    it(`accepts ${file} without mutation`, () => {
      const value = JSON.parse(readFileSync(`examples/assets/${file}`, 'utf8'))
      const before = JSON.stringify(value)
      expect(validateKnotAsset(value, { strict: true }).valid).toBe(true)
      expect(JSON.stringify(value)).toBe(before)
    })
  }
  for (const file of readdirSync('examples/assets/invalid')) {
    it(`rejects invalid fixture ${file}`, () => { issues(JSON.parse(readFileSync(`examples/assets/invalid/${file}`, 'utf8'))) })
  }
  it.each([
    ['element', (a: KnotAsset) => a.elements.push(a.elements[0]), 'elements[1].id'],
    ['representation', (a: KnotAsset) => a.representations.push(a.representations[0]), 'representations[1].id'],
    ['snapshot', (a: KnotAsset) => a.representations[0].snapshots.push(first(a) as never), 'representations[0].snapshots[3].id'],
    ['snapshot element', (a: KnotAsset) => first(a).elements.push(first(a).elements[0] as never), 'representations[0].snapshots[0].elements[1].id'],
    ['algorithm', (a: KnotAsset) => a.algorithms!.push(a.algorithms![0]), 'algorithms[2].id'],
    ['variant', (a: KnotAsset) => a.variants!.push(a.variants![0]), 'variants[2].id'],
    ['step', (a: KnotAsset) => a.algorithms![0].steps.push(a.algorithms![0].steps[0]), 'algorithms[0].steps[3].id'],
    ['end', (a: KnotAsset) => { if (a.elements[0].type === 'rope') a.elements[0].ends[1].id = 'a' }, 'elements[0].ends[1].id']
  ])('rejects duplicate %s IDs', (_name, mutate, path) => {
    const a = asset(); mutate(a)
    expect(issues(a).map(i => i.path)).toContain(path)
  })
  it.each([
    ['snapshot element', (a: KnotAsset) => { first(a).elements[0].id = 'missing' }],
    ['algorithm representation', (a: KnotAsset) => { a.algorithms![0].representation = 'missing' }],
    ['algorithm snapshot', (a: KnotAsset) => { a.algorithms![0].steps[0].snapshot = 'missing' }],
    ['variant representation', (a: KnotAsset) => { a.variants![0].representation = 'missing' }],
    ['variant snapshot', (a: KnotAsset) => { a.variants![0].snapshot = 'missing' }]
  ])('rejects broken %s references', (_name, mutate) => { const a = asset(); mutate(a); issues(a) })
  it('scopes snapshot IDs and references to each representation', () => {
    const a = asset()
    const other = structuredClone(a.representations[0]); other.id = 'other'
    a.representations.push(other)
    expect(validateKnotAsset(a).valid).toBe(true)
    other.snapshots[0].id = 'elsewhere'
    a.algorithms![0].steps[0].snapshot = 'elsewhere'
    issues(a)
    a.algorithms![0].representation = 'other'
    expect(validateKnotAsset(a).valid).toBe(true)
  })
  it('permits zero or one accessible end, local end IDs, and independent topology/closure', () => {
    const a = asset(), rope = a.elements[0]
    if (rope.type !== 'rope') throw new Error('Expected rope')
    for (const ends of [[], [{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]]) {
      rope.ends = ends
      geometry(a).closed = true
      expect(validateKnotAsset(a).valid).toBe(true)
    }
    rope.ends.push({ id: 'c' }); issues(a)
    rope.topology = 'closed'; rope.ends = []; geometry(a).closed = false
    expect(validateKnotAsset(a).valid).toBe(true)
    rope.ends = [{ id: 'a' }]; issues(a)
  })
  it.each([null, [], 1, {}, { ...open, units: 'relative' }, { ...open, schemaVersion: 2 }])('rejects malformed roots %j', value => { issues(value) })
  it.each([NaN, Infinity, -Infinity, '0', null])('rejects nonfinite/non-numeric coordinates %s', n => {
    const a = asset(); (geometry(a).points[0] as unknown[])[0] = n; issues(a)
  })
  it('requires the representation dimensionality without inferring it from IDs', () => {
    const a = asset(); geometry(a).points[0] = [0, 0]; issues(a)
    const d = structuredClone(diagram); d.representations[0].snapshots[0].elements[0].geometry.points[0].push(0); issues(d)
    const b = asset(); b.representations[0].id = 'diagram'; b.algorithms = []; b.variants = []
    expect(validateKnotAsset(b).valid).toBe(true)
  })
  it.each([-0.1, 1.1, NaN, Infinity])('rejects invalid tension %s', tension => { const a = asset(); geometry(a).interpolation.tension = tension; issues(a) })
  it('rejects bad curve types, short curves and duplicate points', () => {
    for (const change of [
      (g: ReturnType<typeof geometry>) => { (g as { type: string }).type = 'mesh' },
      (g: ReturnType<typeof geometry>) => { g.points = g.points.slice(0, 1) },
      (g: ReturnType<typeof geometry>) => { g.closed = true; g.points = g.points.slice(0, 2) },
      (g: ReturnType<typeof geometry>) => { g.points[1] = g.points[0] },
      (g: ReturnType<typeof geometry>) => { g.closed = true; g.points.push(g.points[0]) }
    ]) { const a = asset(); change(geometry(a)); issues(a) }
  })
  it('uses exact duplicate comparison without legacy coordinate/epsilon limits', () => {
    const a = structuredClone(open)
    a.representations[0].snapshots[0].elements[0].geometry.points = [[0, 0, 0], [1e-15, 0, 0], [2e6, 0, 0]]
    expect(validateKnotAsset(a).valid).toBe(true)
    expect(() => resolveKnotAsset(a)).toThrowError(expect.objectContaining({ code: 'LIMIT_EXCEEDED' }))
  })
  it('rejects even empty crossings in 3D and requires snapshot-local crossing references', () => {
    const a = asset(); Object.assign(first(a), { crossings: [] }); issues(a)
    const d = structuredClone(diagram)
    d.elements.push({ ...d.elements[0], id: 'absent' })
    d.representations[0].snapshots[0].crossings[0].over.element = 'absent'; issues(d)
  })
  it.each([-0.01, 1.01, NaN])('rejects crossing u %s', u => {
    const d = structuredClone(diagram); d.representations[0].snapshots[0].crossings[0].under.u = u; issues(d)
  })
  it('checks consecutive steps, not all unrelated snapshots', () => {
    const a = asset(); (a.representations[0].snapshots[1].elements[0].geometry as CurveGeometry).points.push([1, 1, 1])
    expect(issues(a).some(i => i.message.includes('Control-point count'))).toBe(true)
    a.algorithms = a.algorithms!.slice(1)
    expect(validateKnotAsset(a).valid).toBe(true)
    // An element absent from either adjacent snapshot is not an animated pair.
    a.algorithms = [{ id: 'a', representation: 'view-3d', steps: [{ id: 'a', snapshot: 'rest' }, { id: 'b', snapshot: 'bend' }] }]
    first(a).elements = []
    expect(validateKnotAsset(a).valid).toBe(true)
  })
  it('validates optional presentation without imposing a preset registry', () => {
    const a = asset()
    a.representations[0].presentation = { preset: 'future-style', camera: { position: [0, 0, 2], target: [0, 0, 0] } }
    expect(validateKnotAsset(a).valid).toBe(true)
    expect(resolveKnotAsset(a).camera?.fov).toBe(55)
    expect(resolveKnotAsset(a).warnings.join()).toContain('future-style')
    a.representations[0].presentation.camera!.fov = 180; issues(a)
    a.representations[0].presentation.camera!.fov = 55
    a.representations[0].presentation.camera!.position = [0, 0, 0]; issues(a)
  })
  it('keeps the two schemaVersion:1 contracts explicit', () => {
    expect(validateKnotAsset(legacy).valid).toBe(false)
    expect(validateKnotModelV1(open).valid).toBe(false)
    expect(validateModel).toBe(validateKnotModelV1)
    expect(() => resolveKnotModelV1(open)).toThrow(ViewerError)
    expect(() => resolveKnotAsset(legacy)).toThrow(ViewerError)
  })
  it('enforces strict unknown keys at nested boundaries', () => {
    const a = asset(); Object.assign(geometry(a), { properties: {} })
    expect(validateKnotAsset(a).valid).toBe(true)
    expect(issues(a).at(-1)?.path).toContain('.properties')
  })
  it('is deterministic on deeply frozen data', () => {
    const freeze = (v: unknown): void => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v) } }
    const a = asset(); freeze(a)
    expect(validateKnotAsset(a)).toEqual(validateKnotAsset(a))
    expect(resolveKnotAsset(a)).toEqual(resolveKnotAsset(a))
  })
})

describe('independent resource budgets', () => {
  it('accepts more than eight curves and 512 points per curve', () => {
    const a = structuredClone(open) as KnotAsset
    geometry(a).points = Array.from({ length: 513 }, (_, i) => [i / 1000, 0, 0])
    for (let i = 1; i < 9; i++) {
      a.elements.push({ ...a.elements[0], id: `rope-${i + 1}` })
      first(a).elements.push({ ...first(a).elements[0], id: `rope-${i + 1}` } as never)
    }
    expect(validateKnotAsset(a).valid).toBe(true)
    const built = buildGeometry(resolveKnotAsset(a), 'high', 'light')
    expect(built.warnings.some(w => w.includes('reduced'))).toBe(true)
    built.dispose()
  })
  it('enforces points per curve and aggregate point limits', () => {
    const a = structuredClone(open) as KnotAsset
    geometry(a).points = Array.from({ length: KNOT_ASSET_LIMITS.pointsPerCurve }, (_, i) => [i, 0, 0])
    expect(validateKnotAsset(a).valid).toBe(true)
    geometry(a).points.push([5000, 0, 0]); expect(issues(a).some(i => i.code === 'LIMIT_EXCEEDED')).toBe(true)
    geometry(a).points.pop()
    a.representations[0].snapshots = Array.from({ length: 17 }, (_, i) => ({ ...first(a), id: `s${i}` })) as never
    expect(issues(a).some(i => i.message.includes('total point'))).toBe(true)
  })
  it.each(['elements', 'representations', 'algorithms', 'variants'] as const)('bounds root collection %s before traversing it', key => {
    const a = asset(); Object.assign(a, { [key]: Array(KNOT_ASSET_LIMITS[key] + 1).fill(null) })
    expect(issues(a)).toContainEqual(expect.objectContaining({ path: key, code: 'LIMIT_EXCEEDED' }))
  })
  it('enforces aggregate entries, independent of point counts', () => {
    const a = asset()
    a.algorithms = Array.from({ length: 256 }, (_, i) => ({ id: `a${i}`, representation: 'view-3d', steps: Array.from({ length: 1024 }, (_, j) => ({ id: `s${j}`, snapshot: 'rest' })) }))
    expect(issues(a).some(i => i.message.includes('total entry'))).toBe(true)
  })
  it.each([
    ['snapshots', (a: KnotAsset) => { a.representations[0].snapshots = Array(KNOT_ASSET_LIMITS.snapshots + 1).fill(null) }],
    ['snapshotElements', (a: KnotAsset) => { first(a).elements = Array(KNOT_ASSET_LIMITS.snapshotElements + 1).fill(null) }],
    ['steps', (a: KnotAsset) => { a.algorithms![0].steps = Array(KNOT_ASSET_LIMITS.steps + 1).fill(null) }],
    ['crossings', (a: KnotAsset) => { Object.assign(first(a), { crossings: Array(KNOT_ASSET_LIMITS.crossings + 1).fill(null) }) }]
  ])('bounds nested collection %s before traversing it', (_name, mutate) => {
    const a = asset(); mutate(a)
    expect(issues(a).some(i => i.code === 'LIMIT_EXCEEDED')).toBe(true)
  })
  it('rejects a valid asset that exceeds the lowest rendering triangle budget', () => {
    const a = structuredClone(open) as KnotAsset
    a.elements = Array.from({ length: 49 }, (_, i) => ({ ...a.elements[0], id: `rope-${i}` }))
    first(a).elements = a.elements.map(e => ({ ...first(a).elements[0], id: e.id }))
    expect(validateKnotAsset(a).valid).toBe(true)
    expect(() => buildGeometry(resolveKnotAsset(a), 'high', 'light')).toThrowError(expect.objectContaining({ code: 'LIMIT_EXCEEDED' }))
  })
})

describe('snapshot resolution and rendering', () => {
  it('uses physical diameter only when supplied and explains display thickness otherwise', () => {
    const a = asset(), rope = a.elements[0]
    if (rope.type !== 'rope') throw new Error('Expected rope')
    rope.diameter = 0.04
    expect(resolveKnotAsset(a).curves[0].radius).toBe(0.02)
    expect(resolveKnotAsset(a).warnings).toEqual([])
    delete rope.diameter
    expect(resolveKnotAsset(a).curves[0].radius).toBe(0.005)
    expect(resolveKnotAsset(a).warnings).toHaveLength(1)
    for (const diameter of [0, -1, NaN, Infinity]) { rope.diameter = diameter; issues(a) }
  })
  it('selects explicitly and clones source arrays', () => {
    const a = asset(), resolved = resolveKnotAsset(a, { representationId: 'view-3d', snapshotId: 'finish' })
    expect(resolved.curves[0].radius).toBe(0.005)
    expect(resolved.curves[0].points).toEqual(a.representations[0].snapshots[2].elements[0].geometry.points)
    resolved.curves[0].points[0][0] = 99
    expect(a.representations[0].snapshots[2].elements[0].geometry.points[0][0]).toBe(0)
  })
  it('uses the first 3D representation and its first snapshot by default', () => {
    const a = asset(); a.representations.unshift((diagram as unknown as KnotAsset).representations[0])
    expect(resolveKnotAsset(a).curves[0].points).toEqual(open.representations[0].snapshots[0].elements[0].geometry.points)
  })
  it('rejects missing selection, 2D rendering, empty snapshots, and malformed unselected snapshots', () => {
    expect(() => resolveKnotAsset(open, { representationId: 'missing' })).toThrow(ViewerError)
    expect(() => resolveKnotAsset(open, { snapshotId: 'missing' })).toThrow(ViewerError)
    expect(() => resolveKnotAsset(diagram, { representationId: 'diagram' })).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_SCHEMA' }))
    const a = asset(); first(a).elements = []; expect(() => resolveKnotAsset(a)).toThrow(ViewerError)
    const b = asset(); b.representations[0].snapshots[2].elements[0].geometry.points[0][0] = NaN
    expect(() => resolveKnotAsset(b, { snapshotId: 'rest' })).toThrow(ViewerError)
  })
  for (const file of readdirSync('examples/assets').filter(f => f.endsWith('.json') && !f.startsWith('diagram'))) {
    it(`builds finite 3D geometry for ${file}`, () => {
      const a = JSON.parse(readFileSync(`examples/assets/${file}`, 'utf8'))
      const built = buildGeometry(resolveKnotAsset(a), 'low', 'light')
      expect(built.bounds.isEmpty()).toBe(false)
      for (const mesh of built.group.children) if ('geometry' in mesh) {
        for (const attr of Object.values((mesh.geometry as import('three').BufferGeometry).attributes)) expect(Array.from(attr.array).every(Number.isFinite)).toBe(true)
      }
      built.dispose()
    })
  }
  it('server renders an asset without DOM access', async () => {
    const html = await renderToString(createSSRApp(KnotViewer, { asset: open as KnotAsset, label: 'Asset snapshot' }))
    expect(html).toContain('Asset snapshot'); expect(html).not.toContain('<canvas')
  })
  it('encodes dimension and element discrimination in public types', () => {
    const valid: Representation<2> = { id: 'd', dimension: 2, snapshots: [{ id: 's', elements: [], crossings: [] }] }
    // @ts-expect-error 3D snapshots cannot have crossings
    const invalid: Representation<3> = { id: 'd', dimension: 3, snapshots: [{ id: 's', elements: [], crossings: [] }] }
    expect(valid.dimension).toBe(2); expect(invalid.dimension).toBe(3)
  })
})
