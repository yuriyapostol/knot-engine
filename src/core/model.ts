import type { RawKnot, RawRepresentation, RawProcedure, RawStep, RawSubject, RawResourceRegistry, ResourceEntry, Construction, SpatialCurveData } from './knot'
import { STANDARD_RESOURCES, expandURI } from './resources'
import { SPATIAL_CURVE } from './knot'
import { validateKnot } from './validateKnot'
import { selectKnot, composeKnot } from './knotParts'

export type RawLocalizedTexts = { language: string; value: string }[]
export type PreparedResource = ResourceEntry['resource'] & { getName(locale?: string): string | undefined; getDescription(locale?: string): string | undefined }
export type LocalizedConfig = { locale?: string; fallbackLocale?: string; overrides?: Record<string, { names?: RawLocalizedTexts; descriptions?: RawLocalizedTexts }> }
let config: Required<LocalizedConfig> = { locale: 'en', fallbackLocale: 'en', overrides: {} }
const localizationListeners = new Set<() => void>()
/** Subscribe to global localization changes; returns an unsubscribe callback. */
export function subscribeLocalization(listener: () => void): () => void {
  localizationListeners.add(listener)
  return () => { localizationListeners.delete(listener) }
}
export function configureLocalization(options: LocalizedConfig): void {
  config = { ...config, ...options }
  for (const listener of [...localizationListeners]) listener()
}
export class LocalizedTexts extends Array<{ language: string; value: string }> {
  getExact(language = config.locale): string | undefined {
    return this.find(x => x.language === language)?.value ?? this.find(x => x.language === language.split('-')[0])?.value
  }
  get(language = config.locale): string | undefined {
    return this.getExact(language) ?? this.getExact(config.fallbackLocale) ?? this.getExact('en')
  }
}
const owner = new WeakMap<object, Knot>()
const textOwner = new WeakMap<object, Knot>()
const resourceOwner = new WeakMap<object, Knot>()
const resourceKey = new WeakMap<object, string>()
const localizations = new WeakMap<Knot, LocalizedConfig>()
export type KnotOptions = LocalizedConfig & { registries?: readonly RawResourceRegistry[] }
function exact(values: RawLocalizedTexts | undefined, language: string): string | undefined {
  return values?.find(x => x.language === language)?.value ?? values?.find(x => x.language === language.split('-')[0])?.value
}
function languageFor(knot?: Knot): string { return (knot && localizations.get(knot)?.locale) || config.locale }
function fallbackFor(knot?: Knot): string { return (knot && localizations.get(knot)?.fallbackLocale) || config.fallbackLocale }
function overrideFor(knot: Knot | undefined, id: string, key: 'names' | 'descriptions', language: string): string | undefined {
  return exact(knot && localizations.get(knot)?.overrides?.[id]?.[key], language) ?? exact(config.overrides[id]?.[key], language)
}
const contexts = new WeakMap<Knot, Map<string, PreparedResource>>()
const typedContexts = new WeakMap<Knot, Map<string, PreparedResource>>()
const resourceIdentity = (kind: ResourceEntry['kind'], id: string) => `${kind}:${id}`
const registries = new WeakMap<Knot, readonly RawResourceRegistry[]>()
function localized(values: RawLocalizedTexts | undefined, entity: object & { id?: string }, key: 'names' | 'descriptions' | 'instructions', language?: string): string | undefined {
  const knot = textOwner.get(entity)
  const target = language ?? languageFor(knot)
  const overrideKey = key === 'instructions' ? undefined : key
  const override = (locale: string) => overrideKey && entity.id ? overrideFor(knot, entity.id, overrideKey, locale) : undefined
  return override(target) ?? exact(values, target) ?? override(fallbackFor(knot))
    ?? exact(values, fallbackFor(knot)) ?? exact(values, 'en')
}
function texts(values?: RawLocalizedTexts): LocalizedTexts | undefined {
  if (!values) return undefined
  Object.setPrototypeOf(values, LocalizedTexts.prototype)
  return values as LocalizedTexts
}
function decorate(value: any): void {
  for (const key of ['names', 'descriptions', 'instructions']) if (Array.isArray(value[key])) texts(value[key])
}
const resourceMethods = {
  getName(this: any, language?: string): string | undefined {
    const knot = resourceOwner.get(this)
    const target = language ?? languageFor(knot)
    return overrideFor(knot, resourceKey.get(this) ?? this.id, 'names', target) ?? exact(this.names, target)
      ?? overrideFor(knot, resourceKey.get(this) ?? this.id, 'names', fallbackFor(knot)) ?? exact(this.names, fallbackFor(knot))
      ?? exact(this.names, 'en') ?? this.name
  },
  getDescription(this: any, language?: string): string | undefined {
    const knot = resourceOwner.get(this)
    const target = language ?? languageFor(knot)
    return overrideFor(knot, resourceKey.get(this) ?? this.id, 'descriptions', target) ?? exact(this.descriptions, target)
      ?? overrideFor(knot, resourceKey.get(this) ?? this.id, 'descriptions', fallbackFor(knot)) ?? exact(this.descriptions, fallbackFor(knot))
      ?? exact(this.descriptions, 'en') ?? this.description
  },
}
function resource<T extends object>(input: T, knot: Knot, id: string): T & PreparedResource {
  // Share the immutable source definition; only the lightweight view is per-Knot.
  // Never decorate or change the prototype of definitions supplied by a registry.
  const view = Object.create(input) as T & PreparedResource
  Object.defineProperties(view, {
    getName: { value: resourceMethods.getName, enumerable: false },
    getDescription: { value: resourceMethods.getDescription, enumerable: false },
  })
  resourceOwner.set(view, knot)
  resourceKey.set(view, id)
  return view
}
export class Subject implements RawSubject {
  id!: string
  names?: LocalizedTexts
  descriptions?: LocalizedTexts
  identifiers?: RawSubject['identifiers']
  getName(language?: string): string | undefined { return localized(this.names, this, 'names', language) }
  getDescription(language?: string): string | undefined { return localized(this.descriptions, this, 'descriptions', language) }
}
export class Representation implements RawRepresentation {
  target?: RawRepresentation['target']
  id!: string
  type!: string
  data!: unknown
  names?: LocalizedTexts
  descriptions?: LocalizedTexts
  getTypeDefinition(): PreparedResource | undefined { return owner.get(this)?.getResource(this.type, 'representation-type') }
  getName(language?: string): string {
    const knot = owner.get(this)
    const target = language ?? languageFor(knot)
    const def = this.getTypeDefinition() as any
    return overrideFor(knot, resourceKey.get(this) ?? this.id, 'names', target) ?? exact(this.names, target)
      ?? (def ? overrideFor(knot, resourceKey.get(def) ?? def.id, 'names', target) : undefined) ?? exact(def?.names, target)
      ?? exact(this.names, fallbackFor(knot)) ?? exact(def?.names, fallbackFor(knot))
      ?? exact(this.names, 'en') ?? exact(def?.names, 'en') ?? def?.name ?? this.id
  }
  getDescription(language?: string): string | undefined {
    const knot = owner.get(this)
    const target = language ?? languageFor(knot)
    const def = this.getTypeDefinition() as any
    return overrideFor(knot, resourceKey.get(this) ?? this.id, 'descriptions', target) ?? exact(this.descriptions, target)
      ?? (def ? overrideFor(knot, resourceKey.get(def) ?? def.id, 'descriptions', target) : undefined) ?? exact(def?.descriptions, target)
      ?? exact(this.descriptions, fallbackFor(knot)) ?? exact(def?.descriptions, fallbackFor(knot))
      ?? exact(this.descriptions, 'en') ?? exact(def?.descriptions, 'en') ?? def?.description
  }
}
export class Step implements RawStep {
  id!: string
  representations?: RawStep['representations']
  names?: LocalizedTexts
  instructions?: LocalizedTexts
  getName(language?: string): string | undefined { return localized(this.names, this, 'names', language) }
  getInstructions(language?: string): string | undefined { return localized(this.instructions, this, 'instructions', language) }
}
export class Procedure implements RawProcedure {
  construction?: RawProcedure['construction']
  id!: string
  steps!: Step[]
  names?: LocalizedTexts
  descriptions?: LocalizedTexts
  getName(language?: string): string | undefined { return localized(this.names, this, 'names', language) }
  getDescription(language?: string): string | undefined { return localized(this.descriptions, this, 'descriptions', language) }
  getStep(id: string): Step | undefined { return this.steps.find(x => x.id === id) }
  addStep(input: RawStep): Step {
    if (this.getStep(input.id)) throw new Error('Duplicate step ID: ' + input.id)
    const step = structuredClone(input) as Step
    const knot = textOwner.get(this)
    if (knot) textOwner.set(step, knot)
    decorate(step)
    Object.setPrototypeOf(step, Step.prototype)
    this.steps = Object.freeze([...this.steps, step]) as unknown as Step[]
    return step
  }
  removeStep(id: string): boolean {
    if (!this.getStep(id)) return false
    this.steps = Object.freeze(this.steps.filter(x => x.id !== id)) as unknown as Step[]
    return true
  }
}
export class Knot implements RawKnot {
  schema!: 'Knot'
  schemaVersion!: 1
  id!: string
  subject!: Subject
  representations?: Representation[]
  procedures?: Procedure[]
  namespaces?: RawKnot['namespaces']
  catalogs?: RawKnot['catalogs']
  representationTypes?: RawKnot['representationTypes']
  objectTypes?: RawKnot['objectTypes']
  constructions?: RawKnot['constructions']
  static from(input: RawKnot | Knot, options: KnotOptions = {}): Knot {
    if (input instanceof Knot) return input
    return prepareKnot(input, options.registries, options)
  }
  static validate(input: unknown, options: { registries?: readonly RawResourceRegistry[] } = {}) { return validateKnot(input, options) }
  validate(options: { registries?: readonly RawResourceRegistry[] } = {}) { return validateKnot(this.toRaw(), { registries: options.registries ?? registries.get(this) }) }
  static compose(parts: readonly (RawKnot | Knot)[], options: KnotOptions = {}): Knot {
    return Knot.from(composeKnot(parts.map(x => x instanceof Knot ? x.toRaw() : x), options), options)
  }
  getRepresentation(id: string): Representation | undefined { return this.representations?.find(x => x.id === id) }
  getProcedure(id: string): Procedure | undefined { return this.procedures?.find(x => x.id === id) }
  addProcedure(input: RawProcedure): Procedure {
    if (this.getProcedure(input.id)) throw new Error('Duplicate procedure ID: ' + input.id)
    const procedure = structuredClone(input) as Procedure
    textOwner.set(procedure, this)
    decorate(procedure)
    Object.setPrototypeOf(procedure, Procedure.prototype)
    for (const step of procedure.steps) { textOwner.set(step, this); decorate(step); Object.setPrototypeOf(step, Step.prototype) }
    procedure.steps = Object.freeze(procedure.steps) as unknown as Step[]
    this.procedures = Object.freeze([...(this.procedures ?? []), procedure]) as unknown as Procedure[]
    return procedure
  }
  removeProcedure(id: string): boolean {
    if (!this.getProcedure(id)) return false
    this.procedures = Object.freeze((this.procedures ?? []).filter(x => x.id !== id)) as unknown as Procedure[]
    return true
  }
  getConstruction(id: string): Construction | undefined {
    return this.constructions?.find((construction): construction is Construction =>
      'id' in construction && construction.id === id)
  }
  addConstruction(input: Construction): Construction {
    if (this.getConstruction(input.id)) throw new Error('Duplicate construction ID: ' + input.id)
    const value = structuredClone(input)
    this.constructions = Object.freeze([...(this.constructions ?? []), value]) as unknown as RawKnot['constructions']
    return value
  }
  /** Add a state to a local construction, preserving the construction instance. */
  addConstructionState(constructionId: string, input: NonNullable<Construction['states']>[number]): NonNullable<Construction['states']>[number] {
    const construction = this.getConstruction(constructionId)
    if (!construction) throw new Error('Unknown local construction: ' + constructionId)
    if (construction.states?.some(state => state.id === input.id)) throw new Error('Duplicate construction state ID: ' + input.id)
    const value = structuredClone(input)
    construction.states = [...(construction.states ?? []), value]
    return value
  }
  /** Add an object to a local construction, preserving the construction instance. */
  addConstructionObject(constructionId: string, input: Construction['objects'][number]): Construction['objects'][number] {
    const construction = this.getConstruction(constructionId)
    if (!construction) throw new Error('Unknown local construction: ' + constructionId)
    if (construction.objects.some(object => object.id === input.id)) throw new Error('Duplicate construction object ID: ' + input.id)
    const value = structuredClone(input)
    construction.objects = [...construction.objects, value]
    return value
  }
  /** Remove a state only if no representation targets it. */
  removeConstructionState(constructionId: string, stateId: string): boolean {
    const construction = this.getConstruction(constructionId)
    if (!construction?.states?.some(state => state.id === stateId)) return false
    if (this.representations?.some(rep => rep.target?.kind === 'state' &&
      rep.target.id === stateId && this.referencesConstruction(rep.target.construction, constructionId)))
      throw new Error('Construction state is referenced by a representation: ' + stateId)
    construction.states = construction.states.filter(state => state.id !== stateId)
    return true
  }
  /** Remove an object only if no representation target or spatial curve uses it. */
  removeConstructionObject(constructionId: string, objectId: string): boolean {
    const construction = this.getConstruction(constructionId)
    if (!construction?.objects.some(object => object.id === objectId)) return false
    if (this.representations?.some(rep => {
      if (!rep.target || rep.target.kind === 'subject' || !this.referencesConstruction(rep.target.construction, constructionId)) return false
      if (rep.target.kind === 'object' && rep.target.id === objectId) return true
      if (this.resolveURI(rep.type) !== SPATIAL_CURVE) return false
      const curves = (rep.data as Partial<SpatialCurveData> | null)?.curves
      return Array.isArray(curves) && curves.some(curve => curve.object === objectId)
    })) throw new Error('Construction object is referenced by a representation: ' + objectId)
    construction.objects = construction.objects.filter(object => object.id !== objectId)
    return true
  }
  private resolveURI(id: string): string {
    try { return expandURI(id, this.namespaces) }
    catch { return id }
  }
  private referencesConstruction(ref: { id?: string; ref?: string }, id: string): boolean {
    // { id } addresses an inline construction; { ref } addresses a registry resource.
    // The validator resolves these independently, even if their URI strings coincide.
    return ref.id === id
  }
  removeConstruction(id: string): boolean {
    const target = this.getConstruction(id)
    if (!target) return false
    const matches = (ref: { id?: string; ref?: string }): boolean => this.referencesConstruction(ref, id)
    if (this.representations?.some(rep => rep.target && rep.target.kind !== 'subject' && matches(rep.target.construction)))
      throw new Error('Construction is referenced by a representation: ' + id)
    if (this.procedures?.some(proc => proc.construction && matches(proc.construction)))
      throw new Error('Construction is referenced by a procedure: ' + id)
    this.constructions = Object.freeze((this.constructions ?? []).filter(item => item !== target)) as unknown as RawKnot['constructions']
    return true
  }
  getResource(id: string, kind?: ResourceEntry['kind']): PreparedResource | undefined {
    let uri = id
    if (!id.startsWith('https://') && !id.startsWith('http://') && !id.startsWith('urn:')) {
      try { uri = expandURI(id, this.namespaces) } catch { /* unresolved external reference */ }
    }
    return kind ? typedContexts.get(this)?.get(resourceIdentity(kind, uri)) : contexts.get(this)?.get(uri)
  }
  /** Add an inline definition without modifying an attached registry. */
  addResourceDefinition(kind: 'catalogs' | 'representationTypes' | 'objectTypes', definition: NonNullable<RawKnot['catalogs']>[number] | NonNullable<RawKnot['representationTypes']>[number] | NonNullable<RawKnot['objectTypes']>[number]): PreparedResource {
    const collection = (this[kind] ?? []) as { id: string }[]
    const value = structuredClone(definition)
    const uri = expandURI(value.id, this.namespaces)
    if (collection.some(item => expandURI(item.id, this.namespaces) === uri)) throw new Error('Duplicate resource URI: ' + uri)
    const resourceKind = { catalogs: 'catalog', representationTypes: 'representation-type', objectTypes: 'object-type' }[kind] as ResourceEntry['kind']
    const previous = this.getResource(uri, resourceKind)
    const view = resource(value, this, uri)
    if (previous && !('names' in value)) Object.defineProperty(view, 'names', { get: () => (previous as any).names, enumerable: false })
    if (previous && !('descriptions' in value)) Object.defineProperty(view, 'descriptions', { get: () => (previous as any).descriptions, enumerable: false })
    ;(this as any)[kind] = Object.freeze([...collection, value])
    contexts.get(this)?.set(uri, view)
    typedContexts.get(this)?.set(resourceIdentity(resourceKind, uri), view)
    return view
  }
  /** Remove an inline definition, restoring the next applicable resource layer. */
  removeResourceDefinition(kind: 'catalogs' | 'representationTypes' | 'objectTypes', id: string): boolean {
    const collection = (this[kind] ?? []) as { id: string }[]
    const uri = expandURI(id, this.namespaces)
    const target = collection.find(item => expandURI(item.id, this.namespaces) === uri)
    if (!target) return false
    const remaining = collection.filter(item => item !== target)
    // A resource URI cannot fall back to a definition of another resource kind.
    const fallbackInline = remaining.find(item => expandURI(item.id, this.namespaces) === uri)
    const resourceKind = { catalogs: 'catalog', representationTypes: 'representation-type', objectTypes: 'object-type' }[kind]
    const fallbackRegistry = [STANDARD_RESOURCES, ...(registries.get(this) ?? [])]
      .flatMap(registry => registry.resources.map(entry => ({ entry, registry })))
      .reverse().find(({ entry, registry }) => entry.kind === resourceKind &&
        expandURI(entry.resource.id, registry.namespaces) === uri)
    // Reject removal of the last definition while it is still referenced.
    if (!fallbackInline && !fallbackRegistry) {
      if (kind === 'representationTypes' && this.representations?.some(rep => expandURI(rep.type, this.namespaces) === uri))
        throw new Error('Resource is referenced by a representation: ' + id)
      if (kind === 'catalogs' && this.subject.identifiers?.some(identifier => expandURI(identifier.catalog, this.namespaces) === uri))
        throw new Error('Resource is referenced by a subject identifier: ' + id)
      if (kind === 'objectTypes' && this.constructions?.some(construction =>
        'objects' in construction && construction.objects.some(object => expandURI(object.type, this.namespaces) === uri)))
        throw new Error('Resource is referenced by a construction object: ' + id)
    }
    ;(this as any)[kind] = Object.freeze(remaining)
    const fallback = fallbackInline ?? fallbackRegistry?.entry.resource
    if (fallback) {
      const view = resource(fallback, this, uri)
      if (fallbackInline && fallbackRegistry) {
        const registryView = resource(fallbackRegistry.entry.resource, this, uri)
        if (!('names' in fallback)) Object.defineProperty(view, 'names', { get: () => (registryView as any).names, enumerable: false })
        if (!('descriptions' in fallback)) Object.defineProperty(view, 'descriptions', { get: () => (registryView as any).descriptions, enumerable: false })
      }
      contexts.get(this)?.set(uri, view)
      typedContexts.get(this)?.set(resourceIdentity(resourceKind, uri), view)
    } else {
      typedContexts.get(this)?.delete(resourceIdentity(resourceKind, uri))
      const alternative = [...(typedContexts.get(this)?.entries() ?? [])].reverse().find(([key]) => key.endsWith(':' + uri))?.[1]
      if (alternative) contexts.get(this)?.set(uri, alternative)
      else contexts.get(this)?.delete(uri)
    }
    return true
  }
  addRepresentation(input: RawRepresentation): Representation {
    if (this.getRepresentation(input.id)) throw new Error('Duplicate representation ID: ' + input.id)
    const value = structuredClone(input) as Representation
    decorate(value)
    Object.setPrototypeOf(value, Representation.prototype)
    owner.set(value, this)
    this.representations = Object.freeze([...(this.representations ?? []), value]) as unknown as Representation[]
    return value
  }
  removeRepresentation(id: string): boolean {
    if (!this.getRepresentation(id)) return false
    if (this.procedures?.some(procedure => procedure.steps.some(step =>
      step.representations?.some(ref => ref.id === id))))
      throw new Error('Representation is referenced by a procedure step: ' + id)
    this.representations = Object.freeze((this.representations ?? []).filter(x => x.id !== id)) as unknown as Representation[]
    return true
  }
  toRaw(): RawKnot { return JSON.parse(JSON.stringify(this)) as RawKnot }
  clone(): Knot { return prepareKnot(this.toRaw(), registries.get(this), localizations.get(this)) }
  select(selection: { representations?: string[]; procedures?: string[] }): Knot {
    const attached = registries.get(this) ?? []
    return Knot.from(selectKnot(this.toRaw(), selection, { registries: attached }), { registries: attached, ...localizations.get(this) })
  }
}
export function prepareKnot(raw: RawKnot, attached: readonly RawResourceRegistry[] = [], localization: LocalizedConfig = {}): Knot {
  if (raw instanceof Knot) return raw
  const knot = structuredClone(raw) as unknown as Knot
  Object.setPrototypeOf(knot, Knot.prototype)
  registries.set(knot, attached)
  localizations.set(knot, localization)
  decorate(knot.subject)
  textOwner.set(knot.subject, knot)
  Object.setPrototypeOf(knot.subject, Subject.prototype)
  for (const representation of knot.representations ?? []) {
    decorate(representation)
    Object.setPrototypeOf(representation, Representation.prototype)
    owner.set(representation, knot)
  }
  if (knot.representations) knot.representations = Object.freeze(knot.representations) as unknown as Representation[]
  for (const procedure of knot.procedures ?? []) {
    textOwner.set(procedure, knot)
    decorate(procedure)
    Object.setPrototypeOf(procedure, Procedure.prototype)
    for (const step of procedure.steps) {
      textOwner.set(step, knot)
      decorate(step)
      Object.setPrototypeOf(step, Step.prototype)
    }
    procedure.steps = Object.freeze(procedure.steps) as unknown as Step[]
  }
  if (knot.procedures) knot.procedures = Object.freeze(knot.procedures) as unknown as Procedure[]
  if (knot.constructions) knot.constructions = Object.freeze(knot.constructions) as unknown as RawKnot['constructions']
  for (const key of ['catalogs', 'representationTypes', 'objectTypes'] as const) {
    if (knot[key]) (knot as any)[key] = Object.freeze(knot[key])
  }
  const index = new Map<string, PreparedResource>()
  const typedIndex = new Map<string, PreparedResource>()
  for (const registry of [STANDARD_RESOURCES, ...attached]) {
    for (const entry of registry.resources) {
      const item = entry.resource
      const id = item.id.startsWith('https://') || item.id.startsWith('http://') || item.id.startsWith('urn:') ? item.id : expandURI(item.id, registry.namespaces)
      const defaults = index.get(id) as any
      const view = resource(item, knot, id)
      if (defaults && !('names' in item)) Object.defineProperty(view, 'names', { get: () => defaults.names, enumerable: false })
      if (defaults && !('descriptions' in item)) Object.defineProperty(view, 'descriptions', { get: () => defaults.descriptions, enumerable: false })
      index.set(id, view)
      typedIndex.set(resourceIdentity(entry.kind, id), view)
    }
  }
  for (const key of ['catalogs', 'representationTypes', 'objectTypes'] as const) {
    for (const item of (knot[key] ?? []) as { id: string }[]) {
      const id = item.id.startsWith('https://') || item.id.startsWith('http://') || item.id.startsWith('urn:') ? item.id : expandURI(item.id, knot.namespaces)
      const resourceKind = { catalogs: 'catalog', representationTypes: 'representation-type', objectTypes: 'object-type' }[key] as ResourceEntry['kind']
      const defaults = typedIndex.get(resourceIdentity(resourceKind, id)) as any
      const view = resource(item, knot, id)
      if (defaults && !('names' in item)) Object.defineProperty(view, 'names', { get: () => defaults.names, enumerable: false })
      if (defaults && !('descriptions' in item)) Object.defineProperty(view, 'descriptions', { get: () => defaults.descriptions, enumerable: false })
      index.set(id, view)
      typedIndex.set(resourceIdentity(resourceKind, id), view)
    }
  }
  contexts.set(knot, index)
  typedContexts.set(knot, typedIndex)
  return knot
}
