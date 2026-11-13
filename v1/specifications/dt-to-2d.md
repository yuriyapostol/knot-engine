# DT → 2D conversion

The core exposes `convertDTToPD(input)` and `convertDTTo2D(input)`. Both are **explicit operations**, independent of the Vue viewers.

A signed-even Dowker–Thistlethwaite traversal identifies crossing visits and whether the odd visit passes under (negative entry). It does not itself prescribe the planar rotation at every crossing. The converter searches possible local rotations, validates the resulting planar PD code, and delegates geometry construction to `convertPDTo2D`.

```ts
import { convertDTTo2D, validateGeometry2D } from 'knot-engine'

const geometry = convertDTTo2D({
  convention: 'dt-signed-even',
  code: [4, 6, 2],
})
if (!validateGeometry2D(geometry).valid) throw new Error('Invalid 2D geometry')
```

The converter currently limits the exhaustive rotation search to **16 crossings**. This is an implementation limit, not a DT format limit. Inputs are not mutated. The result is a polyline `2d` geometry representation; it can be stored on a Knot and then rendered by a 2D viewer. No implicit conversion takes place inside viewers.

A DT code may admit more than one planar realization. The converter selects the first valid rotation deterministically; it does not promise a canonical drawing or minimize crossings, bends, or visual complexity.
