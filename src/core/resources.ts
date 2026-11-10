import { sourceIssues } from './metadata'
import standardResources from '../../v1/resources/standard.json'
import { KNOT_NAMESPACE, type Namespaces, type ResourceKind, type ResourceEntry, type RawResourceRegistry, type RawResourceDocument } from './knot'
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
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
export const STANDARD_RESOURCES = freeze(standardResources as unknown as RawResourceRegistry)
/** Reserved v1 spellings, scoped to the field's resource kind. */
export const STANDARD_NAMES = freeze({
  'representation-type': ['image', '2d', '3d', 'grid-diagram', 'mosaic-diagram', 'pd-code', 'dt-code'],
  'object-type': ['rope', 'support', 'carabiner'],
  'algorithm-purpose': ['tying', 'untying', 'transformation', 'adjustment'],
  'tile-set': ['lomonaco-kauffman-11'],
  convention: ['pd-ccw-under-first', 'dt-signed-even'],
} as const)
export function resolveResourceURI(value: string, kind: ResourceKind, namespaces: Namespaces = {}): string {
  const names = STANDARD_NAMES[kind as keyof typeof STANDARD_NAMES] as readonly string[] | undefined
  if (names?.includes(value)) {
    const directory = { 'representation-type': 'representation-types', 'object-type': 'object-types', 'algorithm-purpose': 'algorithm-purposes', 'tile-set': 'tile-sets', convention: 'conventions' }[kind as keyof typeof STANDARD_NAMES]
    return `${KNOT_NAMESPACE}${directory}/${value}`
  }
  return expandURI(value, namespaces)
}
/** Only contract-defined URI fields are expanded; inline JSON Schema is untouched. */
export function normalizeResource(entry: ResourceEntry, namespaces: Namespaces): ResourceEntry {
  const e = structuredClone(entry)
  if (e.resource.id.includes(':')) e.resource.id = expandURI(e.resource.id, namespaces)
  if (e.kind === 'representation-type' || e.kind === 'object-type' || e.kind === 'algorithm-purpose' || e.kind === 'tile-set' || e.kind === 'convention') {
    e.resource.id = expandURI(e.resource.id, namespaces)
    e.resource.specification = expandURI(e.resource.specification, namespaces)
    if ('dataSchema' in e.resource && e.resource.dataSchema.ref) e.resource.dataSchema.ref = expandURI(e.resource.dataSchema.ref, namespaces)
  }
  if (e.kind === 'catalog') e.resource.id = expandURI(e.resource.id, namespaces)
  if (e.kind === 'construction') for (const object of e.resource.objects) object.type = resolveResourceURI(object.type, 'object-type', namespaces)
  return e
}
export function resourceIssues(e: ResourceEntry): ValidationIssue[] {
  const key = { catalog: 'catalog', 'representation-type': 'representationType', 'object-type': 'objectType', 'algorithm-purpose': 'algorithmPurpose', 'tile-set': 'tileSet', convention: 'convention', view: 'view', construction: 'construction', source: 'sourceDefinition' }[e.kind]
  const errors = structure(key, e.resource)
  if (errors.length) return errors
  try { assertStandardResource(e) } catch (error) { return [issue('id', (error as Error).message)] }
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
const standardEntries = STANDARD_RESOURCES.resources.map(entry => freeze(normalizeResource(entry, STANDARD_RESOURCES.namespaces ?? {})))
const standardIndex: ResourceIndex = new Map(standardEntries.map(entry => [entry.resource.id, entry]))
const resourceContract = (value: ResourceEntry) => { const { names, descriptions, ...fields } = value.resource as typeof value.resource & { names?: unknown; descriptions?: unknown }; return canonical({ kind: value.kind, resource: fields }) }
/** Standard identities cannot be given a different kind or contract by callers. */
export function assertStandardResource(entry: ResourceEntry, namespaces: Namespaces = {}): void {
  const standard = standardIndex.get(entry.resource.id)
  if (standard && resourceContract(standard) !== resourceContract(normalizeResource(entry, namespaces))) throw new ViewerError('INVALID_MODEL', `Conflicting standard resource: ${entry.resource.id}`, undefined, false)
}
export function addResource(index: ResourceIndex, entry: ResourceEntry, global = true) {
  if (global) expandURI(entry.resource.id)
  assertStandardResource(entry)
  const previous = index.get(entry.resource.id)
  if (previous && resourceContract(previous) !== resourceContract(entry)) throw new ViewerError('INVALID_MODEL', `Conflicting resource: ${entry.resource.id}`, undefined, false)
  const old = previous?.resource as { names?: unknown; descriptions?: unknown } | undefined
  const incoming = entry.resource as typeof entry.resource & { names?: unknown; descriptions?: unknown }
  index.set(entry.resource.id, previous ? { ...entry, resource: { ...entry.resource, ...(incoming.names === undefined && old?.names !== undefined ? { names: old.names } : {}), ...(incoming.descriptions === undefined && old?.descriptions !== undefined ? { descriptions: old.descriptions } : {}) } } as ResourceEntry : entry)
}
export function createResourceIndex(registries: readonly RawResourceRegistry[] = []): ResourceIndex {
  const index: ResourceIndex = new Map(standardIndex)
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
  const registry = value as RawResourceRegistry
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
    const doc = value as RawResourceDocument
    if (doc.$schema && doc.$schema !== `${KNOT_NAMESPACE}schema/knot-resource.schema.json`) issues.push(issue('$schema','Schema URI contradicts document contract'))
    issues.push(...namespaceIssues(doc.namespaces))
    for (const dependency of doc.dependencies ?? []) {
      try { expandURI(dependency.ref, doc.namespaces) } catch(e) { issues.push(issue('dependencies',(e as Error).message)) }
    }
    try { const entry = normalizeResource({ kind: doc.kind, resource: doc.resource } as ResourceEntry, doc.namespaces ?? {}); expandURI(entry.resource.id); issues.push(...resourceIssues(entry)) } catch(e) { issues.push(issue('resource',(e as Error).message)) }
  }
  return issues.length ? { valid: false as const, issues } : { valid: true as const, document: value as RawResourceDocument, warnings: [] }
}
