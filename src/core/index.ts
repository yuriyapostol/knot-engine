export type Point3 = [number, number, number]
export interface CameraView { position: Point3; target: Point3; fov: number }
export interface KnotCurve {
  id: string
  closed: boolean
  interpolation: { type: 'catmullrom'; tension: number }
  radius: number
  points: Point3[]
}
export interface KnotModelV1 {
  schemaVersion: 1
  id?: string
  coordinateSystem: 'right-handed-y-up'
  units: 'relative'
  curves: KnotCurve[]
  preview?: { preset?: 'light-outline-v1'; cameraPosition?: Point3; target?: Point3; fov?: number }
}
export type ViewerErrorCode = 'INVALID_MODEL' | 'UNSUPPORTED_SCHEMA' | 'LIMIT_EXCEEDED' | 'WEBGL_UNAVAILABLE' | 'CONTEXT_LOST' | 'RENDER_FAILED' | 'CAPTURE_FAILED'
export interface ValidationIssue { path: string; message: string; code: ViewerErrorCode }
export type ValidationResult = { valid: true; model: KnotModelV1; warnings: string[] } | { valid: false; issues: ValidationIssue[] }
export class ViewerError extends Error {
  constructor(public code: ViewerErrorCode, message: string, public issues?: ValidationIssue[], public recoverable = true) {
    super(message)
    this.name = 'ViewerError'
  }
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const point = (value: unknown): value is Point3 => Array.isArray(value) && value.length === 3 && value.every(v => finite(v) && Math.abs(v) <= 100000)

export function validateModel(value: unknown, options: { strict?: boolean } = {}): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (path: string, message: string, code: ViewerErrorCode = 'INVALID_MODEL') => issues.push({ path, message, code })
  const keys = (object: Record<string, unknown>, allowed: string[], path: string) => {
    if (options.strict) for (const key of Object.keys(object)) if (!allowed.includes(key)) add(path ? `${path}.${key}` : key, 'Unknown field')
  }
  if (!record(value)) return { valid: false, issues: [{ path: '', message: 'Expected an object', code: 'INVALID_MODEL' }] }
  keys(value, ['schemaVersion', 'id', 'coordinateSystem', 'units', 'curves', 'preview'], '')
  if (value.schemaVersion !== 1) add('schemaVersion', 'Only schema version 1 is supported', 'UNSUPPORTED_SCHEMA')
  if (value.id !== undefined && (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 256)) add('id', 'Expected a nonempty string of at most 256 characters')
  if (value.coordinateSystem !== 'right-handed-y-up') add('coordinateSystem', 'Expected right-handed-y-up')
  if (value.units !== 'relative') add('units', 'Expected relative')
  if (!Array.isArray(value.curves) || value.curves.length < 1 || value.curves.length > 8) add('curves', 'Expected 1 to 8 curves', 'LIMIT_EXCEEDED')
  let total = 0
  const ids = new Set<string>()
  if (Array.isArray(value.curves)) value.curves.slice(0, 9).forEach((curve: unknown, index) => {
    const path = `curves[${index}]`
    if (!record(curve)) { add(path, 'Expected a curve object'); return }
    keys(curve, ['id', 'closed', 'interpolation', 'radius', 'points'], path)
    if (typeof curve.id !== 'string' || !curve.id.length || curve.id.length > 128) add(`${path}.id`, 'Expected a nonempty string of at most 128 characters')
    else if (ids.has(curve.id)) add(`${path}.id`, 'Duplicate curve ID')
    else ids.add(curve.id)
    if (typeof curve.closed !== 'boolean') add(`${path}.closed`, 'Expected boolean')
    if (!record(curve.interpolation)) add(`${path}.interpolation`, 'Expected interpolation object')
    else {
      keys(curve.interpolation, ['type', 'tension'], `${path}.interpolation`)
      if (curve.interpolation.type !== 'catmullrom') add(`${path}.interpolation.type`, 'Only catmullrom is supported', 'UNSUPPORTED_SCHEMA')
      if (!finite(curve.interpolation.tension) || curve.interpolation.tension < 0 || curve.interpolation.tension > 1) add(`${path}.interpolation.tension`, 'Expected a number from 0 to 1')
    }
    if (!finite(curve.radius) || curve.radius <= 0 || curve.radius > 10000) add(`${path}.radius`, 'Expected radius greater than 0 and at most 10000')
    if (!Array.isArray(curve.points) || curve.points.length < (curve.closed ? 3 : 2) || curve.points.length > 512) add(`${path}.points`, 'Expected 2–512 points (3–512 if closed)', 'LIMIT_EXCEEDED')
    if (Array.isArray(curve.points)) {
      const points: unknown[] = curve.points
      total += points.length
      let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
      points.slice(0, 513).forEach((p: unknown, j) => {
        if (!point(p)) { add(`${path}.points[${j}]`, 'Expected three finite coordinates within ±100000'); return }
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]) }
      })
      const span = Math.hypot(...max.map((n, k) => n - min[k]))
      if (Number.isFinite(span)) {
        if (span === 0) add(`${path}.points`, 'Curve has zero extent')
        const epsilon = Math.max(span * 1e-9, 1e-12)
        const distance = (a: unknown, b: unknown) => point(a) && point(b) ? Math.hypot(...a.map((n, k) => n - b[k])) : Infinity
        for (let j = 1; j < Math.min(points.length, 513); j++) if (distance(points[j], points[j - 1]) <= epsilon) add(`${path}.points[${j}]`, 'Consecutive points overlap')
        if (curve.closed && points.length && distance(points[0], points.at(-1)) <= epsilon) add(`${path}.points[${points.length - 1}]`, 'Closed curve must not repeat its first point')
      }
    }
  })
  if (total > 2048) add('curves', 'Model exceeds 2048 points', 'LIMIT_EXCEEDED')
  if (value.preview !== undefined) {
    if (!record(value.preview)) add('preview', 'Expected preview object')
    else {
      const p = value.preview
      keys(p, ['preset', 'cameraPosition', 'target', 'fov'], 'preview')
      if (p.preset !== undefined && p.preset !== 'light-outline-v1') add('preview.preset', 'Unknown preset', 'UNSUPPORTED_SCHEMA')
      if ((p.cameraPosition === undefined) !== (p.target === undefined)) add('preview', 'cameraPosition and target must be supplied together')
      if (p.cameraPosition !== undefined && !point(p.cameraPosition)) add('preview.cameraPosition', 'Expected valid coordinates')
      if (p.target !== undefined && !point(p.target)) add('preview.target', 'Expected valid coordinates')
      if (point(p.cameraPosition) && point(p.target) && p.cameraPosition.every((n, k) => n === (p.target as Point3)[k])) add('preview.cameraPosition', 'Camera position must differ from target')
      if (p.fov !== undefined && (!finite(p.fov) || p.fov < 10 || p.fov > 100)) add('preview.fov', 'Expected FOV from 10 to 100')
    }
  }
  return issues.length ? { valid: false, issues } : { valid: true, model: value as unknown as KnotModelV1, warnings: [] }
}
