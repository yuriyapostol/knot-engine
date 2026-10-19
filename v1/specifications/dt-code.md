# Dowker–Thistlethwaite code

Implemented numeric DT profile for closed knot and link diagrams. The representation type and sign convention are unchanged. Alphabetical encodings, explicit embedding choices, layout, conversion and rendering are separate work.

## Identity and contract

Type: `https://yuriyapostol.github.io/knot-engine/v1/representation-types/dt-code`.

`data` is exactly:

```json
{
  "convention": "https://yuriyapostol.github.io/knot-engine/v1/conventions/dt-signed-even",
  "code": [4, 6, 2]
}
```

For n crossings, traversing the oriented circle visits crossings 1 through 2n. `code[i]` pairs odd visit 2i+1 with even visit `abs(code[i])`. Absolute values must permute 2,4,…,2n, without duplicates. Entries are nonzero signed even integers. A positive entry means the odd visit passes over (the even visit under); a negative entry means the odd visit passes under (the even visit over). This sign is not the crossing's oriented writhe sign.

Traversal numbering is one-based and is intrinsic to DT; these numbers are visit labels, not zero-based storage indices. No reordering, sign normalization, cyclic shift or reversal is performed. The fixed absolute `convention` URI identifies this local wrapper/convention; it is neither a resource reference nor a namespace-expanded field. It never triggers a network request.

`code` accepts either a flat numeric array for one component or a nonempty array of component arrays. Mixed shapes are rejected. For example, the Knot Atlas link `L7n2` uses:

```json
{
  "convention": "https://yuriyapostol.github.io/knot-engine/v1/conventions/dt-signed-even",
  "code": [[6, -8], [-10, 12, -14, 2, -4]]
}
```

Numbering continues globally across components without resetting. Flattening the component lists gives the even partners of odd visits 1,3,…,2n−1. A component list of length m specifies 2m consecutive visits of that component, which closes to its own first visit. It does not enumerate only that component's self-crossings: partners may lie on other components. The global absolute values must still permute 2,4,…,2n. Component order and boundaries are preserved; concatenating lists into a flat array changes the traversal semantics. The same source sign convention applies.

The legacy `[]` explicitly denotes one crossing-free unknot. `[[]]` has the same meaning; `[[],[]]` denotes two crossing-free unlinked circles. Each empty component list adds one split trivial circle and consumes no traversal labels. Such circles can also accompany components with crossings. These empty-list semantics are a local JSON contract, not a claim that every external DT importer uses them. The empty link (zero components) is not representable. No canonicalization between flat and nested single-component forms is performed. Component-length fields are not accepted.

## Realizability and semantic validation

Permutation and parity checks alone are insufficient. For example `[4,6,8,10,2]` is structurally admissible but not realizable by a generic closed curve on the sphere/plane.

For nested codes, construct one cyclic double-occurrence word per component using its visit interval. Apply the digon reduction of Archdeacon–Bokal–Gologranc, Lemma 2.3 and Corollary 2.5: words xU and xV sharing a crossing become xyUxyV, with a fresh letter y. Repetition leaves one word per connected crossing graph; split graphs are checked independently and empty circles need no matrix. This preserves existence of a planar shadow and retains the original component closures during validation. Temporary letters are internal and never added to stored data.

For a flat code, construct the double-occurrence word by placing crossing i at positions 2i+1 and `abs(code[i])`. For every word to be checked, two crossings are interlaced if exactly one endpoint of either chord lies strictly between the endpoints of the other. Let A be the zero-diagonal adjacency matrix of this interlacement graph over GF(2).

By Shtylla–Traldi–Zulli, Theorem 2, the word is planar-realizable exactly when a diagonal D exists such that (A+D)²=A+D. The implementation checks equivalent conditions:

1. Every vertex has even degree.
2. Nonadjacent vertices have an even number of common neighbors.
3. For each adjacent pair i,j, solve dᵢ XOR dⱼ = 1 XOR parity(common neighbors). All these binary constraints must be consistent.

Rows are packed into 32-bit words; row intersections compute common-neighbor parity. An iterative parity disjoint-set structure solves the constraints without enumerating diagonal choices. Signs do not enter this shadow-realizability test: over/under can be assigned independently to the two visits of every realizable crossing. Signs are still validated and preserved in the data.

This establishes existence of a planar realization, not a unique drawing or knot identity. DT does not necessarily determine handedness or the embedding/assembly of composite diagrams unambiguously. Negating entries exchanges the recorded over/under visits, but validation does not identify that operation with a unique catalog mirror. No writhe, chirality, minimum crossing number, prime decomposition or equivalence to another representation is inferred. `complete:true` means this supported contract and its dependencies were checked, not that a unique oriented knot was reconstructed.

## Limits and API

`validateDTCode(data)` returns `{valid:false,issues}` or `{valid:true,data,code,warnings,componentCount,crossingCount}`. The `code` result aliases the validated data object, as with the PD validator. Inputs are not mutated; the counts describe the stored diagram. Independent [JSON Schema](../schema/dt-code.schema.json) checks fields, numeric bounds, parity and shape; runtime additionally checks the permutation and full realizability criterion.

`KNOT_ASSET_LIMITS.dtCrossings` is 512 total stored crossings across all component lists. `KNOT_ASSET_LIMITS.dtComponents` is 512 components, including empty ones. Schema bounds each list and numeric values to ±1024; runtime checks the total crossing count and tightens values to ±2n. For a connected crossing graph with nⱼ crossings and kⱼ nonempty components, reduction introduces kⱼ−1 temporary letters, giving rⱼ=nⱼ+kⱼ−1. Matrices use O(rⱼ²/32+rⱼ) machine words; analysis takes O(rⱼ³/32+rⱼ² log rⱼ) operations. The straightforward iterative reduction adds O((n+k)²) preprocessing in the worst case. No recursive traversal or exponential embedding search is used.

Before matrix analysis, sum rⱼ²·ceil(rⱼ/32) over reduced words, then over all DT representations after namespace normalization. This must not exceed `KNOT_ASSET_LIMITS.dtWork` = 4,194,304, both for standalone validation and for an entire asset. Flat codes through 512 crossings still fit individually. A connected link may reach the work limit earlier because of temporary letters; disconnected graphs are budgeted separately. General JSON budgets (depth 64, 262,144 entries, strings up to 1,048,576 characters) also apply. These are implementation budgets, not mathematical limits on DT notation.

## KnotAsset integration and attribution

Use the ordinary `Representation` envelope, including targets, `sources` and flat `contributions`. Shared source definitions and a global license belong to KnotAsset; see [metadata](sources.md). Dates, notes and source identifiers are independent of DT traversal numbers.

The standard type has `viewSpace:"none"`: this code does not contain coordinates or a preferred camera. Nonempty views and `preferredView` are incompatible; default-view membership follows ordinary rules. Completeness requires available type/source resources, for example through `STANDARD_RESOURCES` plus any user sources. Supported DT does not enter `uncheckedTypes`. Standalone representation documents, scoped targets, selection and same-document composition use ordinary rules and preserve signed code order and attribution. Equivalent codes are not deduplicated automatically. The 3D resolver and KnotViewer continue to require spatial curves.

## Sources, decisions and checked examples

* [KnotInfo DT Notation](https://linkinfo.knotinfo.org/descriptions/dt_notation.html) defines the odd/even pairing and negative sign when the odd visit is under. Its signed 11-crossing example is `[16,18,20,-22,4,2,8,-6,12,10,-14]`.
* [Knot Atlas DT Codes](https://katlas.org/wiki/DT_(Dowker-Thistlethwaite)_Codes) uses the equivalent negative-even-over rule, gives `[4,6,2]` as a conversion example, and explicitly discusses mirror ambiguity and multicomponent extensions. Its component subdivision is adopted here as nested arrays with global numbering.
* Shtylla, Traldi and Zulli, [On the realization of double occurrence words](https://arxiv.org/abs/0709.2933), Theorem 2 and Proposition 1, supply the realizability criterion. Bit packing, parity constraints, bounds and this JSON wrapper are local implementation decisions.
* Archdeacon, Bokal and Gologranc, [A characterization of plane Gauss paragraphs](https://doi.org/10.26493/1855-3974.844.66f), Lemma 2.3 and Corollary 2.5, justify reducing component words before the existing word criterion. This is a shadow criterion; DT signs are not writhe signs.

See the self-contained [trefoil-source example](../examples/assets/dt-trefoil.json), [crossing-free unknot](../examples/assets/dt-unknot.json), [Knot Atlas link](../examples/assets/dt-link.json) and [crossing-free unlink](../examples/assets/dt-unlink.json). The trefoil designation records source attribution, not independent classification or a chirality choice. All examples include attribution where appropriate.

Tests cover signed sourced examples, reducible diagrams, empty code, invalid numeric data, permutations and nonrealizable words, budgets, metadata, resource completeness, namespaces, scoped targets, unsupported views and selection/composition. For every even permutation through six crossings, an independent oracle enumerates local graph rotations and checks Euler face counts; its decisions agree with the matrix criterion. Enumeration is test-only and never used at runtime.

An independent rotation/Euler oracle also checks all 2,141 even permutations and component partitions through five crossings, including disconnected crossing graphs. Link tests cover intercomponent crossings, the sourced signed example, empty components, immutable input, nested selection/composition and budgets including temporary letters.
