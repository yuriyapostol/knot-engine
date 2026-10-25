import { sourceIssues } from './metadata'
import standardResources from '../../v1/resources/standard.json'
import { KNOT_NAMESPACE, type Namespaces, type ResourceEntry, type RawKnotResourceRegistry, type KnotResourceDocument } from './asset'
import { canonical, issue, preflight, structure } from './validation'
import { constructionIssues, viewIssues } from './validateSpatial'
import { ViewerError, type ValidationIssue } from './errors'

const schemes = /^(https?:\/\/[^\s]+|urn:[^\s]+)$/
export function expandURI(value: string, namespaces: Namespaces = {}): string {
  if (schemes.test(value)) return value
  const match = /^([A-Za-z][A-Za-z0-9_-]*):(.+)$/.exec(value)
  if (!match || !Object.hasOwn(namespaces, match[1])) throw new ViewerError('INVALID_MODEL', `Undeclared URI prefix: ${value}`, undefined, false)
  const result = namespaces[match[1]] + match[2]
  if (!schemes.test(result)) throw new ViewerError('INVALID_MODEL', `Expected absolute URI: ${value}`, undefined, false)
  return result
}
export function namespaceIssues(namespaces: Namespaces = {}): ValidationIssue[] {
  return Object.entries(namespaces).flatMap(([key,value]) => ['http','https','urn'].includes(key.toLowerCase()) || !schemes.test(value) ? [issue(`namespaces.${key}`, 'Reserved prefix or invalid namespace URI')] : [])
}
export const STANDARD_RESOURCES = standardResources as unknown as RawKnotResourceRegistry
/** Only contract-defined URI fields are expanded; inline JSON Schema is untouched. */
export function normalizeResource(entry: ResourceEntry, namespaces: Namespaces): ResourceEntry {
  const e = structuredClone(entry)
  if (e.resource.id.includes(':')) e.resource.id = expandURI(e.resource.id, namespaces)
  if (e.kind === 'representation-type' || e.kind === 'object-type') {
    e.resource.id = expandURI(e.resource.id, namespaces)
    e.resource.specification = expandURI(e.resource.specification, namespaces)
    if (e.resource.dataSchema.ref) e.resource.dataSchema.ref = expandURI(e.resource.dataSchema.ref, namespaces)
  }
  if (e.kind === 'catalog') e.resource.id = expandURI(e.resource.id, namespaces)
  if (e.kind === 'construction') for (const object of e.resource.objects) object.type = expandURI(object.type, namespaces)
  return e
}
export function resourceIssues(e: ResourceEntry): ValidationIssue[] {
  const key = { catalog: 'catalog', 'representation-type': 'representationType', 'object-type': 'objectType', view: 'view', construction: 'construction', source: 'sourceDefinition' }[e.kind]
  const errors = structure(key, e.resource)
  if (errors.length) return errors
  if (e.kind === 'source') return sourceIssues(e.resource, 'resource')
  if (e.kind === 'construction') return constructionIssues(e.resource)
  if (e.kind === 'view') return viewIssues(e.resource)
  if (e.kind === 'catalog' && e.resource.homepage && !/^https?:\/\/[^\s]+$/.test(e.resource.homepage)) return [issue('homepage', 'Expected a full HTTP(S) URL')]
  if (e.kind === 'catalog' && e.resource.identifierRules?.pattern) {
    try { new RegExp(e.resource.identifierRules.pattern) } catch { return [issue('identifierRules.pattern', 'Invalid ECMA-262 expression')] }
  }
  if ((e.kind === 'representation-type' || e.kind === 'object-type') && e.resource.dataSchema.inline && typeof e.resource.dataSchema.inline.$schema !== 'string') return [issue('dataSchema.inline.$schema', 'Inline JSON Schema requires a dialect')]
  return []
}
export type ResourceIndex = Map<string, ResourceEntry>
export function addResource(index: ResourceIndex, entry: ResourceEntry, global = true) {
  if (global) expandURI(entry.resource.id)
  const previous = index.get(entry.resource.id)
  const contract = (value: ResourceEntry) => { const { names, descriptions, ...fields } = value.resource as typeof value.resource & { names?: unknown; descriptions?: unknown }; return canonical({ kind: value.kind, resource: fields }) }
  if (previous && contract(previous) !== contract(entry)) throw new ViewerError('INVALID_MODEL', `Conflicting resource: ${entry.resource.id}`, undefined, false)
  const old = previous?.resource as { names?: unknown; descriptions?: unknown } | undefined
  const incoming = entry.resource as typeof entry.resource & { names?: unknown; descriptions?: unknown }
  index.set(entry.resource.id, previous ? { ...entry, resource: { ...entry.resource, ...(incoming.names === undefined && old?.names !== undefined ? { names: old.names } : {}), ...(incoming.descriptions === undefined && old?.descriptions !== undefined ? { descriptions: old.descriptions } : {}) } } as ResourceEntry : entry)
}
export function createResourceIndex(registries: readonly RawKnotResourceRegistry[] = []): ResourceIndex {
  const index: ResourceIndex = new Map()
  for (const registry of registries) {
    const checked = validateResourceRegistry(registry)
    if (!checked.valid) throw new ViewerError('INVALID_MODEL', 'Invalid resource registry', checked.issues, false)
    for (const entry of registry.resources) addResource(index, normalizeResource(entry, registry.namespaces ?? {}))
  }
  return index
}
export function validateResourceRegistry(value: unknown) {
  let issues = preflight(value)
  if (!issues.length) issues = structure('registry', value)
  if (issues.length) return { valid: false as const, issues }
  const registry = value as RawKnotResourceRegistry
  if (registry.$schema && registry.$schema !== `${KNOT_NAMESPACE}schema/knot-resource-registry.schema.json`) issues.push(issue('$schema','Schema URI contradicts document contract'))
  issues.push(...namespaceIssues(registry.namespaces))
  const seen: ResourceIndex = new Map()
  registry.resources.forEach((entry, i) => {
    try {
      const normalized = normalizeResource(entry,registry.namespaces ?? {})
      issues.push(...resourceIssues(normalized).map(e => ({ ...e, path: `resources.${i}.${e.path}` })))
      addResource(seen, normalized)
    } catch(e) { issues.push(issue(`resources.${i}`, (e as Error).message)) }
  })
  return issues.length ? { valid: false as const, issues } : { valid: true as const, registry, warnings: [] }
}
export function validateResourceDocument(value: unknown) {
  let issues = preflight(value)
  if (!issues.length) issues = structure('resourceDocument', value)
  if (!issues.length) {
    const doc = value as KnotResourceDocument
    if (doc.$schema && doc.$schema !== `${KNOT_NAMESPACE}schema/knot-resource.schema.json`) issues.push(issue('$schema','Schema URI contradicts document contract'))
    issues.push(...namespaceIssues(doc.namespaces))
    for (const dependency of doc.dependencies ?? []) {
      try { expandURI(dependency.ref, doc.namespaces) } catch(e) { issues.push(issue('dependencies',(e as Error).message)) }
    }
    try { const entry = normalizeResource({ kind: doc.kind, resource: doc.resource } as ResourceEntry, doc.namespaces ?? {}); expandURI(entry.resource.id); issues.push(...resourceIssues(entry)) } catch(e) { issues.push(issue('resource',(e as Error).message)) }
  }
  return issues.length ? { valid: false as const, issues } : { valid: true as const, document: value as KnotResourceDocument, warnings: [] }
}
