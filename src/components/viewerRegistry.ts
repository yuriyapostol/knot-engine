import type { Component } from 'vue'
import type { KnotAsset, SelectionResult } from '../core'
import { expandURI, selectRepresentation } from '../core'

export interface ViewerCapabilities {
  orbit?: boolean
  pan?: boolean
  zoom?: boolean
  edit?: boolean
  capture?: readonly ('png' | 'svg')[]
  sequences?: boolean
}
export interface ViewerRegistration {
  typeUri: string
  component: Component
  capabilities: Readonly<ViewerCapabilities>
}
export type ViewerRegistry = ReadonlyMap<string, ViewerRegistration>

export function createViewerRegistry(entries: readonly ViewerRegistration[]): ViewerRegistry {
  const result = new Map<string, ViewerRegistration>()
  for (const entry of entries) {
    if (result.has(entry.typeUri)) throw new Error(`Duplicate viewer type: ${entry.typeUri}`)
    result.set(entry.typeUri, Object.freeze({ ...entry, capabilities: Object.freeze({ ...entry.capabilities }) }))
  }
  return result
}

export function findViewer(asset: KnotAsset, type: string, registry: ViewerRegistry): ViewerRegistration | undefined {
  return registry.get(expandURI(type, asset.namespaces))
}

/**
 * Resolve a viewer without silently preferring a representation by array order.
 * Unsupported siblings do not make an otherwise unique supported choice ambiguous.
 * A custom registry is authoritative: it replaces, rather than extends, built-ins.
 */
export function selectViewerRepresentation(
  asset: KnotAsset,
  registry: ViewerRegistry,
  representationId?: string,
): SelectionResult {
  if (representationId !== undefined) {
    const result = selectRepresentation(asset, { representationId })
    if (result.ok && !registry.has(result.typeUri)) return {
      ok: false,
      issues: [{ code: 'UNSUPPORTED_REPRESENTATION', message: `No viewer registered for ${result.typeUri}` }],
    }
    return result
  }
  // Run core validation even for a missing/malformed representation collection.
  if (!Array.isArray(asset?.representations) || asset.representations.length === 0) {
    return selectRepresentation(asset)
  }
  let candidates: string[]
  try {
    candidates = asset.representations.filter(rep =>
      typeof rep.type === 'string' && registry.has(expandURI(rep.type, asset.namespaces)),
    ).map(rep => rep.id)
  } catch {
    // Let core return its own structured diagnostic for invalid namespaces.
    return selectRepresentation(asset)
  }
  if (candidates.length === 1) return selectRepresentation(asset, { representationId: candidates[0] })
  if (candidates.length > 1) return {
    ok: false,
    issues: [{ code: 'AMBIGUOUS_REPRESENTATION', message: 'Specify representationId: multiple supported representations are available' }],
  }
  return {
    ok: false,
    issues: [{ code: 'UNSUPPORTED_REPRESENTATION', message: 'No registered viewer supports an available representation' }],
  }
}
