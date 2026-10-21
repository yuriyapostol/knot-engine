import type { Component } from 'vue'
import type { KnotAsset } from '../core'
import { expandURI } from '../core'

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
