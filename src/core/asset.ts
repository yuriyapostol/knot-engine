/** KnotAsset contracts, generation 1. See v1/spec/knot-asset.md. */
export const KNOT_NAMESPACE = 'https://yuriyapostol.github.io/knot-engine/v1/'
export const SPATIAL_CURVE = `${KNOT_NAMESPACE}representation-types/spatial-curve`
export const GRID_DIAGRAM = `${KNOT_NAMESPACE}representation-types/grid-diagram`
export const MOSAIC_DIAGRAM = `${KNOT_NAMESPACE}representation-types/mosaic-diagram`
export const LOMONACO_KAUFFMAN_11 = `${KNOT_NAMESPACE}tile-sets/lomonaco-kauffman-11`
export type MosaicTile = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
/** Row-major square matrix; row 0 is top. */
export interface MosaicDiagram { tileSet: typeof LOMONACO_KAUFFMAN_11; tiles: MosaicTile[][] }
export const ROPE_TYPE = `${KNOT_NAMESPACE}object-types/rope`
export type Point3D = [number, number, number]
export type Reference = { id: string; ref?: never } | { ref: string; id?: never }
export type Namespaces = Record<string, string>
export interface Subject { id: string; names?: { language: string; value: string }[]; identifiers?: { catalog: string; value: string }[] }
export type Target = { kind: 'subject' } | { kind: 'construction'; construction: Reference } | { kind: 'state' | 'object'; construction: Reference; id: string }
export type Interpolation = { type: 'polyline' } | { type: 'catmull-rom'; parameterization: 'uniform'; tension: number } | { type: 'catmull-rom'; parameterization: 'centripetal' | 'chordal' }
export interface SpatialCurve { id: string; object?: string; closed: boolean; interpolation: Interpolation; points: Point3D[] }
export interface SpatialCurveData {
  coordinateSystem: { handedness: 'right'; upAxis: 'y'; scale: { kind: 'relative' } | { kind: 'physical'; metersPerUnit: number } }
  curves: SpatialCurve[]
}
/** Row 0 is bottom; arrays indexed by column. Horizontal O→X; vertical X→O passes over. */
export interface GridDiagram { encoding: 'xo'; size: number; x: number[]; o: number[] }
export type Projection = { kind: 'perspective'; fovY: number } | { kind: 'orthographic' }
export type Camera3D =
  | { mode: 'fit'; direction: Point3D; up: Point3D; projection: Projection; padding?: number }
  | { mode: 'fixed'; position: Point3D; target: Point3D; up: Point3D; projection: { kind: 'perspective'; fovY: number } | { kind: 'orthographic'; height: number } }
export type ViewDefinition = { id: string; name: string; description?: string } & (
  { space: 'space'; camera: Camera3D } | { space: 'plane'; camera: { mode: 'plane'; center: [number, number]; height: number; rotation: number } }
)
export interface CatalogDefinition { id: string; name: string; description: string; homepage?: string; edition?: string; identifierRules?: { caseSensitive?: boolean; pattern?: string } }
export type DataSchema = { ref: string; inline?: never } | { inline: Record<string, unknown>; ref?: never }
export interface ObjectTypeDefinition { id: string; name: string; description: string; dataSchema: DataSchema; specification: string }
export interface RepresentationTypeDefinition extends ObjectTypeDefinition { viewSpace?: 'none' | 'plane' | 'space' }
export interface ConstructionObject { id: string; type: string; [key: string]: unknown }
export interface RopeObject extends ConstructionObject { topology: 'open' | 'closed'; ends: { id: string }[]; length?: number; diameter?: number }
export interface Construction { id: string; name?: string; description?: string; objects: ConstructionObject[]; states?: { id: string; name?: string; description?: string }[] }
export interface Representation { id: string; type: string; target?: Target; data: unknown; views?: (ViewDefinition | { ref: string })[]; defaultView?: Reference; preferredView?: { direction: Point3D; up: Point3D } }
export interface Step { id: string; instructions?: Record<string, string>; representations?: Reference[] }
export interface Procedure { id: string; name?: string; construction?: Reference; steps: Step[] }
export type ResourceEntry = { kind: 'catalog'; resource: CatalogDefinition } | { kind: 'representation-type'; resource: RepresentationTypeDefinition } | { kind: 'object-type'; resource: ObjectTypeDefinition } | { kind: 'construction'; resource: Construction } | { kind: 'view'; resource: ViewDefinition }
export type ResourceKind = ResourceEntry['kind']
export interface Dependency { kind: ResourceKind; ref: string }
export interface DocumentContext { schemaVersion: 1; $schema?: string; namespaces?: Namespaces; dependencies?: Dependency[] }
export interface KnotAsset extends DocumentContext {
  schema: 'KnotAsset'; id: string; subject: Subject
  catalogs?: CatalogDefinition[]; representationTypes?: RepresentationTypeDefinition[]; objectTypes?: ObjectTypeDefinition[]
  constructions?: (Construction | { ref: string })[]; representations?: Representation[]; procedures?: Procedure[]
}
export type KnotResourceDocument = DocumentContext & ResourceEntry & { schema: 'KnotResourceDocument' }
export interface KnotResourceRegistry extends Omit<DocumentContext, 'dependencies'> { schema: 'KnotResourceRegistry'; id?: string; resources: ResourceEntry[] }
export interface KnotRepresentationDocument extends DocumentContext { schema: 'KnotRepresentationDocument'; subject?: Subject; representation: Representation }
