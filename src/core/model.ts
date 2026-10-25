import type { RawAsset, RawRepresentation, RawProcedure, RawStep, RawSubject, RawKnotResourceRegistry, ResourceEntry } from './asset'
import { STANDARD_RESOURCES, expandURI } from './resources'
import { validateAsset } from './validateAsset'
import { selectAsset, composeAsset } from './assetParts'

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
const owner = new WeakMap<object, Asset>()
const contexts = new WeakMap<Asset, Map<string, PreparedResource>>()
const registries = new WeakMap<Asset, readonly RawKnotResourceRegistry[]>()
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
export class Asset implements RawAsset {
  schema!: 'Asset'
  schemaVersion!: 1
  id!: string
  subject!: Subject
  representations?: Representation[]
  procedures?: Procedure[]
  namespaces?: RawAsset['namespaces']
  catalogs?: RawAsset['catalogs']
  representationTypes?: RawAsset['representationTypes']
  objectTypes?: RawAsset['objectTypes']
  static from(input: RawAsset | Asset, options: { registries?: readonly RawKnotResourceRegistry[] } = {}): Asset {
    if (input instanceof Asset) return input
    const result = validateAsset(input, options)
    if (!result.valid) throw new Error('Invalid Asset: ' + result.issues.map(x => x.message).join('; '))
    return prepareAsset(result.asset, options.registries)
  }
  static compose(parts: readonly (RawAsset | Asset)[], options: { registries?: readonly RawKnotResourceRegistry[] } = {}): Asset {
    return Asset.from(composeAsset(parts.map(x => x instanceof Asset ? x.toRaw() : x), options), options)
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
  toRaw(): RawAsset { return JSON.parse(JSON.stringify(this)) as RawAsset }
  clone(): Asset { return prepareAsset(this.toRaw(), registries.get(this)) }
  select(selection: { representations?: string[]; procedures?: string[] }): Asset {
    const attached = registries.get(this) ?? []
    return Asset.from(selectAsset(this.toRaw(), selection, { registries: attached }), { registries: attached })
  }
}
export function prepareAsset(raw: RawAsset, attached: readonly RawKnotResourceRegistry[] = []): Asset {
  if (raw instanceof Asset) return raw
  const asset = structuredClone(raw) as unknown as Asset
  Object.setPrototypeOf(asset, Asset.prototype)
  registries.set(asset, attached)
  decorate(asset.subject)
  Object.setPrototypeOf(asset.subject, Subject.prototype)
  for (const representation of asset.representations ?? []) {
    decorate(representation)
    Object.setPrototypeOf(representation, Representation.prototype)
    owner.set(representation, asset)
  }
  if (asset.representations) asset.representations = Object.freeze(asset.representations) as unknown as Representation[]
  for (const procedure of asset.procedures ?? []) {
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
      index.set(id, resource(item))
    }
  }
  for (const key of ['catalogs', 'representationTypes', 'objectTypes'] as const) {
    for (const item of (asset[key] ?? []) as { id: string }[]) {
      const id = item.id.startsWith('https://') || item.id.startsWith('http://') || item.id.startsWith('urn:') ? item.id : expandURI(item.id, asset.namespaces)
      index.set(id, resource(item))
    }
  }
  contexts.set(asset, index)
  return asset
}
