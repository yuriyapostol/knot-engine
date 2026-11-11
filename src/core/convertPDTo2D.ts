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
    const vertexSet = new Set(vertices)
    // Local planar port graph: two square neighbours and one PD edge.
    const neighbours = new Map<number, number[]>()
    for (const h of vertices) {
      const c = h & ~3, s = h % 4
      neighbours.set(h, [c + (s + 3) % 4, c + (s + 1) % 4, edge[h]])
    }
    // Enumerate faces using the port rotation [previous, next, edge].
    const visited = new Set<string>(), faces: number[][] = []
    for (const h of vertices) for (const next of neighbours.get(h)!) {
      const key = `${h}:${next}`
      if (visited.has(key)) continue
      const face: number[] = []
      let from = h, to = next
      do {
        const k = `${from}:${to}`
        if (visited.has(k)) throw new Error('Invalid expanded PD rotation')
        visited.add(k)
        face.push(from)
        const ring = neighbours.get(to)!
        const at = ring.indexOf(from)
        if (at < 0) throw new Error('Invalid expanded PD edge')
        const following = ring[(at + 1) % ring.length]
        from = to; to = following
      } while (from !== h || to !== next)
      faces.push(face)
    }
    // Select the four-port face of the first crossing as the exterior.
    const root = group[0], outer = [4*root, 4*root+1, 4*root+2, 4*root+3]
    const outerSet = new Set(outer)
    const outerIndex = faces.findIndex(face => face.length === 4 &&
      face.every(h => outerSet.has(h)))
    if (outerIndex < 0) throw new Error('Cannot find crossing boundary face')
    const fixed = new Map<number, Point2D>()
    const size = Math.max(4, Math.sqrt(group.length) * 4)
    outer.forEach((h, i) => fixed.set(h, [
      offset + size * [0, 1, 1, 0][i],
      size * [0, 0, 1, 1][i],
    ]))
    // Triangulate the non-exterior faces by connecting a face centre to
    // each boundary vertex. Tutte's spring embedding then places the
    // expanded planar graph inside the fixed convex exterior.
    const adjacency = new Map<number, Set<number>>()
    for (const h of vertices) adjacency.set(h, new Set(neighbours.get(h)))
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
