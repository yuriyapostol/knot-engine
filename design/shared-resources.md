# Shared and inline resources

This note explains the implemented resource design. Exact fields and limits are defined by the [data contract](../v1/specifications/knot.md), [metadata contract](../v1/specifications/sources.md) and standalone schemas. [Open design questions](knot-draft.md) cover additional concepts.

## Identity and namespaces

Project identifiers use `https://yuriyapostol.github.io/knot-engine/v1/`. Resource identity is independent of file paths, documentation routes and releases. Integration identifiers belong to Knot Engine; external standards retain their own identities. A URI does not imply publication or network fetching.

```json
{
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  }
}
```

A declared `knot-engine:representation-types/pd-code` expands by concatenating the namespace URI and suffix. Local IDs retain their declared scope. Prefixes `http`, `https` and `urn` are reserved; undeclared prefixes are errors. Compare global IDs after expansion. Prose, source URLs and arbitrary unknown data are not rewritten. JSON Schema `$id`/`$ref` and editor `$schema` retain ordinary URI semantics.

## Envelopes and placement

`RawResourceDocument` uses `schema: "ResourceDocument"`, `schemaVersion: 1`, `kind` and `resource`, with optional `$schema`, `namespaces` and `dependencies`. A standalone resource needs a global ID. `RawResourceRegistry` uses `schema: "ResourceRegistry"` and `resources` entries with `kind`/`resource`; optional fields are `$schema`, `namespaces` and `id`.

| Kind | Definition | Placement |
| --- | --- | --- |
| `catalog` | Identification system and designation rules | `RawKnot.catalogs`, explicit registry |
| `representation-type` | Data schema and semantic specification | `RawKnot.representationTypes`, explicit registry |
| `object-type` | Construction-object data contract | `RawKnot.objectTypes`, explicit registry |
| `construction` | Concrete objects and optional named states | `RawKnot.constructions`, explicit registry |
| `source` | Data origin, authors and source license | `RawKnot.sources`, explicit registry |
| `view` | Named plane or spatial camera | Application `views`, explicit registry |

Constructions can be inline or included through `{ref: URI}`. Local `{id}` and global `{ref}` references are exclusive. Views are application-owned inputs to components. All viewers receive the knot context rather than a bare resource payload.

Different definitions with the same kind and expanded URI conflict; identical JSON definitions may be deduplicated ignoring object-key order. Registries are explicitly supplied, including `STANDARD_RESOURCES`; no singleton or resolver fetches missing definitions. Missing dependencies and unchecked types prevent complete validation. Envelope-only resource/registry validation does not establish transitive closure.

## Catalogs, types and constructions

A catalog defines an identification system, not a list of its records. Its name is a label rather than a lookup key. `identifierRules` checks designation syntax; it does not prove record existence or knot equivalence. Editions that reuse a designation for another subject need distinct identities.

Representation and object types identify a `dataSchema` and semantic `specification`. External schemas are explicitly supplied through validation options; inline schemas declare their dialect. A schema does not install a semantic validator, importer or renderer. `viewSpace` describes a representation's view compatibility, independently of its subject's physical dimension.

A construction contains concrete objects with scoped IDs and optional named states. Rope topology, ends, length and diameter are domain data. A carabiner's object type is distinct from its role as a support. Material, constraints and state-specific roles need further domain contracts.

## Application-owned views

`ViewDefinition` requires `id`, `name`, `space` and `camera`; `description` is optional. Spatial cameras use complete `fit` or `fixed` modes with perspective or orthographic projection. Plane cameras use `mode: "plane"`, `center` and positive `height`, without rotation. See [viewer contracts](../v1/specifications/viewer-contracts.md) for selection and overrides.

For example, an application can pass this value as the `view` prop:

```json
{
  "id": "front",
  "name": "Front",
  "space": "space",
  "camera": {
    "mode": "fit",
    "direction": [0, 0, 1],
    "up": [0, 1, 0],
    "projection": { "kind": "perspective", "fovY": 0.7853981633974483 }
  }
}
```

The same definition can be stored in the application's `views` array and selected with `view: {id: "front"}`. Global `{ref}` lookup uses explicit registries and declared namespaces. Omitted `view` uses viewer defaults; presets alone do not select a view. Interaction changes local viewer state and leaves knot data unchanged.

## Standalone catalog example

This fictional training catalog demonstrates a resource envelope. It is not a KnotInfo integration definition. Its `resource` can also be placed in `RawKnot.catalogs`.

```json
{
  "schema": "ResourceDocument",
  "schemaVersion": 1,
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  },
  "kind": "catalog",
  "resource": {
    "id": "knot-engine:catalogs/training-knots",
    "name": "Training knots",
    "description": "An example registry where each described construction has a unique designation.",
    "identifierRules": { "caseSensitive": true, "pattern": "^A-[0-9]{3}$" }
  }
}
```

Source definitions record provenance separately from catalogs. Contributions remain flat lists on the knot or representation, and the knot's license describes the publication unit. See [sources and contributions](../v1/specifications/sources.md).
