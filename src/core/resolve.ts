import type { KnotCurve, CameraView } from './legacy'
import { validateKnotModelV1, ViewerError } from './legacy'
import { validateKnotAsset } from './validateAsset'

/** Internal rendering data, not a versioned authoring/serialization contract. */
export interface RenderableModel {
  id?: string
  curves: KnotCurve[]
  camera?: CameraView
  warnings: string[]
}
export interface SnapshotSelection { representationId?: string; snapshotId?: string }
const copyCurve = (curve: KnotCurve): KnotCurve => ({ ...curve, interpolation: { ...curve.interpolation }, points: curve.points.map(p => [...p]) })

export function resolveKnotModelV1(value: unknown): RenderableModel {
  const result = validateKnotModelV1(value)
  if (!result.valid) throw new ViewerError(result.issues[0].code, 'Invalid legacy KnotModelV1', result.issues, false)
  const { model } = result
  const p = model.preview
  return {
    id: model.id, curves: model.curves.map(copyCurve), warnings: [...result.warnings],
    camera: p?.cameraPosition && p.target ? { position: [...p.cameraPosition], target: [...p.target], fov: p.fov ?? 55 } : undefined
  }
}

/** Validates the whole asset before selecting a static 3D snapshot. No geometry allocation. */
export function resolveKnotAsset(value: unknown, selection: SnapshotSelection = {}): RenderableModel {
  const result = validateKnotAsset(value)
  if (!result.valid) throw new ViewerError(result.issues[0].code, 'Invalid KnotAsset', result.issues, false)
  const { asset } = result
  const representation = selection.representationId === undefined
    ? asset.representations.find(rep => rep.dimension === 3)
    : asset.representations.find(rep => rep.id === selection.representationId)
  if (!representation) throw new ViewerError('INVALID_MODEL', 'Requested 3D representation was not found', undefined, false)
  if (representation.dimension !== 3) throw new ViewerError('UNSUPPORTED_SCHEMA', '2D rendering is not supported', undefined, false)
  const snapshot = selection.snapshotId === undefined ? representation.snapshots[0] : representation.snapshots.find(s => s.id === selection.snapshotId)
  if (!snapshot) throw new ViewerError('INVALID_MODEL', 'Requested snapshot was not found in the representation', undefined, false)
  if (!snapshot.elements.length) throw new ViewerError('INVALID_MODEL', 'Snapshot has no renderable curves', undefined, false)
  const elements = new Map(asset.elements.map(e => [e.id, e]))
  const warnings: string[] = []
  const curves = snapshot.elements.map(state => {
    const element = elements.get(state.id)!
    const radius = element.type === 'rope' && element.diameter !== undefined ? element.diameter / 2 : 0.005
    if (element.type !== 'rope' || element.diameter === undefined) warnings.push(`Element ${element.id} uses a display radius of 0.005 m; no physical thickness is inferred`)
    return copyCurve({ id: state.id, closed: state.geometry.closed, interpolation: state.geometry.interpolation, points: state.geometry.points, radius })
  })
  const presentation = representation.presentation
  if (presentation?.preset !== undefined && presentation.preset !== 'light-outline-v1') warnings.push(`Presentation preset ${presentation.preset} is not supported; using the default appearance`)
  const camera = presentation?.camera
  // Rendering policy is separate from finite-coordinate domain validation.
  if (curves.some(c => c.radius <= 0 || c.radius > 1e6 || c.points.some(p => p.some(n => Math.abs(n) > 1e6))) ||
      (camera && [...camera.position, ...camera.target].some(n => Math.abs(n) > 1e6))) {
    throw new ViewerError('LIMIT_EXCEEDED', '3D rendering supports coordinates within ±1000000 m and radii greater than 0 and at most 1000000 m', undefined, false)
  }
  return { id: asset.id, curves, warnings, camera: camera ? { position: [...camera.position], target: [...camera.target], fov: camera.fov ?? 55 } : undefined }
}
