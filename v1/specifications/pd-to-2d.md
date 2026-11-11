# PD → 2D conversion

The core exports `convertPDTo2D(code: PDCode): Geometry2DData`.

The converter validates the PD rotation system, traces its closed strands and constructs a planar polyline drawing using a four-port expansion of every crossing. The expanded graph is embedded using fixed convex boundary coordinates and barycentric relaxation. Each crossing is reconstructed by joining opposite ports through a shared centre. Its ordered over/under passages are emitted as `crossings` records.

The input is not mutated. Crossing-free components are represented by separate closed curves. Generated coordinates are relative and not intended to reproduce a particular artistic knot projection.

The converter currently limits drawings to 256 crossings for layout performance. Polyline geometry is intentional: automatic spline smoothing could create unintended intersections. Call `validateGeometry2D` and `locateCrossings` to check geometric consistency before rendering or publishing generated data.

Example:

```ts
import { convertPDTo2D, validateGeometry2D } from 'knot-engine'

const geometry = convertPDTo2D({
  convention: 'pd-ccw-under-first',
  crossings: [[1,5,2,4],[3,1,4,6],[5,3,6,2]],
})
if (!validateGeometry2D(geometry).valid) throw new Error('Invalid 2D geometry')
```

## Viewing

`Knot2DViewer` accepts a `pd-code` representation and converts it automatically. The generic `KnotViewer` also supports `pd-code` via its built-in viewer registry. Specify `representationId` when the knot contains multiple supported representations. The PD input remains unchanged.

CI covers the trefoil, a two-component link, isolated crossings, crossing-free components, and both viewer paths. Passing tests does not constitute a mathematical proof of correctness for every possible PD code.
