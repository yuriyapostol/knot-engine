import { type RawAsset, type Construction, type Reference } from './asset'
import { validateAsset, normalizeAsset, indexAsset, constructionFor, type ValidationOptions } from './validateAsset'
import { canonical } from './validation'
import { ViewerError } from './errors'
function checked(value: unknown, options: ValidationOptions): RawAsset {
  const result = validateAsset(value, options)
  if(!result.valid) throw new ViewerError('INVALID_MODEL','Invalid RawAsset',result.issues,false)
  if(!result.complete) throw new ViewerError('UNSUPPORTED_SCHEMA','Operation requires resolved dependencies and supported semantics',undefined,false)
  return normalizeAsset(result.asset)
}
/** Extracts a self-contained fragment; only explicitly selected procedures and representations. */
export function selectAsset(value: unknown, selection: { representations?: string[]; procedures?: string[] }, options: ValidationOptions = {}): RawAsset {
  const asset = checked(value,options), index = indexAsset(asset,options.registries)
  const reps = new Set(selection.representations ?? []), procs = new Set(selection.procedures ?? [])
  for(const id of procs) if(!asset.procedures?.some(p=>p.id === id)) throw new ViewerError('INVALID_MODEL',`Unknown procedure: ${id}`,undefined,false)
  const procedures = asset.procedures?.filter(p=>procs.has(p.id)) ?? []
  for(const p of procedures) for(const step of p.steps) for(const r of step.representations ?? []) if(r.id) reps.add(r.id)
  for(const id of reps) if(!asset.representations?.some(r=>r.id === id)) throw new ViewerError('INVALID_MODEL',`Unknown representation: ${id}`,undefined,false)
  const representations = asset.representations?.filter(r=>reps.has(r.id)) ?? []
  const constructions = new Map<string,Construction>()
  const includeConstruction = (r: Reference) => { const c=constructionFor(asset,index,r); if(c) constructions.set(c.id,c) }
  for(const r of representations) if(r.target && r.target.kind !== 'subject') includeConstruction(r.target.construction)
  for(const p of procedures) if(p.construction) includeConstruction(p.construction)
  const output: RawAsset = { schema:'Asset',schemaVersion:1,id:asset.id,subject:asset.subject,representations,procedures,constructions:[...constructions.values()] }
  if (asset.contributions) output.contributions = asset.contributions
  if (asset.license) output.license = asset.license
  const included = new Set<string>()
  function include(ref: string) {
    if(included.has(ref)) return
    included.add(ref)
    const entry = index.get(ref)
    if(!entry) throw new ViewerError('INVALID_MODEL',`Unresolved resource: ${ref}`,undefined,false)
    if(entry.kind === 'source' && !output.sources?.some(s=>s.id === entry.resource.id)) (output.sources ??= []).push(entry.resource)
    if(entry.kind === 'catalog') (output.catalogs ??= []).push(entry.resource)
    if(entry.kind === 'representation-type') (output.representationTypes ??= []).push(entry.resource)
    if(entry.kind === 'object-type') (output.objectTypes ??= []).push(entry.resource)
  }
  for(const ident of output.subject.identifiers ?? []) include(ident.catalog)
  for(const c of constructions.values()) for(const o of c.objects) include(o.type)
  for(const rep of representations) {
    include(rep.type)
    for (const source of rep.sources ?? []) {
      if ('ref' in source && source.ref) include(source.ref)
      else if ('id' in source && source.id) {
        const found = asset.sources!.find(s=>s.id === source.id)!
        if (!output.sources?.some(s=>s.id === found.id)) (output.sources ??= []).push(found)
      }
    }
  }
  return structuredClone(checked(output,{}))
}
/** Joins fragments of one document. Order-insensitive object equality; array order is significant. */
export function composeAsset(values: readonly unknown[], options: ValidationOptions = {}): RawAsset {
  if(!values.length) throw new ViewerError('INVALID_MODEL','Expected at least one asset',undefined,false)
  const parts=values.map(v=>checked(v,options)), out=structuredClone(parts[0])
  for(const p of parts.slice(1)) {
    if(p.id !== out.id || canonical(p.subject) !== canonical(out.subject)) throw new ViewerError('INVALID_MODEL','Fragments must have the same document and subject',undefined,false)
    if (p.license && out.license && canonical(p.license) !== canonical(out.license)) throw new ViewerError('INVALID_MODEL','Conflicting license',undefined,false)
    if (p.license) out.license = structuredClone(p.license)
    if (p.contributions) out.contributions = [...new Map([...(out.contributions ?? []),...p.contributions].map(c=>[canonical(c),c])).values()]
    for(const key of ['catalogs','representationTypes','objectTypes','constructions','representations','procedures','dependencies','sources'] as const) {
      const merged=new Map<string,unknown>()
      for(const item of [...(out[key] ?? []),...(p[key] ?? [])]) {
        const id='id' in item ? item.id : item.ref
        if(merged.has(id) && canonical(merged.get(id)) !== canonical(item)) throw new ViewerError('INVALID_MODEL',`Conflicting ${key}: ${id}`,undefined,false)
        merged.set(id,item)
      }
      if(out[key] || p[key]) Object.assign(out,{[key]:[...merged.values()]})
    }
  }
  return structuredClone(checked(out,options))
}
