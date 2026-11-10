# Image representations and PLink import

## Image data

Use the built-in `image` representation for a raster or vector file, without treating pixels as knot topology:

```json
{"mimeType":"image/svg+xml","src":"./images/trefoil.svg"}
```

`src` accepts HTTPS, relative paths or `data:` URLs with matching MIME types. The browser loads the resource; cross-origin restrictions can prevent PNG capture. `KnotImageViewer` is the image renderer; `KnotViewer` delegates to it.

## 2D crossing kinds

In `2d` geometry, crossing passages may use `classical` (also the default when `type` is omitted), `unknown`, or `virtual`. Classical passages use `underElement`/`overElement`; the other kinds use `otherElement`. The pair of passages must agree on the crossing identity and kind.

## Import PLink text

PLink is an **input format**, not a Knot representation type. Import it using `knot-engine/core`:

```ts
import { parsePLinkProjection, importPLink2D } from 'knot-engine/core'

const source = `% Link Projection
2
0 1
2 3
4
0 0
10 10
0 10
10 0
2
0 1
2 3
1
0 1
-1`
const projection = parsePLinkProjection(source)
const data = importPLink2D(source)
// Use data as the data field of a representation whose type is 2d.
```

`parsePLinkProjection` exposes vertices, directed edges, crossings and source component metadata. `importPLink2D` produces 2D polyline curves and ordered crossing passages, combining consecutive edges into connected open/closed curves. `% Virtual Link Projection` supports `r` and `v` crossing prefixes.

To test with a real file, read its **text** into `source` and call `importPLink2D(source)`; then attach the returned `data` to a Knot's `2d` representation and render it with `Knot2DViewer` or `KnotViewer`. The current interactive demo has no dedicated PLink file-import control. An SVG or PNG exported from PLink is **not** PLink projection text.

The importer checks format and geometry constraints, but has not been validated against a broad external fixture corpus. It does not export PLink text or guarantee lossless round trips. In particular, inspect self-crossings and component orientation before relying on a conversion for topology.

For source-format background, see [representation research](../../design/representation-formats.md).
