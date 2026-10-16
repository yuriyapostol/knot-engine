# Shared and inline KnotAsset resources

**Implementation status:** the initial profile (spatial-curve, Grid (X/O, vertex-pairs), mosaic-diagram, constructions, procedures, resources and cameras) is described in the [current specification](../v1/spec/knot-asset.md). This broader design also contains deferred features; the current specification defines the supported fields precisely.

Status: design reference elaborating the [architectural draft](knot-asset-draft.md). Standalone resources and optional embedding are implemented in the initial profile. The [current specification](../v1/spec/knot-asset.md) defines their supported fields; additional details below remain proposals. Package version and `schemaVersion: 1` stay unchanged; compatibility with the previous structure is not required. See [publication](publication.md).

## 1. Namespace

Project identifiers use `https://yuriyapostol.github.io/knot-engine/v1/`.

| Path within the namespace | Meaning |
| --- | --- |
| schema/<contract>.schema.json | Machine-readable contract |
| catalogs/<name> | Identification system definition |
| representation-types/<name> | Representation semantics |
| categories/<name> | Classification term |
| relations/<name>, properties/<name> | Relation and property definitions |
| object-types/<name>, tile-sets/<name> | Object contracts and tile sets, requiring further schemas |
| views/<name>, constructions/<name> | Reusable views and constructions |
| examples/<name> | Demonstration identities |

These are identifiers, not a claim that all resources are published. Documentation now lives under `guide/` and `spec/`, while concrete registry records belong under `resources/`. Navigation and storage paths do not redefine resource identity. Integration identifiers belong to Knot Engine, not to external publishers. External standards retain their own identifiers.

`schema` names the document contract; `schemaVersion` names its generation; optional editor `$schema` locates its JSON Schema. Contradictory values are errors. A shared generation does not prevent independent subschema entry points.

### Namespaces: agreed decision

KnotAsset, KnotRepresentationDocument, KnotResourceDocument and KnotResourceRegistry support a root namespace dictionary:

```json
{
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  }
}
```

`knot-engine:representation-types/pd-code` expands by appending the suffix after the first colon to the declared namespace URI. This is prefix substitution, not relative-path resolution; `../` is not a way to move between namespaces.

- The dictionary is required when compact identifiers are used; documents containing only full URIs can omit it. No implicit prefix or nested override is allowed.
- This replaces the earlier `base` proposal for entity identity. File and page locations have no identity semantics; plain relative paths are not global IDs.
- Keep field names `id`, `type`, `catalog`, `category`, `ref` and so on. Do not introduce `local` instead of `id`. A scoped local reference can be `{kind: "object", construction: {id: "setup-a"}, id: "rope-a"}`.
- Local IDs retain their contract-defined scope and are not expanded. Global identifier fields accept declared compact identifiers or full URIs. Catalog values, prose and arbitrary data strings are not identifiers.
- Compare and detect conflicts after expansion. Prefixes are local aliases; a compact identifier and its full URI identify the same entity.
- Global identity does not imply a network fetch. The definition may be inline or in a supplied registry.
- Extraction retains used mappings or expands the relevant fields. Composition resolves each input in its own context. Conflicting prefix mappings require explicit renaming with rewritten references, or full URIs.
- Prefixes must not conflict with supported URI schemes. Final grammar is still open; the working rule reserves `http`, `https` and `urn`, and rejects undeclared prefixes rather than silently treating typos as arbitrary schemes.

This is a KnotAsset mechanism, not a declaration that documents are JSON-LD. A resolver processes only contract-defined fields. JSON Schema, including embedded schemas, retains standard `$id`/`$ref` rules without custom prefix expansion. Editor `$schema` remains a full URI. Source/image URLs may remain full URLs; this decision introduces no separate relative-file mechanism. Unknown data types cannot be safely rewritten without knowing their identifier fields. Changing a namespace URI changes dependent identities unless references are rewritten to preserve expansion results.

## 2. One resource, one contract

CatalogDefinition, RepresentationTypeDefinition, ViewDefinition and Construction each have independent data contracts. The same resource can be a narrow component argument, a standalone document payload, or an entry in an asset/registry.

`KnotResourceDocument` requires `schema`, `schemaVersion`, `kind`, `resource`; optional fields are `$schema`, `namespaces`, `dependencies`. Kind selects catalog, representation-type, view or construction. Dependencies are `{kind, ref}` records with global references. The envelope is not repeated inside every embedded value.

`KnotResourceRegistry` has schema, schemaVersion, optional $schema/namespaces/id, and resources containing kind/resource pairs. It may be a file or explicit application object; no server or singleton is required.

| Asset field | Content |
| --- | --- |
| catalogs[] | Inline CatalogDefinition records |
| representationTypes[] | Inline RepresentationTypeDefinition records |
| constructions[] | Construction or `{ref: URI}` |
| representations[].views[] | ViewDefinition or `{ref: URI}` |
| dependencies[] | External definitions the consumer must supply |

Catalog and type fields already reference definitions, so catalogs/representationTypes do not need duplicate ref-only entries. Their absence is normal with supplied registries. Inline known definitions are useful for autonomous export. In constructions/views, a ref includes a resource in the available set and cannot contain silent override fields. A changed resource needs its own identity and may relate to its source.

### Resolution and validation

Compare expanded absolute URIs exactly; names are not lookup keys. Registries are explicit, and references execute neither code nor network requests. Local construction/view/state/object IDs are allowed; local `{id: "setup-a"}` and global `{ref: URI}` references are mutually exclusive. Publishing a local construction independently requires a global ID and rewritten references; its objects and states remain scoped within it.

Different definitions for one global ID conflict even when one is inline. Exact JSON duplicates may be deduplicated ignoring object-key order; semantic equivalence is not guessed. Missing dependencies permit reading the envelope but prevent claiming self-containment or complete semantic validation. Validation must report them.

Autonomous export includes transitive requirements, traversing cycles once per ID, not the complete registry. A narrow renderer may receive already-resolved data and need not understand unrelated catalogs or constructions.

## 3. CatalogDefinition

Required fields: global `id`, nonempty `name` and `description`. Description specifies scope and distinctions, including orientation, mirroring and editions where relevant.

Optional fields: full homepage URL, edition string, and identifierRules with caseSensitive (default true) and an ECMA-262 pattern without flags. Patterns are applied as written; authors use `^` and `$` for whole-string matching. When caseSensitive is false, only ASCII A–Z/a–z comparison ignores case; other characters compare exactly. Other normalization needs an extension. Preserve the recorded value.

Subject identifiers contain `{catalog: URI, value: string}`. Syntax validation proves neither existence nor knot equivalence. Catalog definitions are distinct from source records and category vocabularies. Editions reusing a designation for another subject need distinct catalog identities.

## 4. RepresentationTypeDefinition

Required fields: global id (referenced by Representation.type), name, description, dataSchema and specification URI. dataSchema is exactly `{ref: schemaURI}` or `{inline: JSONSchemaObject}`. The specification explains conventions and semantics beyond JSON Schema.

Embedded schemas declare their dialect. External schema references also require a supplied schema registry; embedding only the root schema does not imply self-containment. Optional viewSpace is none, plane or space, default none. It describes compatibility with basic views, not the subject's physical dimensionality.

A type needs structural validation and documented indexing, orientation, topology and dependencies. Registering its definition does not install renderers, importers or mathematical validators. The application separately maps type IDs to implementations. Unknown types may be preserved without claiming support. KnotScape and SnapPy identify tools/provenance, not formats merely by name. Prefixes in type identifiers are declared explicitly in namespaces.

## 5. ViewDefinition and preferredView

Required fields: local or global id, name, space (plane or space), camera. Description is optional. Views do not require a subject and can be supplied without an asset. Coordinates belong to the representation to which the view is applied.

| Camera mode | Required parameters | Meaning |
| --- | --- | --- |
| fit, in space | direction, up, projection | Nonzero noncollinear XYZ vectors, direction from focus to camera; fit the geometry |
| fixed, in space | position, target, up, projection | Distinct position/target; up not parallel to viewing direction |
| plane, in plane | center, height, rotation | XY center, positive visible height in data coordinates, counterclockwise angle in radians in the data plane |

All numbers are finite. Perspective projection has kind perspective and `0 < fovY < π`, in radians. Orthographic projection has kind orthographic, plus positive height for fixed mode. The viewport supplies aspect ratio; the renderer derives near/far. Fit uses bounding-box center and accommodates all geometry; optional padding is a size multiplier at least 1, default 1.1. Padding does not apply to fixed/plane modes. Direction/up are normalized on application without changing stored data.

This is a basic camera contract, not a complete lighting/material/animation specification. Styling needs its own typed contract rather than an arbitrary untyped object.

Representation.views embeds or references available views. Optional defaultView is `{id: id}` or `{ref: URI}` selecting one of them. preferredView remains a compact independent 3D hint `{direction, up}`, without distance/materials or a required registry entry.

Selection order: explicit application view → defaultView → preferredView with automatic fitting → component default. Each selects a complete camera mode; fields are not silently mixed. Later interaction changes camera state, not the asset. Space views are incompatible with plane/none representations.

## 6. Construction

A construction is a concrete set of objects, not a template such as “any two ropes”. Object-type definitions and possible construction templates are separate future contracts.

Minimum fields: id and nonempty objects; name, description and states are optional. Each object has a unique construction-local id and a type URI selecting its additional data contract. Proposed rope topology is open or closed. An open rope has exactly two different end IDs; a closed rope has no ends. Material, physical conditions, roles and state constraints still need domain design.

A minimum state has unique construction-local id and optional name/description. It is a named state, not an arbitrary bag for all future properties. Constructions need no geometry; procedures and representations reference them without requiring reverse references to every consumer.

Construction references use `{id: id}` or `{ref: URI}`. State references additionally identify kind state and the state ID. Identical local rope IDs in different constructions are distinct objects. A shared global construction cannot be independently mutated through one of its consumers.

## 7. Inline and referenced view examples

This is a representation fragment, not a full asset or a claim that the referenced view has been published:

```json
{
  "views": [
    { "ref": "https://yuriyapostol.github.io/knot-engine/v1/views/front" },
    {
      "id": "author-angle",
      "name": "Авторський ракурс",
      "space": "space",
      "camera": {
        "mode": "fit",
        "direction": [1, 1, 2],
        "up": [0, 1, 0],
        "projection": { "kind": "perspective", "fovY": 0.7853981633974483 }
      }
    }
  ],
  "defaultView": { "id": "author-angle" }
}
```

Standalone catalog definition:

```json
{
  "schema": "KnotResourceDocument",
  "schemaVersion": 1,
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  },
  "kind": "catalog",
  "resource": {
    "id": "knot-engine:catalogs/training-knots",
    "name": "Навчальний каталог",
    "description": "Демонстраційний реєстр окремо описаних конструкцій; кожна має унікальне позначення.",
    "identifierRules": { "caseSensitive": true, "pattern": "^A-[0-9]{3}$" }
  }
}
```

The unchanged resource can be placed in asset.catalogs. The localized sample names are the same data in both language editions. An actual KnotInfo integration still needs verified record semantics; the training catalog does not claim to be that definition.
