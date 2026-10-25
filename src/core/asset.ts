/** RawAsset contracts, generation 1. See v1/specifications/knot-asset.md. */
export const KNOT_NAMESPACE = 'https://yuriyapostol.github.io/knot-engine/v1/'
export const SPATIAL_CURVE = `${KNOT_NAMESPACE}representation-types/spatial-curve`
export const GRID_DIAGRAM = `${KNOT_NAMESPACE}representation-types/grid-diagram`
export const MOSAIC_DIAGRAM = `${KNOT_NAMESPACE}representation-types/mosaic-diagram`
export const LOMONACO_KAUFFMAN_11 = `${KNOT_NAMESPACE}tile-sets/lomonaco-kauffman-11`
export type MosaicTile = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
/** Row-major square matrix; row 0 is top. */
export interface MosaicDiagram { tileSet: typeof LOMONACO_KAUFFMAN_11; tiles: MosaicTile[][] }
export const PD_CODE = `${KNOT_NAMESPACE}representation-types/pd-code`
export const PD_CCW_UNDER_FIRST = `${KNOT_NAMESPACE}conventions/pd-ccw-under-first`
export type PDCrossing = [number, number, number, number]
/** Positive edge labels; CCW slots start at an incoming underpass. */
export interface PDCode { convention: typeof PD_CCW_UNDER_FIRST; crossings: PDCrossing[]; unlinkedComponents?: number }
export const DT_CODE = `${KNOT_NAMESPACE}representation-types/dt-code`
export const DT_SIGNED_EVEN = `${KNOT_NAMESPACE}conventions/dt-signed-even`
/** One traversal or component traversals; negative means the odd visit passes under. */
export interface DTCode { convention: typeof DT_SIGNED_EVEN; code: number[] | number[][] }
export const ROPE_TYPE = `${KNOT_NAMESPACE}object-types/rope`
export type Point3D = [number, number, number]
export type Reference = { id: string; ref?: never } | { ref: string; id?: never }
export type Namespaces = Record<string, string>
export interface RawSubject { id: string; names?: { language: string; value: string }[]; descriptions?: { language: string; value: string }[]; identifiers?: { catalog: string; value: string }[] }
export type Target = { kind: 'subject' } | { kind: 'construction'; construction: Reference } | { kind: 'state' | 'object'; construction: Reference; id: string }
export type Interpolation = { type: 'polyline' } | { type: 'catmull-rom'; parameterization: 'uniform'; tension: number } | { type: 'catmull-rom'; parameterization: 'centripetal' | 'chordal' }
export interface SpatialCurve { id: string; object?: string; closed: boolean; interpolation: Interpolation; points: Point3D[] }
export interface SpatialCurveData {
  coordinateSystem: { handedness: 'right'; upAxis: 'y'; scale: { kind: 'relative' } | { kind: 'physical'; metersPerUnit: number } }
  curves: SpatialCurve[]
}
/** Row 0 is bottom; arrays indexed by column. Horizontal O→X; vertical X→O passes over. */
export interface GridXODiagram { encoding: 'xo'; size: number; x: number[]; o: number[] }
/** Unoriented vertices [column, row], both zero-based; array order is immaterial. */
export interface GridVertexPairsDiagram { encoding: 'vertex-pairs'; size: number; vertices: [number, number][] }
export type GridDiagram = GridXODiagram | GridVertexPairsDiagram
export type Projection = { kind: 'perspective'; fovY: number } | { kind: 'orthographic' }
export type Camera3D =
  | { mode: 'fit'; direction: Point3D; up: Point3D; projection: Projection; padding?: number }
  | { mode: 'fixed'; position: Point3D; target: Point3D; up: Point3D; projection: { kind: 'perspective'; fovY: number } | { kind: 'orthographic'; height: number } }
export type ViewDefinition = { id: string; name: string; description?: string } & (
  { space: 'space'; camera: Camera3D } | { space: 'plane'; camera: { mode: 'plane'; center: [number, number]; height: number } }
)
export interface RawCatalogDefinition { id: string; name: string; description: string; homepage?: string; edition?: string; identifierRules?: { caseSensitive?: boolean; pattern?: string } }
export type DataSchema = { ref: string; inline?: never } | { inline: Record<string, unknown>; ref?: never }
export interface RawObjectTypeDefinition { id: string; name: string; description: string; dataSchema: DataSchema; specification: string }
export interface RawRepresentationTypeDefinition extends RawObjectTypeDefinition { viewSpace?: 'none' | 'plane' | 'space' }
export interface ConstructionObject { id: string; type: string; [key: string]: unknown }
export interface RopeObject extends ConstructionObject { topology: 'open' | 'closed'; ends: { id: string }[]; length?: number; diameter?: number }
export interface Construction { id: string; name?: string; description?: string; objects: ConstructionObject[]; states?: { id: string; name?: string; description?: string }[] }
export interface License { name: string; url?: string }
export interface SourceAuthor { name: string; email?: string; url?: string }
export type ContributionRole = 'creation' | 'import' | 'conversion' | 'editing' | 'validation'
export interface Contribution extends SourceAuthor { roles?: ContributionRole[]; date?: string; note?: string }
export interface SourceFields { title?: string; url?: string; authors?: SourceAuthor[]; version?: string; license?: License; locator?: string; accessed?: string; note?: string }
export type Source = SourceFields & ({ title: string } | { url: string })
export type SourceDefinition = Source & { id: string }
export type SourceReference = Reference & { locator?: string; accessed?: string; note?: string }
export type SourceUse = Source | SourceReference
export interface RawRepresentation { names?: { language: string; value: string }[]; descriptions?: { language: string; value: string }[]; sources?: SourceUse[]; contributions?: Contribution[]; id: string; type: string; target?: Target; data: unknown }
export interface RawStep { names?: { language: string; value: string }[]; id: string; instructions?: { language: string; value: string }[]; representations?: Reference[] }
export interface RawProcedure { id: string; names?: { language: string; value: string }[]; descriptions?: { language: string; value: string }[]; construction?: Reference; steps: RawStep[] }
export type ResourceEntry = { kind: 'source'; resource: SourceDefinition } | { kind: 'catalog'; resource: RawCatalogDefinition } | { kind: 'representation-type'; resource: RawRepresentationTypeDefinition } | { kind: 'object-type'; resource: RawObjectTypeDefinition } | { kind: 'construction'; resource: Construction } | { kind: 'view'; resource: ViewDefinition }
export type ResourceKind = ResourceEntry['kind']
export interface Dependency { kind: ResourceKind; ref: string }
export interface DocumentContext { schemaVersion: 1; $schema?: string; namespaces?: Namespaces; dependencies?: Dependency[] }
export interface RawAsset extends DocumentContext {
  schema: 'Asset'; id: string; subject: RawSubject
  sources?: SourceDefinition[]; contributions?: Contribution[]; license?: License
  catalogs?: RawCatalogDefinition[]; representationTypes?: RawRepresentationTypeDefinition[]; objectTypes?: RawObjectTypeDefinition[]
  constructions?: (Construction | { ref: string })[]; representations?: RawRepresentation[]; procedures?: RawProcedure[]
}
export type KnotResourceDocument = DocumentContext & ResourceEntry & { schema: 'KnotResourceDocument' }
export interface RawKnotResourceRegistry extends Omit<DocumentContext, 'dependencies'> { schema: 'KnotResourceRegistry'; id?: string; resources: ResourceEntry[] }
export interface KnotRepresentationDocument extends DocumentContext { schema: 'KnotRepresentationDocument'; subject?: RawSubject; representation: RawRepresentation; sources?: SourceDefinition[] }
