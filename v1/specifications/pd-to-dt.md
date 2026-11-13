# PD → DT conversion

`convertPDToDT(input)` converts a validated planar PD diagram into a signed-even Dowker–Thistlethwaite code. It traces components, selects a deterministic parity-compatible starting point, and preserves over/under passages. It does not mutate the source or perform geometry rendering.

```ts
import { convertPDToDT, convertDTToPD } from 'knot-engine'
const dt = convertPDToDT({ convention: 'pd-ccw-under-first', crossings: [[1,5,2,4],[3,1,4,6],[5,3,6,2]] })
const pd = convertDTToPD(dt)
```

The two conversions are **not inverse at the level of literal arrays**: starting point, orientation, component order, crossing labels and planar rotation choices may differ. Compare the resulting diagrams topologically rather than by JSON equality.

The current signed-even DT contract requires each component traversal to have an even number of crossing visits and a consistent global odd/even pairing. PD diagrams outside this subset are rejected explicitly. Crossing-free PD diagrams are not representable by this conversion. The reverse DT → PD search currently supports at most 16 crossings.
