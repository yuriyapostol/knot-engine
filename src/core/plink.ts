/** PLink's textual projection format, kept separate from knot representation types. */
export interface PLinkProjection {
  virtual: boolean
  components: Array<{ first: number; last: number }>
  vertices: Array<[number, number]>
  edges: Array<[number, number]>
  crossings: Array<{ type: 'classical' | 'virtual'; underEdge: number; overEdge: number }>
  activeVertex: number | null
}

export function parsePLinkProjection(source: string): PLinkProjection {
  if (typeof source !== 'string') throw new Error('PLink source must be text')
  const lines = source.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean)
  let position = 0
  const header = lines[position++]
  if (header !== '% Link Projection' && header !== '% Virtual Link Projection')
    throw new Error('Unsupported PLink projection header')
  const virtual = header === '% Virtual Link Projection'
  const next = (label: string): string => {
    const line = lines[position++]
    if (line === undefined) throw new Error(`Missing PLink ${label}`)
    return line
  }
  const integer = (value: string, label: string): number => {
    if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new Error(`Invalid PLink ${label}`)
    const number = Number(value)
    if (!Number.isSafeInteger(number)) throw new Error(`Invalid PLink ${label}`)
    return number
  }
  const count = (label: string) => {
    const value = integer(next(label), label)
    if (value > 100000) throw new Error(`PLink ${label} exceeds limit`)
    return value
  }
  const pair = (label: string): [string, string] => {
    const parts = next(label).split(/\s+/)
    if (parts.length !== 2) throw new Error(`Invalid PLink ${label}`)
    return [parts[0], parts[1]]
  }
  const componentCount = count('component count')
  const components = Array.from({ length: componentCount }, () => {
    const [a, b] = pair('component')
    return { first: integer(a, 'component start'), last: integer(b, 'component end') }
  })
  const vertexCount = count('vertex count')
  const vertices: Array<[number, number]> = Array.from({ length: vertexCount }, () => {
    const [a, b] = pair('vertex')
    const x = Number(a), y = Number(b)
    if (!a || !b || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid PLink vertex')
    return [x, y]
  })
  for (const component of components)
    if (component.first >= vertexCount || component.last >= vertexCount)
      throw new Error('PLink component references missing vertex')
  const edgeCount = count('edge count')
  const edges: Array<[number, number]> = Array.from({ length: edgeCount }, () => {
    const [a, b] = pair('edge')
    const start = integer(a, 'edge start'), end = integer(b, 'edge end')
    if (start >= vertexCount || end >= vertexCount || start === end)
      throw new Error('PLink edge references missing or identical vertices')
    return [start, end]
  })
  const crossingCount = count('crossing count')
  const crossings: PLinkProjection['crossings'] = Array.from({ length: crossingCount }, () => {
    const raw = next('crossing').split(/\s+/)
    const kind = virtual ? raw.shift() : 'r'
    if (raw.length !== 2 || (kind !== 'r' && kind !== 'v'))
      throw new Error('Invalid PLink crossing')
    const underEdge = integer(raw[0], 'under edge'), overEdge = integer(raw[1], 'over edge')
    if (underEdge >= edgeCount || overEdge >= edgeCount || underEdge === overEdge)
      throw new Error('PLink crossing references invalid edges')
    return { type: kind === 'v' ? 'virtual' : 'classical', underEdge, overEdge }
  })
  const active = next('active vertex')
  const activeVertex = active === '-1' ? null : integer(active, 'active vertex')
  if (activeVertex !== null && activeVertex >= vertexCount) throw new Error('PLink active vertex is missing')
  if (position !== lines.length) throw new Error('Unexpected trailing PLink content')
  return { virtual, components, vertices, edges, crossings, activeVertex }
}

/**
 * Convert PLink's edge-based drawing to existing 2D curves.
 * Edge identity is preserved in the generated curve IDs; each crossing
 * contributes one ordered passage on each incident edge.
 */
export function importPLink2D(source: string): import('./knot').Geometry2DData {
  const projection = parsePLinkProjection(source)
  // Follow directed edges to form connected components instead of losing
  // topology by treating every PLink edge as a separate rope.
  const outgoing = new Map<number, number[]>(), incoming = new Map<number, number[]>()
  projection.edges.forEach(([a, b], i) => {
    outgoing.set(a, [...(outgoing.get(a) ?? []), i])
    incoming.set(b, [...(incoming.get(b) ?? []), i])
  })
  for (let vertex = 0; vertex < projection.vertices.length; vertex++) {
    if ((outgoing.get(vertex)?.length ?? 0) > 1 || (incoming.get(vertex)?.length ?? 0) > 1)
      throw new Error('PLink projection has branching or duplicate directed edges')
  }
  const visited = new Set<number>()
  const paths: Array<{ edges: number[]; vertices: number[]; closed: boolean }> = []
  const follow = (start: number) => {
    const edgeIds: number[] = [], vertices: number[] = [projection.edges[start][0]]
    let current: number | undefined = start
    while (current !== undefined && !visited.has(current)) {
      visited.add(current)
      edgeIds.push(current)
      const nextVertex: number = projection.edges[current][1]
      vertices.push(nextVertex)
      current = outgoing.get(nextVertex)?.[0]
    }
    const closed = vertices.at(-1) === vertices[0]
    if (current !== undefined && !closed) throw new Error('PLink edges form an inconsistent component')
    if (closed) vertices.pop()
    paths.push({ edges: edgeIds, vertices, closed })
  }
  projection.edges.forEach(([start], i) => { if (!visited.has(i) && !incoming.has(start)) follow(i) })
  projection.edges.forEach((_, i) => { if (!visited.has(i)) follow(i) })
  const edgeMap = new Map<number, string>()
  const elements: import('./knot').InterpolatedCurve2D[] = paths.map((path, index) => {
    const id = `component-${index}`
    path.edges.forEach(edge => edgeMap.set(edge, id))
    return { id, type: 'curve', closed: path.closed, interpolation: { type: 'polyline' },
      points: path.vertices.map(vertex => projection.vertices[vertex]) }
  })
  const visits: Array<{ edge: number; t: number; crossing: import('./knot').CrossingPassage }> = []
  const intersection = (a: number, b: number): [number, number] => {
    const [a0, a1] = projection.edges[a], [b0, b1] = projection.edges[b]
    const [p, q, r, s] = [projection.vertices[a0], projection.vertices[a1], projection.vertices[b0], projection.vertices[b1]]
    const ux = q[0] - p[0], uy = q[1] - p[1], vx = s[0] - r[0], vy = s[1] - r[1]
    const det = ux * vy - uy * vx
    if (Math.abs(det) <= 1e-12 * Math.hypot(ux, uy) * Math.hypot(vx, vy))
      throw new Error('PLink crossing edges must intersect transversely')
    const dx = r[0] - p[0], dy = r[1] - p[1]
    const ta = (dx * vy - dy * vx) / det, tb = (dx * uy - dy * ux) / det
    if (ta <= 0 || ta >= 1 || tb <= 0 || tb >= 1)
      throw new Error('PLink crossing must lie inside both edges')
    return [ta, tb]
  }
  projection.crossings.forEach((crossing, i) => {
    const [underT, overT] = intersection(crossing.underEdge, crossing.overEdge)
    const id = `crossing-${i}`
    const under = edgeMap.get(crossing.underEdge)!, over = edgeMap.get(crossing.overEdge)!
    if (crossing.type === 'virtual') {
      visits.push({ edge: crossing.underEdge, t: underT, crossing: { id, element: under, type: 'virtual', otherElement: over } })
      visits.push({ edge: crossing.overEdge, t: overT, crossing: { id, element: over, type: 'virtual', otherElement: under } })
    } else {
      visits.push({ edge: crossing.underEdge, t: underT, crossing: { id, element: under, type: 'classical', overElement: over } })
      visits.push({ edge: crossing.overEdge, t: overT, crossing: { id, element: over, type: 'classical', underElement: under } })
    }
  })
  visits.sort((a, b) => {
    const first = paths.findIndex(path => path.edges.includes(a.edge))
    const second = paths.findIndex(path => path.edges.includes(b.edge))
    return first - second || paths[first].edges.indexOf(a.edge) - paths[second].edges.indexOf(b.edge) || a.t - b.t
  })
  return {
    coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } },
    elements,
    crossings: visits.map(visit => visit.crossing),
  }
}
