import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js'
import contracts from './contracts.json'
import type { ValidationIssue } from './errors'

export const KNOT_ASSET_LIMITS = { depth: 64, entries: 262144, points: 65536, mosaicCells: 65536, stringLength: 1048576 } as const
export const canonical = (value: unknown): string => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
export const issue = (path: string, message: string, code: ValidationIssue['code'] = 'INVALID_MODEL'): ValidationIssue => ({ path, message, code })
/** Bound traversal before any schema validator, also rejecting non-JSON values/cycles. */
export function preflight(value: unknown): ValidationIssue[] {
  let entries = 0
  const active = new Set<object>()
  function walk(v: unknown, path: string, depth: number): ValidationIssue | undefined {
    if (++entries > KNOT_ASSET_LIMITS.entries || depth > KNOT_ASSET_LIMITS.depth) return issue(path, 'Resource budget exceeded', 'LIMIT_EXCEEDED')
    if (v === null || typeof v === 'boolean') return
    if (typeof v === 'number') return Number.isFinite(v) ? undefined : issue(path, 'Expected finite number')
    if (typeof v === 'string') return v.length <= KNOT_ASSET_LIMITS.stringLength ? undefined : issue(path, 'String budget exceeded', 'LIMIT_EXCEEDED')
    if (typeof v !== 'object' || (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) return issue(path, 'Expected JSON data')
    if (active.has(v)) return issue(path, 'Cyclic input is not JSON')
    active.add(v)
    if (Array.isArray(v) && v.length + entries > KNOT_ASSET_LIMITS.entries) return issue(path, 'Resource budget exceeded', 'LIMIT_EXCEEDED')
    const keys = Object.keys(v)
    if (Array.isArray(v) && (keys.length !== v.length || keys.some((k,i) => k !== String(i)))) return issue(path, 'Expected a dense JSON array')
    if (keys.length + entries > KNOT_ASSET_LIMITS.entries) return issue(path, 'Resource budget exceeded', 'LIMIT_EXCEEDED')
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(v, key)!
      if (!('value' in descriptor)) return issue(path, 'Accessors are not JSON data')
      const error = walk(descriptor.value, path ? `${path}.${key}` : key, depth + 1)
      if (error) return error
    }
    active.delete(v)
  }
  const error = walk(value, '', 0)
  return error ? [error] : []
}
const ajv = new Ajv2020({ strict: false, allErrors: false, validateFormats: false })
const validators = new Map<string, ValidateFunction>()
export function structure(kind: string, value: unknown): ValidationIssue[] {
  let validate = validators.get(kind)
  if (!validate) { validate = ajv.compile({ ...contracts, $ref: `#/$defs/${kind}` }); validators.set(kind, validate) }
  if (validate(value)) return []
  return (validate.errors ?? []).map(e => issue(e.instancePath.replace(/^\//, '').replaceAll('/', '.'), `${e.message}${e.params.missingProperty ? `: ${e.params.missingProperty}` : ''}`))
}
export function duplicates(items: { id: string }[], path: string): ValidationIssue[] {
  const seen = new Set<string>(), issues: ValidationIssue[] = []
  items.forEach((v, i) => { if (seen.has(v.id)) issues.push(issue(`${path}.${i}.id`, 'Duplicate ID')); seen.add(v.id) })
  return issues
}
export function parallel(a: number[], b: number[]): boolean {
  const an = Math.hypot(...a), bn = Math.hypot(...b)
  if (!an || !bn || !Number.isFinite(an) || !Number.isFinite(bn)) return true
  const x = a.map(v => v / an), y = b.map(v => v / bn)
  return Math.hypot(x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]) < 1e-12
}
export type DataResult<T> = { valid: true; data: T; warnings: string[] } | { valid: false; issues: ValidationIssue[] }
export function standalone<T>(kind: string, value: unknown, semantic: (data: T) => ValidationIssue[] = () => []): DataResult<T> {
  let issues = preflight(value)
  if (!issues.length) issues = structure(kind, value)
  if (!issues.length) issues = semantic(value as T)
  return issues.length ? { valid: false, issues } : { valid: true, data: value as T, warnings: [] }
}
