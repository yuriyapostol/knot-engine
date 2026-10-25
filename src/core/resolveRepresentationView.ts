import type { RawResourceRegistry, Reference, ViewDefinition } from './knot'
import { expandURI } from './resources'
import { validateView } from './validateSpatial'

export type ViewResolution =
  | { ok: true; view: ViewDefinition | null }
  | { ok: false; message: string }

/** Resolve an explicitly requested view from application-owned presets.
 * RawKnot representations are never consulted for camera defaults or presets.
 * Registry lookup is explicit and never performs network access.
 */
export function resolveRepresentationView(
  requested: Reference | ViewDefinition | undefined,
  views: readonly ViewDefinition[] = [],
  registries: readonly RawResourceRegistry[] = [],
  namespaces: Readonly<Record<string, string>> = {},
): ViewResolution {
  if (!requested) return { ok: true, view: null }
  if ('camera' in requested) return validateResolved(requested)
  if ('id' in requested && requested.id) {
    const matches = views.filter(view => view.id === requested.id)
    if (matches.length !== 1) return { ok: false, message: matches.length ? `Ambiguous local view: ${requested.id}` : `Unknown local view: ${requested.id}` }
    return validateResolved(matches[0])
  }
  if (!('ref' in requested) || !requested.ref) return { ok: false, message: 'Invalid view reference' }
  let uri: string
  try { uri = expandURI(requested.ref, namespaces) }
  catch (error) { return { ok: false, message: (error as Error).message } }
  let found: ViewDefinition | undefined
  for (const registry of registries) {
    for (const entry of registry.resources) {
      if (entry.kind !== 'view') continue
      let id: string
      try { id = expandURI(entry.resource.id, registry.namespaces) }
      catch (error) { return { ok: false, message: (error as Error).message } }
      if (id !== uri) continue
      if (found && JSON.stringify(found) !== JSON.stringify(entry.resource)) return { ok: false, message: `Conflicting view resource: ${uri}` }
      found = entry.resource
    }
  }
  return found ? validateResolved(found) : { ok: false, message: `Missing view resource: ${uri}` }
}
function validateResolved(view: ViewDefinition): ViewResolution {
  const result = validateView(view)
  return result.valid ? { ok: true, view } : { ok: false, message: 'Invalid view definition' }
}
