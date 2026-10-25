import { SPATIAL_CURVE, ROPE_TYPE, type Camera3D, type SpatialCurveData, type SpatialCurve, type Reference, type ViewDefinition, type RawAsset, type RawRepresentation } from './asset'
import { validateAsset, normalizeAsset, indexAsset, constructionFor, type ValidationOptions } from './validateAsset'
import { selectRepresentation } from './selectRepresentation'
import { ViewerError } from './errors'
import { validateView } from './validateSpatial'
export type CameraView = Extract<Camera3D,{mode:'fixed'}>
export interface RenderableCurve extends SpatialCurve { radius: number }
export interface RenderableModel { id?: string; curves: RenderableCurve[]; camera?: Camera3D; warnings: string[] }
export interface RepresentationSelection { representationId?: string; view?: Reference | ViewDefinition }
export function resolveAsset(value: unknown, selection: RepresentationSelection = {}, options: ValidationOptions & { scope?: 'selected' | 'all' } = {}): RenderableModel {
  let asset: RawAsset
  if (options.scope === 'selected') {
    const result = selectRepresentation(value as RawAsset, { representationId: selection.representationId, type: SPATIAL_CURVE }, options)
    if (!result.ok) throw new ViewerError('INVALID_MODEL', result.issues[0]?.message ?? 'Invalid representation', undefined, false)
    asset = result.asset
  } else {
    const checked=validateAsset(value,options)
    if(!checked.valid) throw new ViewerError(checked.issues[0].code,'Invalid RawAsset',checked.issues,false)
    if(!checked.complete) throw new ViewerError('UNSUPPORTED_SCHEMA',`Incomplete validation: ${checked.missingDependencies.map(d=>d.ref).concat(checked.uncheckedTypes).join(', ')}`,undefined,false)
    asset=normalizeAsset(checked.asset)
  }
  const index=indexAsset(asset,options.registries)
  const rep=selection.representationId === undefined ? asset.representations?.find(r=>r.type === SPATIAL_CURVE) : asset.representations?.find(r=>r.id === selection.representationId)
  if(!rep) throw new ViewerError('INVALID_MODEL','Requested representation was not found',undefined,false)
  if(rep.type !== SPATIAL_CURVE) throw new ViewerError('UNSUPPORTED_SCHEMA','3D viewer requires spatial-curve',undefined,false)
  const data=rep.data as SpatialCurveData, warnings: string[]=[]
  const construction=rep.target && rep.target.kind !== 'subject' ? constructionFor(asset,index,rep.target.construction) : undefined
  const scale=data.coordinateSystem.scale
  const points=data.curves.flatMap(c=>c.points)
  const spans=[0,1,2].map(axis=>{let min=Infinity,max=-Infinity; for(const p of points){min=Math.min(min,p[axis]);max=Math.max(max,p[axis])} return max-min})
  const displayRadius=Math.max(...spans)*0.006 || 0.005
  const curves=data.curves.map(curve=> {
    const object=construction?.objects.find(o=>o.id === curve.object)
    const physicalDiameter=object?.type === ROPE_TYPE && typeof object.diameter === 'number' ? object.diameter : undefined
    const radius=scale.kind === 'physical' && physicalDiameter !== undefined ? physicalDiameter/(2*scale.metersPerUnit) : displayRadius
    if(scale.kind !== 'physical' || physicalDiameter === undefined) warnings.push(`Curve ${curve.id} uses display thickness`)
    return {...structuredClone(curve),radius}
  })
  let camera: Camera3D | undefined
  const selected = selection.view
  if (selected) {
    if (!('camera' in selected)) throw new ViewerError('INVALID_MODEL', 'View references must be resolved by the application', undefined, false)
    const valid = validateView(selected)
    if (!valid.valid || selected.space !== 'space') throw new ViewerError('INVALID_MODEL', 'Invalid 3D view', valid.valid ? undefined : valid.issues, false)
    camera = structuredClone(selected.camera)
  }
  const numbers = camera ? (camera.mode === 'fit' ? [...camera.direction,...camera.up] : [...camera.position,...camera.target,...camera.up]) : []
  if(curves.some(c=>!Number.isFinite(c.radius) || c.radius<=0 || c.radius>1e6 || c.points.some(p=>p.some(n=>Math.abs(n)>1e6))) || numbers.some(n=>Math.abs(n)>1e6)) throw new ViewerError('LIMIT_EXCEEDED','Renderer supports coordinates and radii up to 1000000 data units',undefined,false)
  return {id:asset.id,curves,camera,warnings}
}
/** Standalone representation convenience, with explicitly supplied resource context. */
export function resolveRepresentation(representation: RawRepresentation, options: ValidationOptions = {}): RenderableModel {
  const asset: RawAsset={schema:'Asset',schemaVersion:1,id:representation.id,subject:{id:representation.id},representations:[representation]}
  return resolveAsset(asset,{},options)
}
