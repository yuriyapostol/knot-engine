# Dowker–Thistlethwaite code

Implemented numeric DT profile for a single-component closed knot diagram. Link/multicomponent DT, alphabetical encodings, explicit embedding choices, layout, conversion and rendering are separate work.

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

The empty array explicitly denotes one crossing-free unknot, with component count 1 and crossing count 0. Arrays of component arrays and component-length fields are not accepted. Do not concatenate multicomponent DT data into a single array: that changes its traversal semantics. For links, use another supported representation until a separate DT profile is defined.

## Realizability and semantic validation

Permutation and parity checks alone are insufficient. For example `[4,6,8,10,2]` is structurally admissible but not realizable by a generic closed curve on the sphere/plane.

Construct the double-occurrence word by placing crossing i at positions 2i+1 and `abs(code[i])`. Two crossings are interlaced if exactly one endpoint of either chord lies strictly between the endpoints of the other. Let A be the zero-diagonal adjacency matrix of this interlacement graph over GF(2).

By Shtylla–Traldi–Zulli, Theorem 2, the word is planar-realizable exactly when a diagonal D exists such that (A+D)²=A+D. The implementation checks equivalent conditions:

1. Every vertex has even degree.
2. Nonadjacent vertices have an even number of common neighbors.
3. For each adjacent pair i,j, solve dᵢ XOR dⱼ = 1 XOR parity(common neighbors). All these binary constraints must be consistent.

Rows are packed into 32-bit words; row intersections compute common-neighbor parity. An iterative parity disjoint-set structure solves the constraints without enumerating diagonal choices. Signs do not enter this shadow-realizability test: over/under can be assigned independently to the two visits of every realizable crossing. Signs are still validated and preserved in the data.

This establishes existence of a planar realization, not a unique drawing or knot identity. DT does not necessarily determine handedness or the embedding/assembly of composite diagrams unambiguously. Negating entries exchanges the recorded over/under visits, but validation does not identify that operation with a unique catalog mirror. No writhe, chirality, minimum crossing number, prime decomposition or equivalence to another representation is inferred. `complete:true` means this supported contract and its dependencies were checked, not that a unique oriented knot was reconstructed.

## Limits and API

`validateDTCode(data)` returns `{valid:false,issues}` or `{valid:true,data,code,warnings,componentCount,crossingCount}`. The `code` result aliases the validated data object, as with the PD validator. Inputs are not mutated; the counts describe the stored diagram. Independent [JSON Schema](schema/dt-code.schema.json) checks fields, numeric bounds, parity and shape; runtime additionally checks the permutation and full realizability criterion.

`KNOT_ASSET_LIMITS.dtCrossings` is 512 crossings per code. Entries are consequently structurally bounded to ±1024; runtime tightens them to ±2n for the actual length. Packed adjacency storage uses O(n²/32+n) machine words. Worst-case analysis takes O(n³/32+n² log n) operations. No recursive traversal or exponential embedding search is used.

Before analyzing an asset, the implementation sums n²·ceil(n/32) across all DT representations, after namespace normalization, and requires it not exceed `KNOT_ASSET_LIMITS.dtWork` = 4,194,304. A standalone code of size at most 512 is within that budget. Thus multiple individually admissible codes may exceed the aggregate asset budget. General JSON budgets (depth 64, 262,144 entries, strings up to 1,048,576 characters) also apply. These limits are implementation budgets, not mathematical limits on DT notation.

## KnotAsset integration and attribution

Use the ordinary `Representation` envelope, including targets, `sources` and flat `contributions`. Shared source definitions and a global license belong to KnotAsset; see [metadata](sources.md). Dates, notes and source identifiers are independent of DT traversal numbers.

The standard type has `viewSpace:"none"`: this code does not contain coordinates or a preferred camera. Nonempty views and `preferredView` are incompatible; default-view membership follows ordinary rules. Completeness requires available type/source resources, for example through `STANDARD_RESOURCES` plus any user sources. Supported DT does not enter `uncheckedTypes`. Standalone representation documents, scoped targets, selection and same-document composition use ordinary rules and preserve signed code order and attribution. Equivalent codes are not deduplicated automatically. The 3D resolver and KnotViewer continue to require spatial curves.

## Sources, decisions and checked examples

* [KnotInfo DT Notation](https://linkinfo.knotinfo.org/descriptions/dt_notation.html) defines the odd/even pairing and negative sign when the odd visit is under. Its signed 11-crossing example is `[16,18,20,-22,4,2,8,-6,12,10,-14]`.
* [Knot Atlas DT Codes](https://katlas.org/wiki/DT_(Dowker-Thistlethwaite)_Codes) uses the equivalent negative-even-over rule, gives `[4,6,2]` as a conversion example, and explicitly discusses mirror ambiguity and multicomponent extensions. Those extensions are not silently adopted by this single-component contract.
* Shtylla, Traldi and Zulli, [On the realization of double occurrence words](https://arxiv.org/abs/0709.2933), Theorem 2 and Proposition 1, supply the realizability criterion. Bit packing, parity constraints, bounds and this JSON wrapper are local implementation decisions.

See the self-contained [trefoil-source example](examples/assets/dt-trefoil.json) and [crossing-free unknot](examples/assets/dt-unknot.json). The trefoil designation records source attribution, not independent classification or a chirality choice. Both examples include attribution where appropriate.

Tests cover signed sourced examples, reducible diagrams, empty code, invalid numeric data, permutations and nonrealizable words, budgets, metadata, resource completeness, namespaces, scoped targets, unsupported views and selection/composition. For every even permutation through six crossings, an independent oracle enumerates local graph rotations and checks Euler face counts; its decisions agree with the matrix criterion. Enumeration is test-only and never used at runtime.
