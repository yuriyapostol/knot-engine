# KnotInfo representations: source data and proposed contracts

Status: research for the [`KnotAsset` redesign](knot-asset-draft.md). Sources were checked on 12 October 2026. Original formats and proposed JSON adaptations are distinguished below; documentation does not imply implemented importers or renderers.

## 1. What the page actually provides

The [3_1 diagrams page](https://knotinfo.org/diagram_display.php?3_1) provides:

| Label | Actual data | Proposed representation |
| --- | --- | --- |
| KnotScape | PNG | `diagram-image`; structural diagram separately if original data can be obtained |
| SnapPy | SVG with cubic Bezier paths | `diagram-image`; SnapPea/PLink projection for editable diagrams |
| 3D | JavaScript XYZ array and curve construction settings | `spatial-curve` with explicit interpolation |
| Grid | SVG and a coordinate list in the knot record | `grid-diagram` with encoding profiles |
| Minimal mosaic and tile diagrams | PNG; structured mosaics in the author's repository | `mosaic-diagram` with a defined tile set |

Type identities use `https://yuriyapostol.github.io/knot-engine/v1/representation-types/<name>`. Images preserve appearance but do not guarantee topology data. Software names describe provenance. Minimum mosaic dimensions and minimum occupied tile count are distinct properties, not necessarily distinct representation types.

## 2. Planar diagrams: images, geometry and PD

### Original images

Checked sources: [KnotScape PNG](https://knotinfo.org/Diagrams_All_Folders/diagrams_knotscape/3_1.png), [SnapPy SVG](https://knotinfo.org/Diagrams_All_Folders/diagrams_snappy/3_1.svg). The SVG has `viewBox` `14.000 14.000 472.000 472.000` and six paths using `M`/`C` commands. Gaps visually encode underpasses; the file contains no separate crossing graph or PD code.

Proposed `diagram-image.data` requires `mediaType` (initially `image/png` or `image/svg+xml`) and `content`, exactly one of `{uri: URL}` or `{base64: string}`; `description` is optional. This is our container for an existing file, not a topology format. URI content is an external dependency; autonomous export includes its bytes. Topological analysis is not promised.

The page uses CSS `scaleX(-1)` on the same files for mirrored KnotScape/SnapPy/Grid images. These are not additional original models. A change of diagram chirality must not be hidden as an ordinary camera rotation and automatically assigned to the same subject.

### Real editable SnapPea/PLink format

[PLink](https://snappy.computop.org/plink.html) represents planar diagrams as vertices, directed edges and crossings. `_from_string` and `SnapPea_projection_file` in the [source](https://github.com/3-manifolds/PLink/blob/33715420c59090cda4ae8bd13745ba2a442a1d63/src/plink/manager.py) define the text format:

```text
% Link Projection
<number of components>
<first vertex index> <last vertex index>       (per component)
<number of vertices>
<x> <y>                                      (per vertex)
<number of directed edges>
<start vertex index> <end vertex index>       (per edge)
<number of crossings>
<under edge index> <over edge index>          (per crossing)
<active vertex index or -1>
```

Indices are zero-based. A closed component has equal first/last indices. `% Virtual Link Projection` prefixes crossing pairs with `v` or `r`; that semantic difference must not be discarded.

Proposed `planar-diagram.data` has `vertices` `[x,y][]`, `edges` `[start,end][]`, `crossings` `{under,over}[]`, `components` `{start,end}[]`, and an explicit 2D coordinate system. The initial profile covers ordinary crossings only. Virtual crossings need another shape and validation; unsupported input must be rejected. Active vertex is editor state, not topology.

This adaptation preserves geometry and explicit over/under needed by editing/rendering; it does not invent layout from PD alone. Validate indices, nonzero edges, component ordering, geometric crossing consistency, and absence of ambiguous touching/overlapping segments. Numerical tolerance remains open. Preserve original text as provenance: the PLink writer formats integer coordinates, so exact export of arbitrary fractional geometry is not guaranteed.

The inspected KnotInfo page does not link the source `.lnk` for this specific `3_1` SVG. Availability of the PLink format does not prove lossless reverse conversion of that SVG.

### PD and DT as separate representations

The [3_1 record](https://knotinfo.org/results.php?searchmode=singleknot&submittype=singleknot&singleknot=3_1) contains:

```json
{
  "pd": [[1, 5, 2, 4], [3, 1, 4, 6], [5, 3, 6, 2]],
  "dt": [4, 6, 2]
}
```

This extracts two original values; it does not propose putting both in one `representation.data`. Under the [KnotInfo PD convention](https://knotinfo.org/descriptions/pd_notation.html), four labels go counterclockwise starting at the incoming underpassing arc. Implemented [PD data](../v1/specifications/pd-code.md) has a fixed `convention` URI, `crossings` as positive-integer quadruples and optional `unlinkedComponents`, preserving source labels. It encodes a combinatorial diagram, not drawing coordinates; validation checks repeated labels, the planar rotation system and underpass direction consistency.

The implemented knot-only [DT profile](../v1/specifications/dt-code.md) uses `convention` and `code`, with signs and traversal tied to the [KnotInfo DT description](https://knotinfo.org/descriptions/dt_notation.html). Do not mix package conventions because their arrays look alike. [Spherogram](https://snappy.computop.org/spherogram.html) documents its own PD rules and orientation caveats. The profile checks planar realizability but does not reconstruct a unique PD embedding; `[4,6,2]` is not a universal context-free format. Multicomponent DT and embedding choices remain separate work.

## 3. Spatial curve

The [page HTML](https://knotinfo.org/diagram_display.php?3_1) contains 79 XYZ points. The first, `[0.9008,-0.1947,0.0825]`, is not repeated at the end. The page subtracts the mean, constructs `THREE.CatmullRomCurve3` and sets `closed` `true`. The [Three.js version loaded by the page](https://knotinfo.org/Diagrams_All_Folders/diagrams_3d/three.js) defaults to `centripetal` interpolation (r132).

The `spatial-curve` adaptation must preserve `points`, closure and exact parameterization, for example `{type: "catmull-rom", parameterization: "centripetal"}`. Uniform and chordal require different explicit values. Uniform Catmull–Rom with `tension: 0.5` is not an interchangeable substitute.

Source coordinates have no physical units and remain relative. Centering should remain a viewing operation or be recorded as an import transform. Tube radius `0.02` and tessellation are display settings, not verified physical diameter. Camera settings belong to `ViewDefinition`. The page credits Se-Goo Kim and Jaehyun Park for the geometry.

## 4. Mosaics: mathematical model and real data

Primary source: Lomonaco and Kauffman, [Quantum Knots and Mosaics](https://arxiv.org/abs/0805.0339), definition 1 and the tile figure on PDF page 5. A mosaic is a square matrix of 11 oriented tile types. Neighbor ports match; a closed knot has no connections through the outer boundary.

[Aaron Heap's site](https://www.geneseo.edu/knotmosaics) links the [source repository](https://github.com/amheap/knot-mosaics). Inspected tree `4d1c78ea5a1e8cf4783806f822c63e9bf3c1aaac`:

- [allKnots.csv](https://github.com/amheap/knot-mosaics/blob/4d1c78ea5a1e8cf4783806f822c63e9bf3c1aaac/websiteFunctions/flaskApp/allKnots.csv) has `OtherName`, `Name`, `Vector`, `Crossings`, `Mosaic`, `TileNum`.
- [mosaic_drawing.py](https://github.com/amheap/knot-mosaics/blob/4d1c78ea5a1e8cf4783806f822c63e9bf3c1aaac/pythonFiles/mosaic_drawing.py) defines codes 0–10 and row-major placement.
- [base_dt_make](https://github.com/amheap/knot-mosaics/blob/4d1c78ea5a1e8cf4783806f822c63e9bf3c1aaac/base_dt_make) defines `layoutDict` templates. Some CSV vectors encode only variable cells, so arbitrary vectors cannot simply be reshaped into squares.

The `3_1` row contains a complete 16-value vector, yielding:

```json
{
  "tileSet": "https://yuriyapostol.github.io/knot-engine/v1/tile-sets/lomonaco-kauffman-11",
  "tiles": [
    [0, 2, 1, 0],
    [2, 9, 10, 1],
    [3, 10, 8, 4],
    [0, 3, 4, 0]
  ]
}
```

The `tileSet` and `tiles` wrapper are **our proposed JSON serialization**, not the original CSV format or an already published definition. The numbers come from the table. This is the author's example for the same catalog knot; no byte-level equivalence with the KnotInfo PNG is asserted.

N/E/S/W mean top/right/bottom/left; rows run downwards. The paper and drawing implementation agree on:

| Code | Connections |
| --- | --- |
| 0 | Empty |
| 1 / 2 / 3 / 4 | W–S / S–E / N–E / N–W |
| 5 / 6 | W–E / N–S |
| 7 | W–S and N–E, no crossing |
| 8 | N–W and S–E, no crossing |
| 9 | W–E over N–S |
| 10 | N–S over W–E |

Mosaic data requires `tileSet` and a nonempty square `tiles` matrix; size is derived rather than duplicated. A tile-set definition specifies allowed codes, ports, over/under and coordinate conventions. Initially only this set is proposed; equal integers do not make another set compatible.

Validate matrix shape, codes, neighboring ports and closed boundaries, then trace components. The example has 12 occupied tiles, three crossings and one closed component. Minimality is a separate sourced assertion. Minimum-size and minimum-tile examples remain the same representation type with different properties.

## 5. Grid: preserve the source encoding

KnotInfo provides a [Grid description](https://knotinfo.org/descriptions/grid_notation.html), [3_1 SVG](https://knotinfo.org/Diagrams_All_Folders/diagrams_grid/grid3_1.svg) and this notation:

```json
[[1,1],[1,3],[2,2],[2,4],[3,3],[3,5],[4,1],[4,4],[5,2],[5,5]]
```

These are ten endpoints on a 5×5 grid, two per row/column, not X/O arrays. Verticals pass over horizontals. The SVG maps the second coordinate downward. Conversion to upward mathematical coordinates must record the transform rather than silently mirror data.

One `grid-diagram` type now supports `xo` and `vertex-pairs`, both zero-based with fixed axis and crossing conventions. Source conventions are adapted during import. X/O specifies orientation; `vertex-pairs` does not. See the [grid diagram specification](../v1/specifications/grid-diagram.md) for the implemented contracts.

## 6. Recommended order

1. `diagram-image` for source appearance and `planar-diagram` for editable geometry with explicit crossings.
2. `pd-code` for layout-independent combinatorial diagrams; generated layout is not an original source image.
3. `spatial-curve` with exact closure and parameterization.
4. `mosaic-diagram` backed by mathematical definitions and real structured fixtures.
5. Both grid encodings and single-component numeric DT are implemented; multicomponent DT and other notations require separate contracts and convention checks.

This is a proposed order, not a universal user priority. Practical users may favor geometry and illustrated procedures; researchers may favor combinatorial codes and mosaics. None requires a separate root `diagrams` collection. Each import needs primary-source fixtures and preservation checks for geometry, closure, components, crossings, orientation and provenance. Mathematical equivalence remains a separate task.
