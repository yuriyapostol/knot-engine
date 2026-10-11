/** Authoritative domain contract: docs/knot-asset-v1.md. Coordinates are meters. */
export type Point2D = [number, number]
export type Point3D = [number, number, number]
export type Dimension = 2 | 3
export type Point<D extends Dimension = Dimension> = D extends 2 ? Point2D : Point3D

export interface RopeEnd { id: string }
export interface RopeElement {
  id: string
  type: 'rope'
  topology: 'open' | 'closed'
  ends: RopeEnd[]
  length?: number
  diameter?: number
  subtype?: string
}
export interface SupportElement { id: string; type: 'support'; subtype?: string }
export interface CarabinerElement { id: string; type: 'carabiner'; subtype?: string }
export type KnotElement = RopeElement | SupportElement | CarabinerElement

export interface CurveGeometry<D extends Dimension = Dimension> {
  type: 'curve'
  closed: boolean
  interpolation: { type: 'catmullrom'; tension: number }
  points: Point<D>[]
}
/** Extend this union when another geometry contract is standardized. */
export type Geometry<D extends Dimension = Dimension> = CurveGeometry<D>
export interface SnapshotElement<D extends Dimension = Dimension> { id: string; geometry: Geometry<D> }
export interface CrossingPoint { element: string; u: number }
export interface Crossing { id?: string; over: CrossingPoint; under: CrossingPoint }
export type Snapshot<D extends Dimension = Dimension> = D extends Dimension ? {
  id: string
  elements: SnapshotElement<D>[]
  crossings?: D extends 2 ? Crossing[] : never
} : never
/** Distinct from the legacy viewer CameraView, whose fov remains required. */
export interface AssetCameraView { position: Point3D; target: Point3D; fov?: number }
export interface Presentation { camera?: AssetCameraView; preset?: string }
export type Representation<D extends Dimension = Dimension> = D extends Dimension ? {
  id: string
  dimension: D
  snapshots: Snapshot<D>[]
  presentation?: Presentation
} : never
export interface Step { id: string; snapshot: string }
export interface Algorithm { id: string; representation: string; steps: Step[] }
export interface Variant { id: string; representation: string; snapshot: string }
/** Combinatorial grid: row 0 is the bottom row; columns increase to the right.
 * Horizontal arcs run O→X, vertical arcs X→O and pass over horizontal arcs. */
export interface GridDiagram {
  id: string
  type: 'grid'
  size: number
  x: number[]
  o: number[]
}
export interface KnotIdentity { id: string; name?: string; aliases?: string[] }
export interface KnotAsset extends KnotIdentity {
  /** Optional only for compatibility with the initial v1 documents. */
  schema?: 'KnotAsset'
  $schema?: string
  schemaVersion: 1
  id: string
  units: 'm'
  elements: KnotElement[]
  representations: Representation[]
  algorithms?: Algorithm[]
  variants?: Variant[]
  diagrams?: GridDiagram[]
}
