import type { KnotAsset } from './asset'
import { validateKnotAsset } from './validateAsset'
import { ViewerError } from './legacy'

function checked(value: unknown): KnotAsset {
  const result = validateKnotAsset(value, { strict: true })
  if (!result.valid) throw new ViewerError(result.issues[0].code, 'Invalid KnotAsset part', result.issues, false)
  return result.asset
}

/** Produces an independent asset containing only requested views and their dependencies. */
export function selectKnotAsset(value: unknown, selection: { representations?: string[]; diagrams?: string[] }): KnotAsset {
  const asset = checked(value)
  const reps = new Set(selection.representations ?? [])
  const diagrams = new Set(selection.diagrams ?? [])
  for (const id of reps) if (!asset.representations.some(r => r.id === id)) throw new ViewerError('INVALID_MODEL', `Unknown representation: ${id}`, undefined, false)
  for (const id of diagrams) if (!asset.diagrams?.some(d => d.id === id)) throw new ViewerError('INVALID_MODEL', `Unknown diagram: ${id}`, undefined, false)
  const representations = asset.representations.filter(r => reps.has(r.id))
  const elements = new Set(representations.flatMap(r => r.snapshots.flatMap(s => s.elements.map(e => e.id))))
  return structuredClone({
    ...asset,
    elements: asset.elements.filter(e => elements.has(e.id)),
    representations,
    diagrams: asset.diagrams?.filter(d => diagrams.has(d.id)),
    algorithms: asset.algorithms?.filter(a => reps.has(a.representation)),
    variants: asset.variants?.filter(v => reps.has(v.representation))
  })
}

/** Joins fragments of the same knot. Equal IDs must have equal content; conflicts are errors. */
export function composeKnotAsset(values: readonly unknown[]): KnotAsset {
  if (!values.length) throw new ViewerError('INVALID_MODEL', 'Expected at least one asset part', undefined, false)
  const parts = values.map(checked)
  const output = structuredClone(parts[0])
  // Compare JSON content independent of object key insertion order.
  const canonical = (value: unknown): string => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
  for (const part of parts.slice(1)) {
    if (part.id !== output.id || part.units !== output.units) throw new ViewerError('INVALID_MODEL', 'Asset parts must describe the same knot and units', undefined, false)
    for (const key of ['schema', '$schema', 'name', 'aliases'] as const) {
      if (part[key] === undefined) continue
      if (output[key] !== undefined && canonical(output[key]) !== canonical(part[key])) throw new ViewerError('INVALID_MODEL', `Conflicting identity field: ${key}`, undefined, false)
      Object.assign(output, { [key]: structuredClone(part[key]) })
    }
    for (const key of ['elements', 'representations', 'diagrams', 'algorithms', 'variants'] as const) {
      const merged = new Map((output[key] ?? []).map(item => [item.id, item]))
      for (const item of part[key] ?? []) {
        const previous = merged.get(item.id)
        if (previous && canonical(previous) !== canonical(item)) throw new ViewerError('INVALID_MODEL', `Conflicting ${key} ID: ${item.id}`, undefined, false)
        merged.set(item.id, structuredClone(item))
      }
      if (output[key] !== undefined || part[key] !== undefined) Object.assign(output, { [key]: [...merged.values()] })
    }
  }
  return checked(output)
}
