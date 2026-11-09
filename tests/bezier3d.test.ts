import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import * as THREE from 'three'
import schema from '../v1/schema/3d.schema.json'
import example from '../v1/examples/knots/bezier-3d.json'
import { applyStepData, GEOMETRY_2D, GEOMETRY_3D, validateGeometry3D, type Geometry3DData, type RawKnot, type SegmentedCurve3D } from '../src/core'
import { curveControlPoints } from '../src/core/curveControlPoints'
import { validateKnot } from '../src/core/validateKnot'
import { resolveKnot } from '../src/core/resolve'
import { buildGeometry } from '../src/geometry/build'

const data = () => structuredClone(example.representations[0].data) as Geometry3DData
const mixed = () => data().elements[0] as SegmentedCurve3D
const checkSchema = new Ajv2020({ strict: false }).compile(schema)
const model = (curve: unknown) => ({ ...data(), elements: [curve] })

it('aligns the published schema and runtime on mixed 3D segments and invalid forms', () => {
  expect(checkSchema(data())).toBe(true)
  expect(validateGeometry3D(data()).valid).toBe(true)
  for (const curve of [
    { ...mixed(), points: [[0, 0, 0], [1, 1, 1]], interpolation: { type: 'polyline' } },
    { ...mixed(), start: [0, 0] },
    { ...mixed(), segments: [] },
    { ...mixed(), segments: [{ type: 'quadratic', end: [1, 1, 1] }] },
    { ...mixed(), segments: [{ type: 'cubic', control1: [1, 1], control2: [2, 1, 0], end: [2, 0, 0] }] },
    { ...mixed(), segments: [{ type: 'line', end: [1, 1, 1], control: [0, 0, 0] }] },
    { ...mixed(), segments: Array.from({ length: 4097 }, () => ({ type: 'line', end: [1, 1, 1] })) },
  ]) {
    expect(checkSchema(model(curve))).toBe(false)
    expect(validateGeometry3D(model(curve)).valid).toBe(false)
  }
  expect(validateGeometry3D(model({ ...mixed(), start: [Infinity, 0, 0] })).valid).toBe(false)
})

it('supports 3D algorithm add/replace and checks every coordinate against the base dimension', () => {
  const base = data()
  const before = structuredClone(base)
  const replacement = { ...mixed(), start: [0, 1, 0] as [number, number, number] }
  const result = applyStepData(base, { replace: [replacement], add: [{ ...mixed(), id: 'added' }] }, GEOMETRY_3D)
  expect(result.valid).toBe(true)
  if (result.valid) expect(result.data.elements).toEqual([replacement, base.elements[1], { ...mixed(), id: 'added' }])
  expect(base).toEqual(before)
  const plane = { coordinateSystem: { xAxis: 'right' as const, yAxis: 'up' as const, scale: { kind: 'relative' as const } }, elements: [] }
  expect(applyStepData(plane, { add: [mixed()] }, GEOMETRY_2D).valid).toBe(false)
  const wrongHandle = { ...mixed(), segments: [{ type: 'quadratic', control: [1, 1], end: [2, 0] }] }
  expect(applyStepData(base, { add: [{ ...wrongHandle, id: 'bad' } as never] }, GEOMETRY_3D).valid).toBe(false)
  const knot = structuredClone(example) as RawKnot
  Object.assign(knot, { algorithms: [{ id: 'edit', base: { id: 'bezier-3d' }, steps: [{ id: 'first', data: { replace: [replacement] } }] }] })
  expect(validateKnot(knot)).toMatchObject({ valid: true, complete: true })
})

it('counts authored handles and enforces geometry and whole-document resource budgets', () => {
  expect(curveControlPoints(mixed())).toHaveLength(7)
  const curve: SegmentedCurve3D = { ...mixed(), segments: Array.from({ length: 3650 }, () => ({ type: 'cubic', control1: [1, 0, 0], control2: [1, 1, 1], end: [2, 0, 0] })) }
  const elements = Array.from({ length: 6 }, (_, i) => ({ ...curve, id: 'c' + i }))
  expect(validateGeometry3D({ ...data(), elements })).toMatchObject({ valid: false, issues: expect.arrayContaining([expect.objectContaining({ code: 'LIMIT_EXCEEDED' })]) })
  const knot = { ...example, representations: elements.map((c, i) => ({ id: 'r' + i, type: '3d', data: { ...data(), elements: [c] } })) }
  expect(validateKnot(knot)).toMatchObject({ valid: false, issues: expect.arrayContaining([expect.objectContaining({ code: 'LIMIT_EXCEEDED' })]) })
})

it('preserves authored curves and renders finite tubes, outlines and endpoint caps', () => {
  const before = JSON.stringify(example)
  const resolved = resolveKnot(example)
  expect(resolved.curves[0]).toMatchObject(mixed())
  const built = buildGeometry(resolved, 'medium', 'light')
  try {
    expect(built.group.children).toHaveLength(6)
    expect(built.bounds.isEmpty()).toBe(false)
    for (const mesh of built.group.children as THREE.Mesh[]) {
      for (const attribute of Object.values(mesh.geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
    }
    const tube = (built.group.children[0] as THREE.Mesh).geometry as THREE.TubeGeometry
    const path = tube.parameters.path as THREE.CurvePath<THREE.Vector3>
    expect(path.curves.map(c => c.type)).toEqual(['LineCurve3', 'QuadraticBezierCurve3', 'CubicBezierCurve3'])
    expect(path.curves[1].getPoint(0.5).toArray()).toEqual([2, 0.5, 0.25])
    expect(built.group.children[2].position.toArray()).toEqual([0, 0, 0])
    expect(built.group.children[3].position.toArray()).toEqual([6, 0, 2])
    const loop = (built.group.children[4] as THREE.Mesh).geometry as THREE.TubeGeometry
    expect(loop.parameters.path.getPoint(0).toArray()).toEqual(loop.parameters.path.getPoint(1).toArray())
    expect((loop.parameters.path as THREE.CurvePath<THREE.Vector3>).curves).toHaveLength(1)
  } finally { built.dispose() }
  expect(JSON.stringify(example)).toBe(before)
})

it('closes by a straight segment and skips zero-length spans without flattening Beziers', () => {
  const knot = structuredClone(example) as RawKnot
  knot.representations = [{ id: 'bezier-3d', type: '3d', data: { ...data(), elements: [{
    ...mixed(), closed: true, segments: [
      { type: 'line', end: [0, 0, 0] },
      { type: 'quadratic', control: [0, 0, 0], end: [0, 0, 0] },
      { type: 'cubic', control1: [1, 1, 0], control2: [1, 1, 1], end: [2, 0, 1] },
    ],
  }] } }]
  const built = buildGeometry(resolveKnot(knot), 'low', 'dark')
  try {
    const path = ((built.group.children[0] as THREE.Mesh).geometry as THREE.TubeGeometry).parameters.path as THREE.CurvePath<THREE.Vector3>
    expect(path.curves.map(c => c.type)).toEqual(['CubicBezierCurve3', 'LineCurve3'])
    expect(path.getPoint(0).toArray()).toEqual(path.getPoint(1).toArray())
  } finally { built.dispose() }
})

it('rejects entirely degenerate curves at rendering and excessive control coordinates at resolution', () => {
  const knot = structuredClone(example) as RawKnot
  knot.representations = [{ id: 'bezier-3d', type: '3d', data: { ...data(), elements: [{ ...mixed(), segments: [{ type: 'cubic', control1: [0, 0, 0], control2: [0, 0, 0], end: [0, 0, 0] }] }] } }]
  expect(validateKnot(knot).valid).toBe(true)
  expect(() => buildGeometry(resolveKnot(knot), 'low', 'light')).toThrow(/no renderable spans/)
  knot.representations = [{ id: 'bezier-3d', type: '3d', data: { ...data(), elements: [{ ...mixed(), segments: [{ type: 'quadratic', control: [1e7, 0, 0], end: [1, 0, 0] }] }] } }]
  expect(() => resolveKnot(knot)).toThrow(/coordinates and radii/)
})
