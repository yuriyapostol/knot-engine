import { Knot } from './model'
import { validateGeometry2D, validateGeometry3D, applyStepData } from './validateGeometry'
import { contributionIssues, licenseIssues, sourceIssues } from './metadata'
import Ajv2020 from 'ajv/dist/2020.js'
import { GEOMETRY_2D, GEOMETRY_3D, type Geometry2DData, type Geometry3DData, SPATIAL_CURVE, GRID_DIAGRAM, MOSAIC_DIAGRAM, PD_CODE, DT_CODE, ROPE_TYPE, type RawKnot, type RawResourceRegistry, type Reference, type Construction, type ResourceEntry, type RawRepresentation, type RawRepresentationTypeDefinition, type Dependency, type SpatialCurveData, type RawRepresentationDocument } from './knot'
import { createResourceIndex, expandURI, normalizeResource, addResource, namespaceIssues, resourceIssues, type ResourceIndex } from './resources'
import { duplicates, issue, preflight, structure, KNOT_LIMITS } from './validation'
import { validateMosaicDiagram } from './validateMosaicDiagram'
import { validateDTCode, dtAnalysisWork } from './validateDTCode'
import { validatePDCode } from './validatePDCode'
import { validateGridDiagram } from './validateGridDiagram'
import { validateSpatialCurve } from './validateSpatial'
import type { ValidationIssue } from './errors'
export interface ValidationOptions { strict?: boolean; registries?: readonly RawResourceRegistry[]; schemas?: readonly Record<string, unknown>[] }
export interface ValidationReport { missingDependencies: Dependency[]; uncheckedTypes: string[]; complete: boolean; warnings: string[] }
export type KnotValidationResult = ({ valid: true; knot: RawKnot } & ValidationReport) | { valid: false; issues: ValidationIssue[] }
export function normalizeKnot(knot: RawKnot): RawKnot {
  const a = structuredClone(knot), ns = a.namespaces ?? {}
  const uri = (v: string) => expandURI(v, ns)
  // Local document/subject IDs remain permitted; cross-document references require URI identities.
  if (a.id.includes(':')) a.id = uri(a.id)
  if (a.subject.id.includes(':')) a.subject.id = uri(a.subject.id)
  for (const ident of a.subject.identifiers ?? []) ident.catalog = uri(ident.catalog)
  for (const d of a.dependencies ?? []) d.ref = uri(d.ref)
  const reference = (r: Reference) => { if (r.ref) r.ref = uri(r.ref); else if (r.id?.includes(':')) r.id = uri(r.id) }
  for (const key of ['catalogs','representationTypes','objectTypes'] as const) {
    const kind = { catalogs: 'catalog', representationTypes: 'representation-type', objectTypes: 'object-type' }[key]
    Object.assign(a, a[key] ? { [key]: a[key]!.map(resource => normalizeResource({ kind, resource } as ResourceEntry,ns).resource) } : {})
  }
  if (a.constructions) a.constructions = a.constructions.map(c => 'ref' in c ? { ref: uri(c.ref) } : normalizeResource({ kind: 'construction', resource: c },ns).resource as Construction)
  for (const source of a.sources ?? []) if (source.id.includes(':')) source.id = uri(source.id)
  for (const rep of a.representations ?? []) {
    for (const source of rep.sources ?? []) {
      if ('ref' in source && source.ref) source.ref = uri(source.ref)
      else if ('id' in source && source.id?.includes(':')) source.id = uri(source.id)
    }
    rep.type = uri(rep.type)
    // Expand only URI fields belonging to supported data contracts, never arbitrary data.
    if (rep.data && typeof rep.data === 'object' && !Array.isArray(rep.data)) {
      const data = rep.data as Record<string, unknown>
      const key = rep.type === DT_CODE || rep.type === PD_CODE ? 'convention' : rep.type === MOSAIC_DIAGRAM ? 'tileSet' : undefined
      if (key && typeof data[key] === 'string') data[key] = uri(data[key])
    }
    if (rep.target && rep.target.kind !== 'subject') reference(rep.target.construction)
  }
  for (const proc of a.procedures ?? []) {
    if (proc.construction) reference(proc.construction)
    if (proc.base) reference(proc.base)
    for (const step of proc.steps) for (const r of step.representations ?? []) reference(r)
  }
  delete a.namespaces
  return a
}
export function indexKnot(knot: RawKnot, registries: readonly RawResourceRegistry[] = []): ResourceIndex {
  const index = createResourceIndex(registries)
  for (const source of knot.sources ?? []) if (source.id.includes(':')) addResource(index,{kind:'source',resource:source})
  for (const c of knot.catalogs ?? []) addResource(index,{ kind:'catalog',resource:c })
  for (const r of knot.representationTypes ?? []) addResource(index,{ kind:'representation-type',resource:r })
  for (const o of knot.objectTypes ?? []) addResource(index,{ kind:'object-type',resource:o })
  for (const c of knot.constructions ?? []) if (!('ref' in c) && c.id.includes(':')) addResource(index,{ kind:'construction',resource:c })
  return index
}
export function constructionFor(knot: RawKnot, index: ResourceIndex, ref: Reference): Construction | undefined {
  if (ref.ref) { const e = index.get(ref.ref); return e?.kind === 'construction' ? e.resource : undefined }
  return knot.constructions?.find((c): c is Construction => !('ref' in c) && c.id === ref.id)
}
export function validateKnot(value: unknown, options: ValidationOptions = {}): KnotValidationResult {
  if (value instanceof Knot) value = value.toRaw()
  let issues = preflight(value)
  if (!issues.length) issues = structure('knot',value)
  if (issues.length) return { valid: false, issues }
  const original = value as RawKnot
  issues.push(...namespaceIssues(original.namespaces))
  let knot: RawKnot, index: ResourceIndex
  try { knot = normalizeKnot(original); index = indexKnot(knot,options.registries) } catch(e) { return { valid:false,issues:[...issues,issue('',(e as Error).message)] } }
  if (knot.$schema && knot.$schema !== 'https://yuriyapostol.github.io/knot-engine/v1/schema/knot.schema.json') issues.push(issue('$schema','Schema URI contradicts document contract'))
  const missing = new Map<string,Dependency>(), unchecked = new Set<string>()
  const need = (kind: Dependency['kind'], ref: string, path: string): ResourceEntry | undefined => {
    const found = index.get(ref)
    if (!found) { missing.set(`${kind}:${ref}`,{kind,ref}); return }
    if (found.kind !== kind) { issues.push(issue(path,`Expected ${kind} resource`)); return }
    return found
  }
  for (const entry of index.values()) issues.push(...resourceIssues(entry).map(e => ({...e,path:`resources[${entry.resource.id}].${e.path}`})))
  issues.push(...contributionIssues(knot.contributions,'contributions'), ...licenseIssues(knot.license,'license'))
  issues.push(...duplicates(knot.sources ?? [],'sources'))
  for (const source of knot.sources ?? []) issues.push(...sourceIssues(source,`sources.${source.id}`))
  for (const dep of knot.dependencies ?? []) need(dep.kind,dep.ref,'dependencies')
  const checkConstruction = (ref: Reference, path: string) => {
    if (ref.ref) need('construction',ref.ref,path)
    const c = constructionFor(knot,index,ref)
    if (!c && !ref.ref) issues.push(issue(path,'Unknown local construction'))
    return c
  }
  for (const key of ['catalogs','representationTypes','objectTypes','representations','procedures'] as const) issues.push(...duplicates(knot[key] ?? [],key))
  const locals = (knot.constructions ?? []).filter((c):c is Construction => !('ref' in c))
  issues.push(...duplicates(locals,'constructions'))
  const constructions = new Map<string,Construction>(locals.map(c => [c.id,c]))
  for (const c of knot.constructions ?? []) if ('ref' in c) { const found = checkConstruction(c,'constructions'); if (found) constructions.set(found.id,found) }
  for (const rep of knot.representations ?? []) if (rep.target && rep.target.kind !== 'subject') { const c = checkConstruction(rep.target.construction,`representations.${rep.id}.target`); if(c) constructions.set(c.id,c) }
  for (const proc of knot.procedures ?? []) if (proc.construction) { const c = checkConstruction(proc.construction,`procedures.${proc.id}.construction`); if(c) constructions.set(c.id,c) }
  const checkData = (type: string, data: unknown, entry: ResourceEntry | undefined, path: string) => {
    if (type === GEOMETRY_2D || type === GEOMETRY_3D) { const r = type === GEOMETRY_2D ? validateGeometry2D(data) : validateGeometry3D(data); if (!r.valid) issues.push(...r.issues.map(e => ({...e,path: `${path}.${e.path}`}))); return }
    if (type === SPATIAL_CURVE) { const r = validateSpatialCurve(data); if(!r.valid) issues.push(...r.issues.map(e=>({...e,path:`${path}.${e.path}`}))); return }
    if (type === MOSAIC_DIAGRAM) { const r = validateMosaicDiagram(data); if(!r.valid) issues.push(...r.issues.map(e=>({...e,path:`${path}.${e.path}`}))); return }
    if (type === DT_CODE) { const r = validateDTCode(data); if(!r.valid) issues.push(...r.issues.map(e=>({...e,path:`${path}.${e.path}`}))); return }
    if (type === PD_CODE) { const r = validatePDCode(data); if(!r.valid) issues.push(...r.issues.map(e=>({...e,path:`${path}.${e.path}`}))); return }
    if (type === GRID_DIAGRAM) { const r = validateGridDiagram(data); if(!r.valid) issues.push(...r.issues.map(e=>({...e,path:`${path}.${e.path}`}))); return }
    if (!entry || (entry.kind !== 'representation-type' && entry.kind !== 'object-type')) { unchecked.add(type); return }
    unchecked.add(type) // JSON Schema cannot establish the type's domain semantics.
    const schema = entry.resource.dataSchema
    try {
      const validator = new Ajv2020({strict:false,allErrors:false,validateFormats:false})
      for (const s of options.schemas ?? []) validator.addSchema(s)
      if (schema.ref && !validator.getSchema(schema.ref)) return
      const check = schema.inline ? validator.compile(schema.inline) : validator.getSchema(schema.ref!)!
      if (!check(data)) issues.push(issue(path,`Data does not match ${type}: ${validator.errorsText(check.errors)}`))
    } catch(e) { if (!(e && typeof e === 'object' && 'missingRef' in e)) issues.push(issue(path,`Cannot validate declared schema: ${(e as Error).message}`)) }
  }
  for (const c of constructions.values()) {
    issues.push(...resourceIssues({kind:'construction',resource:c}).map(e=>({...e,path:`constructions.${c.id}.${e.path}`})))
    for(const object of c.objects) {
      const entry = need('object-type',object.type,`constructions.${c.id}.objects.${object.id}.type`)
      if (object.type !== ROPE_TYPE && !['support','carabiner'].some(n => object.type === `https://yuriyapostol.github.io/knot-engine/v1/object-types/${n}`)) checkData(object.type,object,entry,`constructions.${c.id}.objects.${object.id}`)
      else if (object.type !== ROPE_TYPE && Object.keys(object).some(k=>!['id','type'].includes(k))) issues.push(issue(`constructions.${c.id}.objects.${object.id}`,'Equipment profile supports id and type only'))
    }
  }
  for (const ident of knot.subject.identifiers ?? []) {
    const entry = need('catalog',ident.catalog,'subject.identifiers')
    if (entry?.kind === 'catalog' && entry.resource.identifierRules?.pattern) {
      try { if (!new RegExp(entry.resource.identifierRules.pattern).test(ident.value)) issues.push(issue('subject.identifiers','Identifier does not match catalog pattern')) } catch { /* Reported in resource validation. */ }
    }
  }
  const totalMosaicCells = (knot.representations ?? []).filter(r => r.type === MOSAIC_DIAGRAM).reduce((sum, r) => {
    const rows = (r.data as { tiles?: unknown })?.tiles
    return sum + (Array.isArray(rows) ? rows.reduce((n, row) => n + (Array.isArray(row) ? row.length : 0), 0) : 0)
  }, 0)
  if (totalMosaicCells > 65536) return { valid: false, issues: [issue('representations', 'Total mosaic cell budget exceeded', 'LIMIT_EXCEEDED')] }
  const totalPDCrossings = (knot.representations ?? []).filter(r => r.type === PD_CODE).reduce((sum, r) => {
    const crossings = (r.data as { crossings?: unknown })?.crossings
    return sum + (Array.isArray(crossings) ? crossings.length : 0)
  }, 0)
  if (totalPDCrossings > 16384) return { valid: false, issues: [issue('representations', 'Total PD crossing budget exceeded', 'LIMIT_EXCEEDED')] }
  const totalDTWork = (knot.representations ?? []).filter(r => r.type === DT_CODE).reduce((sum, r) => {
    const code = (r.data as { code?: unknown })?.code
    return sum + dtAnalysisWork(code)
  }, 0)
  if (totalDTWork > KNOT_LIMITS.dtWork) return { valid: false, issues: [issue('representations', 'Total DT analysis budget exceeded', 'LIMIT_EXCEEDED')] }
  let totalPoints = 0
  for (const rep of knot.representations ?? []) {
    const path = `representations.${rep.id}`, entry = need('representation-type',rep.type,`${path}.type`)
    issues.push(...contributionIssues(rep.contributions,`${path}.contributions`))
    for (const [i, source] of (rep.sources ?? []).entries()) {
      const sourcePath = `${path}.sources.${i}`
      issues.push(...sourceIssues(source,sourcePath))
      if ('ref' in source && source.ref) need('source',source.ref,sourcePath)
      else if ('id' in source && source.id && !knot.sources?.some(s=>s.id === source.id)) issues.push(issue(sourcePath,'Unknown local source'))
    }
    const definition = entry?.resource as RawRepresentationTypeDefinition | undefined
    checkData(rep.type,rep.data,entry,`${path}.data`)
    let construction: Construction | undefined
    if(rep.target && rep.target.kind !== 'subject') {
      construction = checkConstruction(rep.target.construction,`${path}.target`)
      if(construction && 'id' in rep.target) {
        const items = rep.target.kind === 'state' ? construction.states : construction.objects
        if(!items?.some(v=>v.id === (rep.target as {id:string}).id)) issues.push(issue(`${path}.target.id`,'Unknown target in construction'))
      }
    }
    if ((rep.type === GEOMETRY_2D && validateGeometry2D(rep.data).valid) || (rep.type === GEOMETRY_3D && validateGeometry3D(rep.data).valid)) {
      const data = rep.data as Geometry2DData | Geometry3DData
      for (const element of data.elements) {
        totalPoints += element.type === 'curve' ? element.points.length : element.vertices.length
        if (element.object && (!rep.target || rep.target.kind === 'subject')) issues.push(issue(`${path}.data.elements.${element.id}.object`, 'Object reference requires construction context'))
        else if (element.object && construction && !construction.objects.some(o => o.id === element.object)) issues.push(issue(`${path}.data.elements.${element.id}.object`, 'Unknown construction object'))
      }
    }
    if(rep.type === SPATIAL_CURVE && validateSpatialCurve(rep.data).valid) {
      for(const curve of (rep.data as SpatialCurveData).curves) {
        totalPoints += curve.points.length
        if(curve.object && (!rep.target || rep.target.kind === 'subject')) issues.push(issue(`${path}.data.curves.${curve.id}.object`,'Object reference requires construction context'))
        else if(curve.object && construction && !construction.objects.some(o=>o.id === curve.object)) issues.push(issue(`${path}.data.curves.${curve.id}.object`,'Unknown construction object'))
      }
    }
  }
  if(totalPoints > 65536) issues.push(issue('representations','Total point budget exceeded','LIMIT_EXCEEDED'))
  for(const proc of knot.procedures ?? []) {
    const base = proc.base && !proc.base.ref ? knot.representations?.find(r => r.id === proc.base?.id) : undefined
    if (proc.base && !base) issues.push(issue(`procedures.${proc.id}.base`, 'Unknown or external base representation'))
    if (base && base.type !== GEOMETRY_2D && base.type !== GEOMETRY_3D) issues.push(issue(`procedures.${proc.id}.base`, 'Base must be 2D or 3D'))
    for (const step of proc.steps) {
      if (!step.data) continue
      if (!base) { issues.push(issue(`procedures.${proc.id}.steps.${step.id}.data`, 'Step data requires a local base representation')); continue }
      if (base.type === GEOMETRY_2D || base.type === GEOMETRY_3D) {
        const result = applyStepData(base.data as Geometry2DData | Geometry3DData, step.data, base.type)
        if (!result.valid) issues.push(...result.issues.map(e => ({ ...e, path: `procedures.${proc.id}.steps.${step.id}.data.${e.path}` })))
      }
    }
    issues.push(...duplicates(proc.steps,`procedures.${proc.id}.steps`))
    for(const step of proc.steps) for(const r of step.representations ?? []) {
      if(r.ref) issues.push(issue(`procedures.${proc.id}.steps.${step.id}`,'External representation references are outside the initial profile'))
      else if(!knot.representations?.some(v=>v.id === r.id)) issues.push(issue(`procedures.${proc.id}.steps.${step.id}`,'Unknown representation'))
    }
  }
  if(issues.length) return {valid:false,issues}
  const missingDependencies = [...missing.values()], uncheckedTypes = [...unchecked]
  return {valid:true,knot:original,missingDependencies,uncheckedTypes,complete:!missing.size && !unchecked.size,warnings:[]}
}
export function validateRepresentationDocument(value: unknown, options: ValidationOptions = {}) {
  let issues = preflight(value)
  if(!issues.length) issues = structure('representationDocument',value)
  if(issues.length) return {valid:false as const,issues}
  const doc = value as RawRepresentationDocument
  if (doc.$schema && doc.$schema !== 'https://yuriyapostol.github.io/knot-engine/v1/schema/knot-representation.schema.json') return { valid: false as const, issues: [issue('$schema','Schema URI contradicts document contract')] }
  const result = validateKnot({schema:'Knot',schemaVersion:1,id:'standalone',subject:doc.subject ?? {id:'standalone'},...(doc.namespaces ? {namespaces:doc.namespaces}:{}),...(doc.dependencies ? {dependencies:doc.dependencies}:{}),...(doc.sources ? {sources:doc.sources}:{}),representations:[doc.representation]},options)
  return result.valid ? {...result,document:doc} : result
}
