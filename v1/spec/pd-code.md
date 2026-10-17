# Planar diagram code

Implemented data and semantic validation profile. PD describes combinatorial crossings and connections, not drawing coordinates. Rendering, layout generation, recognition and conversion are separate work.

## Identity and data

Representation type: `https://yuriyapostol.github.io/knot-engine/v1/representation-types/pd-code`.

`data` is a closed object:

| Field | Contract |
| --- | --- |
| `convention` | Required exact URI `https://yuriyapostol.github.io/knot-engine/v1/conventions/pd-ccw-under-first` |
| `crossings` | Required array of integer quadruples `[a,b,c,d]`; may be empty |
| `unlinkedComponents` | Optional nonnegative integer, default 0: additional split trivial circles without crossings |

For each crossing, slots 0–3 list half-edges counterclockwise, starting at the incoming underpassing half-edge. Opposite slots 0/2 form the underpassing strand, slots 1/3 the overpassing strand. A crossing is not a four-way strand junction. Equal labels connect exactly two half-edges; a label may occur twice at the same crossing, as in a Reidemeister-I loop. Requiring four distinct labels would incorrectly reject such diagrams.

Edge labels are positive safe integers (1 through 9,007,199,254,740,991), not array indices. Arbitrary gaps and bijective relabeling are allowed. Labels from source PD codes are preserved, including one-based numbering. The validator does not require consecutive numbering along components or sort crossings. `convention` is an absolute, fixed type-specific URI; it is not expanded through namespaces and creates no resource dependency or network request.

`unlinkedComponents` explicitly preserves circles that an empty crossing list cannot encode. With no crossings, it must be at least 1. Empty links are outside this profile. It can also accompany a nonempty code. These circles are additional split unknots, not unlabeled edges or virtual crossings; no nesting, position, component names or orientations are stored for them.

## Semantic validation

After bounded JSON and structural validation:

1. Require every used edge label to occur exactly twice. Open ends and higher-valence edges are invalid.
2. Form the edge-pairing involution α on half-edges and counterclockwise rotation σ within each quadruple. For each connected component of the crossing graph, count face cycles of σ∘α and require V−E+F=2 (E=2V). This checks the specified spherical rotation system, not just the existence of some planar embedding of the abstract graph. Handles/virtual diagrams are rejected. Disconnected crossing graphs are allowed; each is checked separately.
3. Check that slot 0 can consistently be incoming at every crossing. Direction flips across an edge and across opposite slots. Contradictory underpass directions are invalid. This is a consistency check, not an inference from numerical label order.
4. Trace strand cycles through opposite slots and edge pairings, counting each once. Add `unlinkedComponents` to obtain the total component count. Require at least one component.

A component with an underpass has its orientation constrained by slot 0. Components passing only over other strands have no such constraint; numerical labels are treated as identities, not as an extra orientation rule. Do not claim complete oriented-link reconstruction for every code, or equivalence to source-specific orientation/order conventions. Explicit orientation metadata or a stricter convention can be introduced separately.

The algorithm is iterative, using O(n) time and storage for n crossings. `KNOT_ASSET_LIMITS.pdCrossings` is 16,384 crossings per code and in aggregate per KnotAsset, checked before topology analysis. The structural schema also bounds crossing arrays at 16,384 and `unlinkedComponents` at 16,384. General JSON limits remain depth 64, 262,144 entries and strings up to 1,048,576 characters. These are implementation budgets, not knot invariants.

`validatePDCode(data)` returns `{valid:false,issues}` or `{valid:true,data,code,warnings,componentCount,crossingCount}`. Counts describe this diagram, not a minimum crossing number or a proof of knot identity. No writhe, chirality, catalog identity or polynomial invariant is inferred.

## KnotAsset integration

Use the ordinary representation envelope, including scoped targets and dependencies. The standard resource has `viewSpace:"none"`: PD has no layout or coordinate system. Nonempty `views`, a `defaultView` without a member view and `preferredView` are rejected by the ordinary view rules. No mapping from counted link components to construction objects is implied.

Both standalone representation documents and KnotAsset use the supported semantic validator. Completeness additionally requires resource closure, for example via `STANDARD_RESOURCES`; supported PD does not enter `uncheckedTypes`. The [standalone JSON Schema](schema/pd-code.schema.json) checks structure only; repeated-label multiplicity, planarity, direction consistency and component existence require runtime validation.

Validation, extraction, JSON round trips and same-document composition preserve labels, crossing order and explicit `unlinkedComponents` without normalization. Equivalent relabelings are not automatically deduplicated. The existing 3D resolver and `KnotViewer` still require spatial curves; validation completeness does not imply renderer support.

## Sources and examples

The local convention follows the crossing order in [KnotInfo PD Notation](https://linkinfo.knotinfo.org/descriptions/pd_notation.html) and [Knot Atlas Planar Diagrams](https://katlas.org/wiki/Planar_Diagrams). Our wrapper, relaxed edge numbering and `unlinkedComponents` are project conventions, not a verbatim external file format.

KnotInfo numbers edges consecutively along oriented components. Our profile accepts those labels but does not enforce that extra numbering rule. KnotTheory wraps tuples in `PD[X[...],...]`; these tokens are not stored here. [Spherogram](https://snappy.computop.org/spherogram.html) also accepts PD codes, uses zero-based labels by default and documents orientation caveats. Do not assume every external array uses the same indexing, cyclic order or orientation; adapt explicitly. A zero-based source needs explicit positive relabeling for this profile.

The [trefoil example](examples/assets/pd-trefoil.json) uses the PD value recorded in the project's source research:

```json
{
  "convention": "https://yuriyapostol.github.io/knot-engine/v1/conventions/pd-ccw-under-first",
  "crossings": [[1, 5, 2, 4], [3, 1, 4, 6], [5, 3, 6, 2]]
}
```

KnotInfo's documented two-component L4a1{0} example is `[[6,1,7,2],[8,3,5,4],[2,5,3,6],[4,7,1,8]]`. Both examples are checked for planarity and component counts. Catalog labels are source attribution, not independent recognition. The [unlink example](examples/assets/pd-unlink.json) has `crossings:[]` and `unlinkedComponents:2`.

Acceptance tests include sourced knots and links, reflections with corresponding cyclic-order changes, split crossing graphs, Reidemeister-I loops, crossing-free components, arbitrary positive relabeling, invalid multiplicities and nonplanar rotation systems, inconsistent directions, malformed JSON, limits, resource completeness, namespace expansion, unsupported views, extraction and composition.
