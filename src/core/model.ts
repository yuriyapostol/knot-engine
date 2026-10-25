import type { RawKnot, RawRepresentation, RawProcedure, RawStep, RawSubject, RawResourceRegistry, ResourceEntry } from './knot'
import { STANDARD_RESOURCES, expandURI } from './resources'
import { validateKnot } from './validateKnot'
import { selectKnot, composeKnot } from './knotParts'

export type RawLocalizedTexts = { language: string; value: string }[]
export type PreparedResource = ResourceEntry['resource'] & { getName(locale?: string): string | undefined; getDescription(locale?: string): string | undefined }
export type LocalizedConfig = { locale?: string; fallbackLocale?: string; overrides?: Record<string, { names?: RawLocalizedTexts; descriptions?: RawLocalizedTexts }> }
let config: Required<LocalizedConfig> = { locale: 'en', fallbackLocale: 'en', overrides: {} }
export function configureLocalization(options: LocalizedConfig): void { config = { ...config, ...options } }
export class LocalizedTexts extends Array<{ language: string; value: string }> {
  getExact(language = config.locale): string | undefined {
    return this.find(x => x.language === language)?.value ?? this.find(x => x.language === language.split('-')[0])?.value
  }
  get(language = config.locale): string | undefined {
    return this.getExact(language) ?? this.getExact(config.fallbackLocale) ?? this.getExact('en')
  }
}
const owner = new WeakMap<object, Knot>()
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
const registries = new WeakMap<Knot, readonly RawResourceRegistry[]>()
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
  decorate(input)
  Object.setPrototypeOf(input, resourceMethods)
  resourceOwner.set(input, knot)
  resourceKey.set(input, id)
  return input as T & PreparedResource
}
export class Subject implements RawSubject {
  id!: string
  names?: LocalizedTexts
  descriptions?: LocalizedTexts
  identifiers?: RawSubject['identifiers']
  getName(language?: string): string | undefined { return this.names?.get(language) }
  getDescription(language?: string): string | undefined { return this.descriptions?.get(language) }
}
export class Representation implements RawRepresentation {
  id!: string
  type!: string
  data!: unknown
  names?: LocalizedTexts
  descriptions?: LocalizedTexts
  getTypeDefinition(): PreparedResource | undefined { return owner.get(this)?.getResource(this.type) }
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
  names?: LocalizedTexts
  instructions?: LocalizedTexts
  getName(language?: string): string | undefined { return this.names?.get(language) }
  getInstructions(language?: string): string | undefined { return this.instructions?.get(language) }
}
export class Procedure implements RawProcedure {
  id!: string
  steps!: Step[]
  names?: LocalizedTexts
  descriptions?: LocalizedTexts
  getName(language?: string): string | undefined { return this.names?.get(language) }
  getDescription(language?: string): string | undefined { return this.descriptions?.get(language) }
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
  getResource(id: string): PreparedResource | undefined {
    let uri = id
    if (!id.startsWith('https://') && !id.startsWith('http://') && !id.startsWith('urn:')) {
      try { uri = expandURI(id, this.namespaces) } catch { /* unresolved external reference */ }
    }
    return contexts.get(this)?.get(uri)
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
  Object.setPrototypeOf(knot.subject, Subject.prototype)
  for (const representation of knot.representations ?? []) {
    decorate(representation)
    Object.setPrototypeOf(representation, Representation.prototype)
    owner.set(representation, knot)
  }
  if (knot.representations) knot.representations = Object.freeze(knot.representations) as unknown as Representation[]
  for (const procedure of knot.procedures ?? []) {
    decorate(procedure)
    Object.setPrototypeOf(procedure, Procedure.prototype)
    for (const step of procedure.steps) {
      decorate(step)
      Object.setPrototypeOf(step, Step.prototype)
    }
  }
  const index = new Map<string, PreparedResource>()
  for (const registry of [STANDARD_RESOURCES, ...attached]) {
    for (const entry of registry.resources) {
      const item = structuredClone(entry.resource)
      const id = item.id.startsWith('https://') || item.id.startsWith('http://') || item.id.startsWith('urn:') ? item.id : expandURI(item.id, registry.namespaces)
      const defaults = index.get(id) as any
      const enhanced = { ...item, ...(defaults?.names && !('names' in item) ? { names: defaults.names } : {}), ...(defaults?.descriptions && !('descriptions' in item) ? { descriptions: defaults.descriptions } : {}) }
      index.set(id, resource(enhanced, knot, id))
    }
  }
  for (const key of ['catalogs', 'representationTypes', 'objectTypes'] as const) {
    for (const item of (knot[key] ?? []) as { id: string }[]) {
      const id = item.id.startsWith('https://') || item.id.startsWith('http://') || item.id.startsWith('urn:') ? item.id : expandURI(item.id, knot.namespaces)
      const defaults = index.get(id) as any
      const enhanced = { ...item, ...(defaults?.names && !('names' in item) ? { names: defaults.names } : {}), ...(defaults?.descriptions && !('descriptions' in item) ? { descriptions: defaults.descriptions } : {}) }
      index.set(id, resource(enhanced, knot, id))
    }
  }
  contexts.set(knot, index)
  return knot
}
