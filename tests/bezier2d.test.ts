import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../v1/schema/2d.schema.json'
import { GEOMETRY_2D, GEOMETRY_3D, applyStepData, exportSVGPath2D, importSVGPath2D, validateGeometry2D, validateGeometry3D, type Curve2D, type Geometry2DData, type SegmentedCurve2D } from '../src/core'
import { cubicSpans, flattenGeometry2D, mapCurve2D } from '../src/core/curves2d'
import { locateCrossings } from '../src/components/geometry2d'
import { crossingStrokes2D } from '../src/components/crossingStrokes2d'

const options = { idPrefix: 'rope', yAxis: 'up' as const }
const parse = (d: string) => importSVGPath2D(d, options)
const model = (elements: Curve2D[]): Geometry2DData => ({ coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } }, elements })
const checkSchema = new Ajv2020({ strict: false }).compile(schema)
const mixed = () => parse('M0 0 Q1 2 2 0 C3 -2 4 2 5 0 L6 0')[0]

it('validates mixed segments independently and rejects ambiguous forms, bad dimensions and unknown fields', () => {
  const good = model([mixed()])
  expect(checkSchema(good)).toBe(true)
  expect(validateGeometry2D(good).valid).toBe(true)
  for (const curve of [
    { ...mixed(), points: [[0, 0], [1, 1]], interpolation: { type: 'polyline' } },
    { ...mixed(), start: [0, 0, 0] },
    { ...mixed(), segments: [] },
    { ...mixed(), segments: [{ type: 'quadratic', end: [1, 1] }] },
    { ...mixed(), segments: [{ type: 'cubic', control1: [1, 1], control2: [2, 1, 0], end: [2, 0] }] },
    { ...mixed(), segments: [{ type: 'line', end: [1, 1], control: [0, 0] }] },
  ]) {
    expect(checkSchema(model([curve as Curve2D]))).toBe(false)
    expect(validateGeometry2D(model([curve as Curve2D])).valid).toBe(false)
  }
  expect(validateGeometry2D(model([{ ...mixed(), start: [Infinity, 0] }])).valid).toBe(false)
  expect(validateGeometry3D({ coordinateSystem: { handedness: 'right', upAxis: 'y', scale: { kind: 'relative' } }, elements: [mixed()] }).valid).toBe(false)
})

it('allows coincident handles, zero-length segments and a one-segment closed Bezier loop', () => {
  const curve = parse('M0 0 L0 0 C0 2 2 0 0 0 Z')[0]
  expect(validateGeometry2D(model([curve])).valid).toBe(true)
  const flattened = flattenGeometry2D(model([curve]))
  expect(flattened.elements[0].points.length).toBeGreaterThan(3)
  expect(flattened.elements[0].points.at(-1)).not.toEqual([0, 0])
  expect(locateCrossings(model([curve]))).toEqual([])
  expect(() => flattenGeometry2D(model(parse('M0 0 C0 0 0 0 0 0')))).toThrow(/extent|Degenerate/)
})

it('normalizes every Bezier command, relative coordinate sets and smooth reflections', () => {
  const curve = parse('m10 20 2 0 h2 v2 q1 2 2 0 t2 0 c1 1 2 1 3 0 s2 -1 3 0 z')[0]
  expect(curve).toMatchObject({ start: [10, 20], closed: true, segments: [
    { type: 'line', end: [12, 20] }, { type: 'line', end: [14, 20] }, { type: 'line', end: [14, 22] },
    { type: 'quadratic', control: [15, 24], end: [16, 22] },
    { type: 'quadratic', control: [17, 20], end: [18, 22] },
    { type: 'cubic', control1: [19, 23], control2: [20, 23], end: [21, 22] },
    { type: 'cubic', control1: [22, 21], control2: [23, 21], end: [24, 22] },
  ] })
  expect(parse('M0 0 Q1 2 2 0 T4 0 6 0')[0].segments.at(-1)).toEqual({ type: 'quadratic', control: [5, 2], end: [6, 0] })
  expect(parse('M0 0 C1 2 2 2 3 0 S5 -2 6 0 8 2 9 0')[0].segments.at(-1)).toEqual({ type: 'cubic', control1: [7, 2], control2: [8, 2], end: [9, 0] })
  expect(parse('M1 2 T3 4 S5 6 7 8')[0].segments).toEqual([
    { type: 'quadratic', control: [1, 2], end: [3, 4] },
    { type: 'cubic', control1: [3, 4], control2: [5, 6], end: [7, 8] },
  ])
  expect(parse('M0 0 Q1 2 2 0 L3 0 T4 0')[0].segments.at(-1)).toMatchObject({ control: [3, 0] })
})

it('supports compact SVG numeric syntax, exponents and repeated parameter groups', () => {
  expect(parse('M.5-.5L1e1,+2.5e-1 20.30.4')[0]).toMatchObject({ start: [0.5, -0.5], segments: [
    { type: 'line', end: [10, 0.25] }, { type: 'line', end: [20.3, 0.4] },
  ] })
  expect(parse('M0 0 H1 2 V3 4')[0].segments.map(s => s.end)).toEqual([[1, 0], [2, 0], [2, 3], [2, 4]])
})

it('splits subpaths and resumes drawing at the original start after closepath', () => {
  const curves = parse('M0 0L1 0z l0 1 m2 0 q1 1 2 0')
  expect(curves.map(c => [c.id, c.start, c.closed])).toEqual([
    ['rope-1', [0, 0], true], ['rope-2', [0, 0], false], ['rope-3', [2, 1], false],
  ])
  expect(parse('M0 0 C1 0 1 1 0 0z S2 2 3 3')[1].segments[0]).toMatchObject({ control1: [0, 0] })
  expect(parse(' M0 0 M1 1z M2 2 L3 3 ')).toHaveLength(1)
  expect(parse(' \n\t ')).toEqual([])
})

for (const d of ['L0 0', 'M', 'M0', 'M0 0 L1', 'M,0 0', 'M0,,0', 'M0 0,', 'M0 0,L1 2', 'M0 0z1 2', 'M0 0 Q1 2 3', 'M0 0 R1 2', 'MNaN 0', 'M1e309 0', 'M0 0 L1_2', 'M0 0 L1 2;', 'M0 0 C1 2 3 4 5', 'M0 0 L1e308 0 s1e308 0 0 0']) {
  it(`rejects invalid SVG input: ${d}`, () => expect(() => parse(d)).toThrow())
}

it('rejects arcs explicitly and requires explicit coordinate direction', () => {
  expect(() => parse('M0 0 A1 1 0 0 0 2 2')).toThrow(/elliptical arcs/)
  expect(() => importSVGPath2D('M0 0L1 1', { idPrefix: 'a' } as typeof options)).toThrow(/yAxis/)
  expect(() => importSVGPath2D('M0 0L1 1', { ...options, idPrefix: '' })).toThrow(/idPrefix/)
})

it('preserves geometry and Bezier degrees on export and import in either Y direction', () => {
  const curve = mixed(), before = JSON.stringify(curve)
  for (const yAxis of ['up', 'down'] as const) {
    const d = exportSVGPath2D(curve, { yAxis })
    expect(d).toContain('Q '); expect(d).toContain('C '); expect(d).toContain('L ')
    expect(importSVGPath2D(d, { ...options, yAxis })).toEqual([curve])
  }
  expect(exportSVGPath2D(curve, { yAxis: 'down' })).toContain('Q 1 -2 2 0')
  expect(JSON.stringify(curve)).toBe(before)
  expect(exportSVGPath2D(parse('M0 0L1 1z')[0], options)).toBe('M 0 0 L 1 1 Z')
})

it('converts quadratic to cubic exactly and adds only necessary straight closing spans', () => {
  const quadratic = parse('M0 0 Q3 6 6 0')[0]
  const [a, b, c, d] = cubicSpans(quadratic)[0]
  for (const t of [0, 0.1, 0.5, 0.9, 1]) for (const k of [0, 1] as const) {
    expect((1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t ** 2 * c[k] + t ** 3 * d[k])
      .toBeCloseTo((1 - t) ** 2 * quadratic.start[k] + 2 * (1 - t) * t *  [3, 6][k] + t ** 2 * [6, 0][k], 12)
  }
  expect(cubicSpans({ ...quadratic, closed: true })).toHaveLength(2)
  expect(cubicSpans(parse('M0 0 C1 2 2 1 0 0z')[0])).toHaveLength(1)
})

it('locates Bezier crossings at the curved position and draws crossing masks on original paths', () => {
  const data = model(parse('M-2 0 Q0 2 2 0 M0 -1 L0 2'))
  data.crossings = [{ id: 'x', element: 'rope-1', underElement: 'rope-2' }, { id: 'x', element: 'rope-2', overElement: 'rope-1' }]
  const positions = locateCrossings(data)
  expect(positions).toHaveLength(2)
  expect(positions[0].x).toBeCloseTo(0, 8)
  expect(positions[0].y).toBeCloseTo(1, 8)
  const strokes = crossingStrokes2D(data, flattenGeometry2D(data), positions, 0.04)
  expect(strokes[0].d).toContain('Q ')
  expect(strokes[0].over).not.toBeNull()
  expect(strokes[0].mask).not.toBeNull()
  expect(strokes[1].under).not.toBeNull()
})

it('handles a transverse self-intersection inside a single cubic segment', () => {
  const data = model(parse('M0 0 C3 3 -2 3 1 0'))
  data.crossings = [{ id: 'self', element: 'rope-1', underElement: 'rope-1' }, { id: 'self', element: 'rope-1', overElement: 'rope-1' }]
  const positions = locateCrossings(data)
  expect(positions.map(p => p.over)).toEqual([true, false])
  expect(positions[0].x).toBeCloseTo(0.5, 4)
  expect(positions[0].y).toBeCloseTo(0.5625, 3)
})

it('orders repeated crossings on a closed Bezier curve and includes the closing seam', () => {
  const data = model(parse('M-1 -1 Q0 -2 1 -1 Q2 0 1 1 Q0 2 -1 1 Q-2 0 -1 -1z M-2 0 L2 0'))
  data.crossings = [
    { id: 'right', element: 'rope-1', underElement: 'rope-2' },
    { id: 'left', element: 'rope-1', overElement: 'rope-2' },
    { id: 'left', element: 'rope-2', underElement: 'rope-1' },
    { id: 'right', element: 'rope-2', overElement: 'rope-1' },
  ]
  const positions = locateCrossings(data)
  expect(positions.map(p => p.id)).toEqual(['right', 'left', 'left', 'right'])
  expect(positions[0].x).toBeCloseTo(1.5, 5)
  expect(positions[1].x).toBeCloseTo(-1.5, 5)
  // Move the traversal start onto a crossing without changing the shape.
  data.elements[0] = parse('M-1.5 0 Q-1.5 -0.5 -1 -1 Q0 -2 1 -1 Q2 0 1 1 Q0 2 -1 1 Q-1.5 0.5 -1.5 0z')[0]
  data.crossings = [data.crossings[1], data.crossings[0], data.crossings[2], data.crossings[3]]
  expect(locateCrossings(data)[0].x).toBeCloseTo(-1.5, 5)
})

it('rejects detected Bezier tangencies and overlaps', () => {
  expect(() => locateCrossings(model(parse('M-1 0 Q0 2 1 0 M-2 1 L2 1')))).toThrow(/tangen|collinear|contact/)
  expect(() => locateCrossings(model(parse('M0 0 C1 0 2 0 3 0 M1 0 L2 0')))).toThrow(/overlap|collinear/)
})

it('supports procedure replacements and rejects 2D segments in 3D procedure bases', () => {
  const base = model([{ id: 'rope-1', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[0, 0], [2, 0]] }])
  const curve = mixed()
  const result = applyStepData(base, { replace: [curve] }, GEOMETRY_2D)
  expect(result.valid).toBe(true)
  if (result.valid) expect(result.data.elements).toEqual([curve])
  expect(base.elements[0]).toHaveProperty('points')
  expect(applyStepData({ coordinateSystem: { handedness: 'right', upAxis: 'y', scale: { kind: 'relative' } }, elements: [] }, { add: [curve] }, GEOMETRY_3D).valid).toBe(false)
})

it('enforces import, point and subdivision budgets, including control points', () => {
  expect(() => parse('M0 0' + 'L1 1'.repeat(4097))).toThrow(/budget/)
  expect(() => parse(' '.repeat(1_000_001))).toThrow(/budget/)
  const curve: SegmentedCurve2D = { id: 'a', type: 'curve', closed: false, start: [0, 0], segments: Array.from({ length: 4096 }, (_, i) => ({ type: 'cubic', control1: [i, 1], control2: [i, -1], end: [i + 1, 0] })) }
  const many = model(Array.from({ length: 6 }, (_, i) => ({ ...curve, id: `a${i}`, segments: curve.segments.slice(0, 3650) })))
  const checked = validateGeometry2D(many)
  expect(checked.valid).toBe(false)
  if (!checked.valid) expect(checked.issues.some(i => i.message === 'Point budget exceeded' && i.code === 'LIMIT_EXCEEDED')).toBe(true)
  expect(() => flattenGeometry2D(model([curve]))).toThrow(/Too many/)
})

it('keeps crossing positions independent of scale and translation, including handles', () => {
  for (const scale of [1e-8, 1, 1e8]) {
    const data = model(parse('M-2 0 Q0 2 2 0 M0 -1 L0 2').map(c => mapCurve2D(c, ([x, y]) => [(x + 3) * scale, (y - 2) * scale])))
    data.crossings = [{ id: 'x', element: 'rope-1', underElement: 'rope-2' }, { id: 'x', element: 'rope-2', overElement: 'rope-1' }]
    expect(locateCrossings(data)[0].y / scale).toBeCloseTo(-1, 6)
  }
})
