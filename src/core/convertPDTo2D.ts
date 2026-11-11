import type { Geometry2DData, PDCode, Point2D } from './knot'
import { tracePDComponents, pdCrossingPassages } from './tracePDComponents'

/**
 * Draw a PD rotation system through a barycentric embedding of its expanded
 * planar graph. Each crossing is expanded to a four-port face; the original
 * strands are restored by connecting opposite ports through its centre.
 *
 * Layout is deliberately polyline-only: spline smoothing could introduce
 * intersections absent from the PD. An embedding that collapses a port or
 * produces an unexpected crossing is rejected rather than silently changed.
 */
export function convertPDTo2D(code: PDCode): Geometry2DData {
  const components = tracePDComponents(code)
  const n = code.crossings.length
  if (n > 256) throw new Error('PD → 2D layout supports at most 256 crossings')
  const points: Point2D[] = Array.from({ length: n * 4 }, () => [0, 0])
  const edge = new Int32Array(n * 4)
  const labels = new Map<number, number>()
  code.crossings.forEach((crossing, c) => crossing.forEach((label, s) => {
    const h = 4 * c + s, other = labels.get(label)
    if (other === undefined) labels.set(label, h)
    else { edge[h] = other; edge[other] = h }
  }))
  // Connected components of the underlying crossing graph.
  const seen = new Uint8Array(n)
  const groups: number[][] = []
  for (let root = 0; root < n; root++) {
    if (seen[root]) continue
    const stack = [root], group: number[] = []
    seen[root] = 1
    while (stack.length) {
      const c = stack.pop()!
      group.push(c)
      for (let s = 0; s < 4; s++) {
        const other = Math.floor(edge[4 * c + s] / 4)
        if (!seen[other]) { seen[other] = 1; stack.push(other) }
      }
    }
    groups.push(group)
  }

  let offset = 0
  for (const group of groups) {
    const vertices = group.flatMap(c => [4*c, 4*c+1, 4*c+2, 4*c+3])
    // Each port has three distinct darts. Unlike a neighbour map, darts
    // distinguish parallel edges (including a PD edge along a square side).
    const target = new Int32Array(n * 12)
    const reverse = new Int32Array(n * 12)
    const dart = (h: number, slot: number) => h * 3 + slot
    for (const h of vertices) {
      const c = h & ~3, slot = h % 4
      target[dart(h, 0)] = c + (slot + 3) % 4
      target[dart(h, 1)] = c + (slot + 1) % 4
      target[dart(h, 2)] = edge[h]
      reverse[dart(h, 0)] = dart(c + (slot + 3) % 4, 1)
      reverse[dart(h, 1)] = dart(c + (slot + 1) % 4, 0)
      reverse[dart(h, 2)] = dart(edge[h], 2)
    }
    const visited = new Set<number>(), faces: number[][] = []
    for (const h of vertices) for (let slot = 0; slot < 3; slot++) {
      const seed = dart(h, slot)
      if (visited.has(seed)) continue
      const face: number[] = []
      let current = seed
      do {
        if (visited.has(current)) throw new Error('Invalid expanded PD rotation')
        visited.add(current)
        face.push(Math.floor(current / 3))
        const reversed = reverse[current]
        current = dart(Math.floor(reversed / 3), (reversed % 3 + 1) % 3)
      } while (current !== seed)
      faces.push(face)
    }
    // The crossing-square faces contain the crossing centres and must not
    // become the exterior. Prefer a non-square face with a simple boundary.
    const squareFace = (face: number[]) => face.length === 4 &&
      face.every(h => (h & ~3) === (face[0] & ~3))
    const outerIndex = faces.findIndex(face => !squareFace(face) &&
      face.length >= 3 && new Set(face).size === face.length)
    if (outerIndex < 0) throw new Error('No simple exterior face for PD layout')
    const outer = faces[outerIndex]
    const fixed = new Map<number, Point2D>()
    const size = Math.max(4, Math.sqrt(group.length) * 4)
    outer.forEach((h, i) => {
      const angle = 2 * Math.PI * i / outer.length
      fixed.set(h, [offset + size * (1 + Math.cos(angle)), size * (1 + Math.sin(angle))])
    })
    // Triangulate the non-exterior faces by connecting a face centre to
    // each boundary vertex. Tutte's spring embedding then places the
    // expanded planar graph inside the fixed convex exterior.
    const adjacency = new Map<number, Set<number>>()
    for (const h of vertices) adjacency.set(h, new Set([target[dart(h, 0)], target[dart(h, 1)], target[dart(h, 2)]]))
    let nextId = n * 4
    const centres: number[] = []
    for (let f = 0; f < faces.length; f++) {
      if (f === outerIndex) continue
      const centre = nextId++
      centres.push(centre)
      adjacency.set(centre, new Set(faces[f]))
      for (const h of faces[f]) adjacency.get(h)!.add(centre)
    }
    const positions = new Map<number, Point2D>()
    for (const [h, p] of fixed) positions.set(h, [...p])
    for (const h of [...vertices, ...centres]) {
      if (!positions.has(h)) positions.set(h, [offset + size/2, size/2])
    }
    // Gauss-Seidel relaxation converges for connected graphs with anchors.
    for (let iteration = 0; iteration < 12000; iteration++) {
      let change = 0
      for (const [h, adjacent] of adjacency) {
        if (fixed.has(h)) continue
        let x = 0, y = 0
        for (const other of adjacent) {
          const p = positions.get(other)!
          x += p[0]; y += p[1]
        }
        const next: Point2D = [x / adjacent.size, y / adjacent.size]
        const prior = positions.get(h)!
        change = Math.max(change, Math.hypot(next[0] - prior[0], next[1] - prior[1]))
        positions.set(h, next)
      }
      if (change < 1e-11) break
    }
    for (const h of vertices) points[h] = positions.get(h)!
    offset += size + 4
  }

  const centre = (c: number): Point2D => {
    const ps = points.slice(4*c, 4*c+4)
    return [ps.reduce((v,p)=>v+p[0],0)/4, ps.reduce((v,p)=>v+p[1],0)/4]
  }
  const elements: Geometry2DData['elements'] = components.map((component, index) => {
    if (!component.visits.length) {
      const x = offset + index * 4
      return { id: `component-${index+1}`, type: 'curve', closed: true,
        interpolation: { type: 'polyline' }, points: [[x,0],[x+1,0],[x+1,1],[x,1]] }
    }
    const vertices: Point2D[] = []
    for (const visit of component.visits) {
      const incoming = 4*visit.crossing + visit.slot
      const outgoing = 4*visit.crossing + (visit.slot+2)%4
      vertices.push(points[incoming], centre(visit.crossing), points[outgoing])
    }
    return { id: `component-${index+1}`, type: 'curve', closed: true,
      interpolation: { type: 'polyline' }, points: vertices }
  })
  return {
    coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } },
    elements,
    crossings: pdCrossingPassages(code),
  }
}
