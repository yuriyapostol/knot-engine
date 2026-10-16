# KnotAsset: proposed contract revision

**Implementation status:** the initial profile (spatial-curve, Grid (X/O, vertex-pairs), mosaic-diagram, constructions, procedures, resources and cameras) is described in the [current specification](../v1/spec/knot-asset.md). This broader design also contains deferred features; the current specification defines the supported fields precisely.

**Status: architectural draft for discussion.** This records agreed principles and a possible structure. It does not replace the [implemented contract](../v1/spec/knot-asset.md) or claim that the proposed API exists. The transition from KnotModelV1 is complete for the initial profile. Features beyond the current specification remain under design.

**Current policy: keep version numbers unchanged and do not preserve compatibility with old contracts.** The project has no external users yet. Revisions remain within `schemaVersion: 1` and package `0.1.0`. KnotModelV1 APIs, schemas, adapters and dual-format support have been removed. Field names and example shapes are proposals except where explicitly agreed.

## 1. Agreed decisions

| No. | Decision |
| --- | --- |
| 1 | One asset describes one defined knot or construction; explicit relations may connect other knots or categories and cite properties as evidence. |
| 2 | Geometric, diagrammatic and symbolic representations share `representations`. |
| 3 | Physical objects and their properties belong to concrete constructions, available standalone or through an asset. |
| 4 | Procedures are independent of illustrations; point correspondence for animation is not required for procedure validity. |
| 5 | Replace generic variants with states, representations, procedures, constructions or relations. |
| 6 | Support standalone fragment contracts and reduced self-contained assets. |
| 7 | Keep the full name `representations`. |
| 8 | Store explicit relations; normally find property matches through queries. A relation may cite properties as its basis. |
| 9 | Extend standard concepts through namespaces. |
| 10 | Coordinates may use physical or relative scale; grid indices are not physical coordinates. |
| 11 | Fragment contracts initially share one specification generation. |
| 12 | Full viewer settings have a standalone contract; no mandatory root `views`. |
| 13 | 3D representations may contain an optional initial orientation hint. |
| 14 | Properties, relations and classifications may target inner entities. Shared assertion collections with explicit references are the working direction, subject to extraction scenarios. |
| 15 | No version bumps or backward compatibility requirements during initial development. |
| 16 | The initial profile fully replaces KnotModelV1; legacy APIs, adapters, duplicate inputs and compatibility tests have been removed. |
| 17 | Catalogs, representation type definitions, constructions and views have standalone contracts; registries or inline definitions can supply them. Views are embedded in representations. |
| 18 | Project global identifiers use `https://yuriyapostol.github.io/knot-engine/v1/`; this does not imply that every proposed resource is published. |
| 19 | Use `namespaces` and `knot-engine:name`. This replaces the proposed `base`. Keep field names: local identifiers remain `id`, not `local`. |
| 20 | One release includes package, documentation, specifications, schemas and data. `/v1/` includes 0.x; `/releases/<package-version>/` holds fixed snapshots. |

See [shared resources](shared-resources.md) and [real representation formats](representation-formats.md). Their detailed fields remain proposals.

## 2. Concept boundaries

| Concept | Meaning | Does not automatically establish |
| --- | --- | --- |
| Asset | Selected information about one subject | Completeness of knowledge |
| Subject | The knot or construction being described | Identity merely from a matching name |
| Construction | Concrete ropes, equipment and other objects | A unique geometry or tying procedure |
| State | Meaningful condition of a construction | Step number, time or camera angle |
| Representation | Typed depiction of a subject, construction or state | Proven equivalence with other representations |
| Procedure | Actions and their meaningful order | Geometry interpolation |
| Property | Assertion about a defined entity | Applicability to all representations or physical realizations |
| Relation | Explicit typed relationship | All pairwise property matches |
| Classification | Membership in a category | Structural data format |
| Viewer settings | Application-supplied display settings | Authored geometry or physical state |

A practical knot, mathematical object and physical specimen must not be silently identified. A mathematical closure of an open rope needs explicit correspondence rules; `closed: true` in geometry is insufficient.

## 3. Root structure

```text
KnotAsset
├── schema, schemaVersion
├── namespaces?
├── id
├── subject
├── catalogs[]?
├── representationTypes[]?
├── dependencies[]?
├── constructions[]?
├── representations[]?
├── procedures[]?
├── properties[]?
├── relations[]?
├── classifications[]?
└── sources[]?
```

These sections are optional as appropriate. An asset need not have physical constructions, procedures or geometry. Document `id` and `subject.id` should be distinct so independent documents can describe one subject. Global identity, revision and merging rules still need decisions; matching IDs are not mathematical proofs.

Names use proposed `subject.names` with language and optional context. Catalog designations use `subject.identifiers`, explicitly referring to a catalog definition.

### 3.1. Catalog meaning

A catalog is an identification system for knots or constructions: a database, printed reference or an organization's registry. A name or homepage alone does not explain which objects it distinguishes or what its labels mean.

`CatalogDefinition` can be embedded in `catalogs` or provided by an explicit registry:

| Field | Purpose |
| --- | --- |
| `id` | Required stable global identity, absolute after namespace expansion |
| `name` | Required readable name; not a lookup key |
| `description` | Required scope and semantics, including relevant distinctions |
| `homepage` | Optional location, independent of identity |
| `edition` | Optional source edition |
| `identifierRules` | Optional declarative case and pattern rules |

Definitions describe identification systems, not all their records. IDs are assigned by the publisher or integration maintainer. Reuse an established integration definition rather than minting an ID per asset. An integration URI is not an official publisher ID. Known names such as KnotInfo do not activate hidden validator behavior. Registry contents still need preparation.

### 3.2. Subject identifiers

```json
{
  "catalog": "https://yuriyapostol.github.io/knot-engine/v1/catalogs/training-knots",
  "value": "A-017"
}
```

`catalog` refers to a definition; `value` is a nonempty string, preserving leading zeros and suffixes. Unless declared otherwise, compare exactly without numeric conversion, case changes or stripping zeros. Identity is the pair `(catalog, value)`. Equality across different catalogs is not implied. The author's correspondence assertion is not an automatic knot-equivalence proof, and `subject.id` is not inferred from the first identifier.

If a catalog ignores distinctions such as orientation or mirror forms, a matching designation does not justify merging every aspect of the described subjects.

### 3.3. Resolution and self-containment

- A self-contained document includes every used catalog definition, not the catalog database.
- External definitions come from an explicitly supplied registry, declared through `dependencies: [{kind: "catalog", ref: URI}]`.
- Compare global IDs after namespace expansion. Conflicting definitions are errors; neither inline nor external definitions silently override the other.
- URIs do not instruct viewers to fetch resources.
- `identifierRules` check syntax, not record existence. Existence requires catalog data or an integration.
- Extraction retains required definitions; composition may deduplicate identical definitions but must resolve semantic conflicts explicitly.

A changed description is different from an edition reusing a designation for another object. The latter needs a different catalog identity; it is not a schemaVersion or package-version question.

### 3.4. Complete catalog example

The following is a fictional training catalog, not a verified KnotInfo definition. Localized sample strings are retained in both language versions of these shared JSON examples.

```json
{
  "schema": "KnotAsset",
  "schemaVersion": 1,
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  },
  "id": "knot-engine:examples/catalogued-document",
  "subject": {
    "id": "knot-engine:examples/catalogued-subject",
    "names": [{ "language": "uk", "value": "Навчальний приклад" }],
    "identifiers": [
      {
        "catalog": "knot-engine:catalogs/training-knots",
        "value": "A-017"
      }
    ]
  },
  "catalogs": [
    {
      "id": "knot-engine:catalogs/training-knots",
      "name": "Навчальний каталог вузлів",
      "description": "Власний реєстр навчальних конструкцій. Кожна окремо описана конструкція має унікальне позначення; змінені конструкції отримують нові позначення.",
      "identifierRules": {
        "caseSensitive": true,
        "pattern": "^A-[0-9]{3}$"
      }
    }
  ]
}
```

Catalogs explain **how a record is identified**; sources explain **where assertions came from**; category vocabularies explain **what classification terms mean**. A resource may have multiple roles, but references must state the intended one.

## 4. Representations and dependencies

```text
Representation
├── id
├── type
├── target?
├── data
├── views[]?         — inline views or references
├── defaultView?     — selection from views
├── preferredView?   — compact 3D orientation hint
└── sources[]?
```

`type` references a `RepresentationTypeDefinition` selecting the `data` contract, for example `knot-engine:representation-types/pd-code`. Candidate types include diagram-image, planar-diagram, spatial-curve, mosaic-diagram, grid-diagram, pd-code, dt-code and braid-word. Each needs its own orientation, indexing and other conventions; this is not a completed registry.

Omitted `target` means the enclosing subject. An explicit target may be a construction or state. A standalone representation document supplies subject context in its envelope when required. There is no universal requirement for dimension, snapshots, units or elements. A pedagogical classification does not replace structural type.

### Working state organization

A construction contains objects and optionally meaningful states. A static representation describes one state or the subject generally. Multiple representations may share a state. Procedures order states; animation has a separate contract. This needs testing with differently detailed 2D/3D views, reused states and nonphysical mathematical transformations. Independent procedures do not imply banning all temporal formats.

## 5. Constructions, objects and physical quantities

Construction fields are `id`, `objects` and optional `states`, with the same contract standalone, in a registry or inline; an asset may also reference `{ref: URI}`. See [Construction](shared-resources.md#6-construction).

Object kind and role differ: a carabiner can act as a support. Rope ends have stable identity; an inaccessible end is not deleted. Accessibility, constraints and roles belong to state or procedure context; their final placement is open. Physical diameter differs from diagram line width. Geometry refers to objects instead of copying their physical descriptions.

Scale belongs where coordinates gain meaning. Do not infer physical scale during import. Coordinate systems specify axes and orientation. Material position along a rope is distinct from a curve parameter; resampling must not promise stable material `u` without an explicit mapping, which remains open.

## 6. Viewing and initial orientation

Camera, projection, styling and user interaction state have a separate contract, supplied independently by an application. See the [ViewDefinition proposal](shared-resources.md#5-viewdefinition-and-preferredview). `Representation.views` may embed or reference such records; no root views collection is needed.

```json
{
  "preferredView": {
    "direction": [0, 0, 1],
    "up": [0, 1, 0]
  }
}
```

`direction` points from subject to camera in the representation coordinate system. Both vectors are finite, nonzero and noncollinear, normalized when applied without changing stored data. Initial selection order is explicit application settings, defaultView, preferredView, then the component default. Fitting derives center and distance from bounds, projection and viewport; explicit framing may override fitting. User interaction changes viewing state, not authored geometry. Lighting and styling are not fully specified by this camera proposal.

## 7. Procedures

Procedures describe actions and may identify their construction. Steps have IDs, localized instructions and references to multiple representations. Steps, states and illustrations need not correspond one-to-one. A state may be reused across procedures; a procedure may have multiple instructional presentations.

Point order, point count, easing and duration are animation concerns, not universal procedure properties. Mapping steps to multiple instructional presentations still needs validation.

## 8. Properties, relations and classifications

The working direction uses shared assertion collections with typed references:

| Collection | Subject field | Content |
| --- | --- | --- |
| properties | target | Property identity and typed value |
| relations | from, to | Relation type, optional basis and sources |
| classifications | subject | Category reference and optional sources |

Target/subject naming is still subject to consistency review. Exact values, bounds, intervals, unknowns and physical quantities must not collapse into an ambiguous scalar. Methods, conditions and sources are necessary where they affect meaning. A relation type constrains participant kinds and direction; validating its structure does not prove it true. Do not materialize all property matches automatically.

Categories belong to vocabularies; a narrow viewer does not execute classification rules. Category vocabularies are distinct from identification catalogs.

### Reference examples

```json
{
  "id": "derivation-a",
  "type": "https://yuriyapostol.github.io/knot-engine/v1/relations/derived-from",
  "from": { "kind": "representation", "id": "diagram-a" },
  "to": { "kind": "representation", "id": "spatial-a" }
}
```

This states that diagram-a was derived from spatial-a. Both must exist or be declared external dependencies; it makes no assertion about the geometry in other examples.

```json
{
  "id": "classification-a",
  "subject": { "kind": "procedure", "id": "method-a" },
  "category": "https://yuriyapostol.github.io/knot-engine/v1/categories/instructional"
}
```

This separately classifies a procedure. The category URI is a demonstration identity, not a published vocabulary. State/object references need their construction scope; step references need procedure scope. Proposed local `{id: id}` and global `{ref: URI}` forms are distinct. Unifying reference forms across all assertions remains open.

## 9. Standalone use, extraction and composition

```text
Grid / geometry / notation contracts
                  ↓
          Representation contract
                  ↓
             KnotAsset
```

A narrow validator checks its own contract without manufacturing an asset. Root schemas refer to independent subschemas. Consumers may accept: type-specific data; a representation with required context; or a reduced asset containing subject information and selected representations/procedures.

Self-contained extraction follows transitive internal dependencies, such as procedure → representations → states → construction and objects. It does not automatically traverse all relations. For assertions referencing excluded entities, policy may include the target, make the dependency external or omit the assertion; the final policy is still open. No undeclared missing internal reference may remain.

Missing sections and empty arrays do not prove knowledge completeness. A fragment is not a patch; absent fields do not mean deletion. Composition checks identities, ID scopes, contracts and conflicts. Matching local IDs from independent documents do not establish identity. Combining fragments of one document differs from merging independent authored documents; revision and provenance rules need work.

## 10. End-to-end examples

These are syntactically complete proposed JSON documents, not inputs to the current validator. Standard types, categories and object kinds are supplied by external registries for brevity. A self-contained export must include required definitions. Examples do not prove practical or mathematical correctness.

### 10.1. Reduced grid asset

```json
{
  "schema": "KnotAsset",
  "schemaVersion": 1,
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  },
  "dependencies": [
    {
      "kind": "representation-type",
      "ref": "knot-engine:representation-types/grid-diagram"
    }
  ],
  "id": "knot-engine:examples/grid-document",
  "subject": {
    "id": "knot-engine:examples/grid-subject",
    "names": [{ "language": "uk", "value": "Демонстраційний Grid" }]
  },
  "representations": [
    {
      "id": "grid-main",
      "type": "knot-engine:representation-types/grid-diagram",
      "data": {
        "encoding": "xo",
        "size": 2,
        "x": [0, 1],
        "o": [1, 0]
      }
    }
  ]
}
```

No mandatory meters, physical objects or empty technical collections. X/O conventions belong to the grid contract; additional encodings require explicit definitions.

### 10.2. Standalone representation

```json
{
  "schema": "KnotRepresentationDocument",
  "schemaVersion": 1,
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  },
  "dependencies": [
    {
      "kind": "representation-type",
      "ref": "knot-engine:representation-types/grid-diagram"
    }
  ],
  "subject": {
    "id": "knot-engine:examples/grid-subject"
  },
  "representation": {
    "id": "grid-main",
    "type": "knot-engine:representation-types/grid-diagram",
    "data": {
      "encoding": "xo",
      "size": 2,
      "x": [0, 1],
      "o": [1, 0]
    }
  }
}
```

The representation has the same contract as an asset entry. A narrow grid component needs only its data. Physical dependencies require an envelope with included context or declared external dependencies; the full envelope fields are not yet final.

### 10.3. Construction, states and procedure

This deliberately models bending a rope, not a verified practical knot. The two representations have different point counts.

```json
{
  "schema": "KnotAsset",
  "schemaVersion": 1,
  "namespaces": {
    "knot-engine": "https://yuriyapostol.github.io/knot-engine/v1/"
  },
  "dependencies": [
    {
      "kind": "representation-type",
      "ref": "knot-engine:representation-types/spatial-curve"
    }
  ],
  "id": "knot-engine:examples/rope-layout-document",
  "subject": {
    "id": "knot-engine:examples/rope-layout",
    "names": [{ "language": "uk", "value": "Технічна конструкція з мотузкою" }]
  },
  "constructions": [
    {
      "id": "setup-a",
      "objects": [
        {
          "id": "rope-a",
          "type": "knot-engine:object-types/rope",
          "topology": "open",
          "ends": [{ "id": "a" }, { "id": "b" }]
        }
      ],
      "states": [{ "id": "straight" }, { "id": "bent" }]
    }
  ],
  "representations": [
    {
      "id": "straight-spatial",
      "type": "knot-engine:representation-types/spatial-curve",
      "target": { "kind": "state", "construction": { "id": "setup-a" }, "id": "straight" },
      "data": {
        "coordinateSystem": {
          "handedness": "right",
          "upAxis": "y",
          "scale": { "kind": "relative" }
        },
        "curves": [
          {
            "object": "rope-a",
            "closed": false,
            "interpolation": { "type": "polyline" },
            "points": [[-1, 0, 0], [1, 0, 0]]
          }
        ]
      },
      "preferredView": { "direction": [0, 0, 1], "up": [0, 1, 0] }
    },
    {
      "id": "bent-spatial",
      "type": "knot-engine:representation-types/spatial-curve",
      "target": { "kind": "state", "construction": { "id": "setup-a" }, "id": "bent" },
      "data": {
        "coordinateSystem": {
          "handedness": "right",
          "upAxis": "y",
          "scale": { "kind": "relative" }
        },
        "curves": [
          {
            "object": "rope-a",
            "closed": false,
            "interpolation": { "type": "polyline" },
            "points": [[-1, 0, 0], [0, 1, 0], [1, 0, 0]]
          }
        ]
      },
      "preferredView": { "direction": [0, 0, 1], "up": [0, 1, 0] }
    }
  ],
  "procedures": [
    {
      "id": "method-a",
      "construction": { "id": "setup-a" },
      "steps": [
        {
          "id": "start",
          "instructions": { "uk": "Розташуйте мотузку перед собою." },
          "representations": ["straight-spatial"]
        },
        {
          "id": "bend",
          "instructions": { "uk": "Зігніть середню частину мотузки." },
          "representations": ["bent-spatial"]
        }
      ]
    }
  ],
  "classifications": [
    {
      "id": "classification-a",
      "subject": { "kind": "procedure", "id": "method-a" },
      "category": "knot-engine:categories/instructional"
    }
  ]
}
```

No claim is made about physical length, length preservation or valid interpolation between states. Coordinates are relative. The target construction scopes `rope-a`; extracting the procedure retains both representations and the required construction/states.

## 11. Versions, extensions and validation

See [publication policy](publication.md). Until stabilization, keep package and schema versions unchanged, allow structural/API changes, update examples and tests together, and keep examples and tools on the current KnotAsset contract. KnotModelV1 runtime, schemas, APIs, adapters and demo support have been removed. One-time data conversion does not require permanent compatibility adapters.

Shared contract generations do not require a monolithic schema. Fragment entry points remain separate. `schema`, `schemaVersion` and editor `$schema` have defined roles in the resource proposal. Contract generation and package release number differ, but documentation, specifications, schemas and data are published as one package release.

Namespace expansion produces absolute global identities. Definitions are not commands to fetch or execute content. Catalog registries and extension-schema registries serve different purposes. Distinguish validation of known structure, reference consistency, known semantics, preserved but unverified extensions, and renderer support. Validation does not prove mathematical equivalence or practical safety. Implementation resource limits should be explicit profiles, not arbitrary domain definitions.

## 12. Questions for the next review

| Question | Why it matters |
| --- | --- |
| Subject/document identity and revisions | Independent composition and stable external references |
| Registry contents and final resource fields | Real catalog semantics and completed type conventions |
| Placement and minimum meaning of states | Shared 2D/3D states and reuse across procedures |
| Reference contracts and scopes | Unambiguous local, nested and external dependencies |
| Assertions retained by extraction | Avoid missing dependencies or pulling in the whole graph |
| Physical conditions, end accessibility and roles | Distinguish object properties, initial conditions and step changes |
| Representation conventions and parameterization | Interoperable import and implementation |
| Typed properties, conditions and provenance | Distinguish exact results, estimates and measurements |
| preferredView and standalone viewer settings | Orientation, focus, fitting and overrides |
| Extensions beyond the initial profile | Define contracts and tests for additional representations, assertions and animation; legacy removal is complete |

Next scenarios: a practical knot with two procedures, changing end accessibility, a decorative mixed-material construction, a mathematical subject with Grid/PD/properties, and procedure/representation exports with their required assertions.

## 13. Earlier material

The [earlier evolution note](asset-evolution.md) proposed separate diagrams and notations. That organization is superseded by unified representations. Current runtime documentation still describes implemented behavior. The initial profile is implemented and KnotModelV1 support has been removed. Proposals beyond the current specification remain future work; the earlier requirement to retain KnotModelV1 compatibility has been withdrawn.
