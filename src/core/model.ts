import type { RawKnot, RawRepresentation, RawProcedure, RawStep, RawSubject, RawResourceRegistry, ResourceEntry } from './knot'
import { STANDARD_RESOURCES, expandURI } from './resources'
import { validateKnot } from './validateKnot'
import { selectKnot, composeKnot } from './knotParts'

export type RawLocalizedTexts = { language: string; value: string }[]
export type PreparedResource = ResourceEntry['resource'] & { getName(locale?: string): string | undefined; getDescription(locale?: string): string | undefined }
type LocalizedConfig = { locale?: string; fallbackLocale?: string; overrides?: Record<string, { names?: RawLocalizedTexts; descriptions?: RawLocalizedTexts }> }
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
  getName(this: any, language = config.locale): string | undefined {
    const override = config.overrides[this.id]?.names
    return override?.find(x => x.language === language)?.value ?? this.names?.get(language) ?? this.name
  },
  getDescription(this: any, language = config.locale): string | undefined {
    const override = config.overrides[this.id]?.descriptions
    return override?.find(x => x.language === language)?.value ?? this.descriptions?.get(language) ?? this.description
  },
}
function resource<T extends object>(input: T): T & PreparedResource {
  decorate(input)
  Object.setPrototypeOf(input, resourceMethods)
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
  getName(language = config.locale): string | undefined {
    const def = this.getTypeDefinition() as any
    return this.names?.getExact(language) ?? def?.names?.getExact(language) ?? this.names?.get(language) ?? def?.getName(language)
  }
  getDescription(language = config.locale): string | undefined {
    const def = this.getTypeDefinition() as any
    return this.descriptions?.getExact(language) ?? def?.descriptions?.getExact(language) ?? this.descriptions?.get(language) ?? def?.getDescription(language)
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
  static from(input: RawKnot | Knot, options: { registries?: readonly RawResourceRegistry[] } = {}): Knot {
    if (input instanceof Knot) return input
    return prepareKnot(input, options.registries)
  }
  static validate(input: unknown, options: { registries?: readonly RawResourceRegistry[] } = {}) { return validateKnot(input, options) }
  validate(options: { registries?: readonly RawResourceRegistry[] } = {}) { return validateKnot(this.toRaw(), { registries: options.registries ?? registries.get(this) }) }
  static compose(parts: readonly (RawKnot | Knot)[], options: { registries?: readonly RawResourceRegistry[] } = {}): Knot {
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
  clone(): Knot { return prepareKnot(this.toRaw(), registries.get(this)) }
  select(selection: { representations?: string[]; procedures?: string[] }): Knot {
    const attached = registries.get(this) ?? []
    return Knot.from(selectKnot(this.toRaw(), selection, { registries: attached }), { registries: attached })
  }
}
export function prepareKnot(raw: RawKnot, attached: readonly RawResourceRegistry[] = []): Knot {
  if (raw instanceof Knot) return raw
  const knot = structuredClone(raw) as unknown as Knot
  Object.setPrototypeOf(knot, Knot.prototype)
  registries.set(knot, attached)
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
      index.set(id, resource(enhanced))
    }
  }
  for (const key of ['catalogs', 'representationTypes', 'objectTypes'] as const) {
    for (const item of (knot[key] ?? []) as { id: string }[]) {
      const id = item.id.startsWith('https://') || item.id.startsWith('http://') || item.id.startsWith('urn:') ? item.id : expandURI(item.id, knot.namespaces)
      const defaults = index.get(id) as any
      const enhanced = { ...item, ...(defaults?.names && !('names' in item) ? { names: defaults.names } : {}), ...(defaults?.descriptions && !('descriptions' in item) ? { descriptions: defaults.descriptions } : {}) }
      index.set(id, resource(enhanced))
    }
  }
  contexts.set(knot, index)
  return knot
}
