import type { KnotAsset, KnotResourceRegistry, Reference, Representation, ViewDefinition } from './asset'
import { expandURI } from './resources'
import { validateView } from './validateSpatial'

export type ViewResolution =
  | { ok: true; view: ViewDefinition | null }
  | { ok: false; message: string }

/**
 * Resolve a view from a selected representation, optionally via supplied registries.
 * No implicit network access; local IDs and global URI references have distinct scopes.
 */
export function resolveRepresentationView(
  asset: KnotAsset,
  representation: Representation,
  requested: Reference | ViewDefinition | undefined,
  registries: readonly KnotResourceRegistry[] = [],
): ViewResolution {
  const candidate = requested ?? representation.defaultView
  if (!candidate) return { ok: true, view: null }
  if ('camera' in candidate) return validateResolved(candidate)
  if ('id' in candidate && candidate.id) {
    const local = representation.views?.find(v => 'id' in v && v.id === candidate.id)
    return local ? validateResolved(local as ViewDefinition) : { ok: false, message: `Unknown local view: ${candidate.id}` }
  }
  if (!('ref' in candidate) || !candidate.ref) return { ok: false, message: 'Invalid view reference' }
  let uri: string
  try { uri = expandURI(candidate.ref, asset.namespaces) }
  catch (error) { return { ok: false, message: (error as Error).message } }
  for (const view of representation.views ?? []) {
    if ('ref' in view && view.ref) {
      try {
        if (expandURI(view.ref, asset.namespaces) === uri) return resolveRegistryView(uri, registries)
      } catch (error) { return { ok: false, message: (error as Error).message } }
    }
    if ('id' in view && view.id === uri) return validateResolved(view)
  }
  return { ok: false, message: `View is not declared by representation: ${uri}` }
}
function validateResolved(view: ViewDefinition): ViewResolution {
  const result = validateView(view)
  return result.valid ? { ok: true, view } : { ok: false, message: 'Invalid view definition' }
}
function resolveRegistryView(uri: string, registries: readonly KnotResourceRegistry[]): ViewResolution {
  let found: ViewDefinition | undefined
  for (const registry of registries) {
    for (const entry of registry.resources) {
      if (entry.kind !== 'view') continue
      let id: string
      try { id = expandURI(entry.resource.id, registry.namespaces) }
      catch (error) { return { ok: false, message: (error as Error).message } }
      if (id !== uri) continue
      if (found && JSON.stringify(found) !== JSON.stringify(entry.resource)) {
        return { ok: false, message: `Conflicting view resource: ${uri}` }
      }
      found = entry.resource
    }
  }
  return found ? validateResolved(found) : { ok: false, message: `Missing view resource: ${uri}` }
}
