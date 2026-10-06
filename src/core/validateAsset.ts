import type { KnotAsset, Snapshot } from './asset'
import type { ValidationIssue, ViewerErrorCode } from './legacy'

/** Independent KnotAsset implementation policy; never inherited from KnotModelV1. */
export const KNOT_ASSET_LIMITS = Object.freeze({
  elements: 256, representations: 32, snapshots: 256, snapshotElements: 256,
  algorithms: 256, steps: 1024, variants: 1024, crossings: 4096,
  pointsPerCurve: 4096, totalPoints: 65536, totalEntries: 262144
})
export type KnotAssetValidationResult =
  | { valid: true; asset: KnotAsset; warnings: string[] }
  | { valid: false; issues: ValidationIssue[] }

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const samePoint = (a: unknown, b: unknown) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((n, i) => n === b[i])

export function validateKnotAsset(value: unknown, options: { strict?: boolean } = {}): KnotAssetValidationResult {
  const issues: ValidationIssue[] = []
  let totalPoints = 0, totalEntries = 0
  const add = (path: string, message: string, code: ViewerErrorCode = 'INVALID_MODEL') => { issues.push({ path, message, code }) }
  const object = (v: unknown, path: string, allowed: string[]): v is Record<string, unknown> => {
    if (!record(v)) { add(path, 'Expected an object'); return false }
    if (options.strict) for (const key of Object.keys(v)) if (!allowed.includes(key)) add(path ? `${path}.${key}` : key, 'Unknown field')
    return true
  }
  const list = (v: unknown, path: string, max: number): unknown[] => {
    if (!Array.isArray(v)) { add(path, 'Expected an array'); return [] }
    if (v.length > max) { add(path, `Array exceeds ${max} entries`, 'LIMIT_EXCEEDED'); return [] }
    totalEntries += v.length
    if (totalEntries > KNOT_ASSET_LIMITS.totalEntries) { add(path, 'Asset exceeds total entry budget', 'LIMIT_EXCEEDED'); return [] }
    return v
  }
  const id = (v: unknown, path: string, seen?: Set<string>) => {
    if (typeof v !== 'string' || !v.length) { add(path, 'Expected a nonempty ID'); return }
    if (seen?.has(v)) add(path, 'Duplicate ID')
    seen?.add(v)
  }
  const optionalString = (v: unknown, path: string) => { if (v !== undefined && typeof v !== 'string') add(path, 'Expected a string') }
  const point = (v: unknown, path: string, dimension: number) => {
    if (!Array.isArray(v) || v.length !== dimension || !v.every(finite)) add(path, `Expected ${dimension} finite coordinates`)
  }
  const curve = (v: unknown, path: string, dimension: number) => {
    if (!object(v, path, ['type', 'closed', 'interpolation', 'points'])) return
    if (v.type !== 'curve') add(`${path}.type`, 'Only curve geometry is supported', 'UNSUPPORTED_SCHEMA')
    if (typeof v.closed !== 'boolean') add(`${path}.closed`, 'Expected boolean')
    if (object(v.interpolation, `${path}.interpolation`, ['type', 'tension'])) {
      if (v.interpolation.type !== 'catmullrom') add(`${path}.interpolation.type`, 'Only catmullrom is supported', 'UNSUPPORTED_SCHEMA')
      if (!finite(v.interpolation.tension) || v.interpolation.tension < 0 || v.interpolation.tension > 1) add(`${path}.interpolation.tension`, 'Expected tension from 0 to 1')
    }
    const points = list(v.points, `${path}.points`, KNOT_ASSET_LIMITS.pointsPerCurve)
    if (Array.isArray(v.points) && v.points.length < (v.closed === true ? 3 : 2)) add(`${path}.points`, 'Expected at least 2 points (3 if closed)')
    totalPoints += points.length
    if (totalPoints > KNOT_ASSET_LIMITS.totalPoints) { add(`${path}.points`, 'Asset exceeds total point budget', 'LIMIT_EXCEEDED'); return }
    points.forEach((p, i) => {
      point(p, `${path}.points[${i}]`, dimension)
      if (i > 0 && samePoint(p, points[i - 1])) add(`${path}.points[${i}]`, 'Consecutive points overlap')
    })
    if (v.closed === true && points.length && samePoint(points[0], points.at(-1))) add(`${path}.points[${points.length - 1}]`, 'Closed curve must not repeat its first point')
  }
  if (!object(value, '', ['schemaVersion', 'id', 'units', 'elements', 'representations', 'algorithms', 'variants'])) return { valid: false, issues }
  if (value.schemaVersion !== 1) add('schemaVersion', 'Only KnotAsset schema version 1 is supported', 'UNSUPPORTED_SCHEMA')
  id(value.id, 'id')
  if (value.units !== 'm') add('units', 'Expected meters (m)')
  const elementIds = new Set<string>()
  list(value.elements, 'elements', KNOT_ASSET_LIMITS.elements).forEach((element, i) => {
    const path = `elements[${i}]`
    if (!record(element)) { add(path, 'Expected an element object'); return }
    object(element, path, element.type === 'rope' ? ['id', 'type', 'topology', 'ends', 'length', 'diameter', 'subtype'] : ['id', 'type', 'subtype'])
    id(element.id, `${path}.id`, elementIds)
    optionalString(element.subtype, `${path}.subtype`)
    if (!['rope', 'support', 'carabiner'].includes(element.type as string)) add(`${path}.type`, 'Unknown element type', 'UNSUPPORTED_SCHEMA')
    if (element.type === 'rope') {
      if (element.topology !== 'open' && element.topology !== 'closed') add(`${path}.topology`, 'Expected open or closed')
      const ends = list(element.ends, `${path}.ends`, 2)
      if (element.topology === 'closed' && Array.isArray(element.ends) && element.ends.length) add(`${path}.ends`, 'Closed rope has no accessible ends')
      const endIds = new Set<string>()
      ends.forEach((end, j) => { if (object(end, `${path}.ends[${j}]`, ['id'])) id(end.id, `${path}.ends[${j}].id`, endIds) })
      for (const key of ['length', 'diameter']) if (element[key] !== undefined && (!finite(element[key]) || element[key] <= 0)) add(`${path}.${key}`, 'Expected a positive finite dimension in meters')
    }
  })
  const representationIds = new Set<string>()
  list(value.representations, 'representations', KNOT_ASSET_LIMITS.representations).forEach((rep, i) => {
    const path = `representations[${i}]`
    if (!object(rep, path, ['id', 'dimension', 'snapshots', 'presentation'])) return
    id(rep.id, `${path}.id`, representationIds)
    if (rep.dimension !== 2 && rep.dimension !== 3) add(`${path}.dimension`, 'Expected dimension 2 or 3')
    const snapshotIds = new Set<string>()
    list(rep.snapshots, `${path}.snapshots`, KNOT_ASSET_LIMITS.snapshots).forEach((snapshot, j) => {
      const sp = `${path}.snapshots[${j}]`
      if (!object(snapshot, sp, ['id', 'elements', 'crossings'])) return
      id(snapshot.id, `${sp}.id`, snapshotIds)
      const snapshotElements = new Set<string>()
      list(snapshot.elements, `${sp}.elements`, KNOT_ASSET_LIMITS.snapshotElements).forEach((element, k) => {
        const ep = `${sp}.elements[${k}]`
        if (!object(element, ep, ['id', 'geometry'])) return
        id(element.id, `${ep}.id`, snapshotElements)
        if (!elementIds.has(element.id as string)) add(`${ep}.id`, 'Unknown element reference')
        curve(element.geometry, `${ep}.geometry`, rep.dimension as number)
      })
      if (snapshot.crossings !== undefined) {
        if (rep.dimension !== 2) add(`${sp}.crossings`, 'Crossings are only valid in 2D')
        list(snapshot.crossings, `${sp}.crossings`, KNOT_ASSET_LIMITS.crossings).forEach((crossing, k) => {
          const cp = `${sp}.crossings[${k}]`
          if (!object(crossing, cp, ['id', 'over', 'under'])) return
          if (crossing.id !== undefined) id(crossing.id, `${cp}.id`)
          for (const side of ['over', 'under']) {
            const p = crossing[side]
            if (!object(p, `${cp}.${side}`, ['element', 'u'])) continue
            id(p.element, `${cp}.${side}.element`)
            if (!snapshotElements.has(p.element as string)) add(`${cp}.${side}.element`, 'Crossing must reference an element in this snapshot')
            if (!finite(p.u) || p.u < 0 || p.u > 1) add(`${cp}.${side}.u`, 'Expected u from 0 to 1')
          }
        })
      }
    })
    if (rep.presentation !== undefined && object(rep.presentation, `${path}.presentation`, ['camera', 'preset'])) {
      optionalString(rep.presentation.preset, `${path}.presentation.preset`)
      const camera = rep.presentation.camera
      const cp = `${path}.presentation.camera`
      if (camera !== undefined && object(camera, cp, ['position', 'target', 'fov'])) {
        point(camera.position, `${cp}.position`, 3)
        point(camera.target, `${cp}.target`, 3)
        if (samePoint(camera.position, camera.target)) add(`${cp}.position`, 'Camera position must differ from target')
        if (camera.fov !== undefined && (!finite(camera.fov) || camera.fov <= 0 || camera.fov >= 180)) add(`${cp}.fov`, 'Expected FOV greater than 0 and less than 180 degrees')
      }
    }
  })
  const algorithmIds = new Set<string>(), variantIds = new Set<string>()
  if (value.algorithms !== undefined) list(value.algorithms, 'algorithms', KNOT_ASSET_LIMITS.algorithms).forEach((algorithm, i) => {
    const path = `algorithms[${i}]`
    if (!object(algorithm, path, ['id', 'representation', 'steps'])) return
    id(algorithm.id, `${path}.id`, algorithmIds)
    id(algorithm.representation, `${path}.representation`)
    const stepIds = new Set<string>()
    list(algorithm.steps, `${path}.steps`, KNOT_ASSET_LIMITS.steps).forEach((step, j) => {
      if (!object(step, `${path}.steps[${j}]`, ['id', 'snapshot'])) return
      id(step.id, `${path}.steps[${j}].id`, stepIds)
      id(step.snapshot, `${path}.steps[${j}].snapshot`)
    })
  })
  if (value.variants !== undefined) list(value.variants, 'variants', KNOT_ASSET_LIMITS.variants).forEach((variant, i) => {
    const path = `variants[${i}]`
    if (!object(variant, path, ['id', 'representation', 'snapshot'])) return
    id(variant.id, `${path}.id`, variantIds)
    id(variant.representation, `${path}.representation`)
    id(variant.snapshot, `${path}.snapshot`)
  })
  // Reference/animation checks operate only on structurally valid, bounded data.
  if (issues.length) return { valid: false, issues }
  const asset = value as unknown as KnotAsset
  const reps = new Map(asset.representations.map(rep => [rep.id, rep]))
  const snapshots = new Map(asset.representations.map(rep => [rep.id, new Map<string, Snapshot>(rep.snapshots.map(s => [s.id, s]))]))
  for (const [i, algorithm] of (asset.algorithms ?? []).entries()) {
    const path = `algorithms[${i}]`
    if (!reps.has(algorithm.representation)) { add(`${path}.representation`, 'Unknown representation reference'); continue }
    const states = snapshots.get(algorithm.representation)!
    let previous: Snapshot | undefined
    algorithm.steps.forEach((step, j) => {
      const snapshot = states.get(step.snapshot)
      if (!snapshot) add(`${path}.steps[${j}].snapshot`, 'Unknown snapshot in algorithm representation')
      if (previous && snapshot) {
        const before = new Map(previous.elements.map(e => [e.id, e.geometry]))
        for (const element of snapshot.elements) {
          const geometry = before.get(element.id)
          if (geometry && geometry.points.length !== element.geometry.points.length) add(`${path}.steps[${j}].snapshot`, `Control-point count differs for element ${element.id}`)
        }
      }
      previous = snapshot
    })
  }
  for (const [i, variant] of (asset.variants ?? []).entries()) {
    if (!reps.has(variant.representation)) add(`variants[${i}].representation`, 'Unknown representation reference')
    else if (!snapshots.get(variant.representation)!.has(variant.snapshot)) add(`variants[${i}].snapshot`, 'Unknown snapshot in variant representation')
  }
  return issues.length ? { valid: false, issues } : { valid: true, asset, warnings: [] }
}
