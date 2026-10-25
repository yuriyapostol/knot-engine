import type { PDCode } from './knot'
import { issue, standalone } from './validation'

/** Validate the specified spherical rotation system, not merely graph planarity. */
export function validatePDCode(value: unknown, _options: { strict?: boolean } = {}) {
  let componentCount = 0
  const result = standalone<PDCode>('pd', value, data => {
    const n = data.crossings.length, count = 4*n
    componentCount = data.unlinkedComponents ?? 0
    if (!n) return componentCount ? [] : [issue('crossings', 'Expected at least one link component')]
    const occurrences = new Map<number, number[]>()
    data.crossings.forEach((crossing, c) => crossing.forEach((label, slot) => {
      const list = occurrences.get(label) ?? []
      list.push(4*c+slot); occurrences.set(label, list)
    }))
    const edge = new Int32Array(count)
    for (const [label, ends] of occurrences) {
      if (ends.length !== 2) return [issue('crossings', `Edge label ${label} must occur exactly twice`)]
      edge[ends[0]] = ends[1]; edge[ends[1]] = ends[0]
    }
    const opposite = (h: number) => (h & ~3) + ((h+2)%4)
    const next = (h: number) => (h & ~3) + ((h+1)%4)
    // Connected components of the underlying crossing graph.
    const graph = new Int32Array(n).fill(-1), vertices: number[] = []
    for (let c = 0; c < n; c++) {
      if (graph[c] !== -1) continue
      const id = vertices.length, stack = [c]; vertices.push(0); graph[c] = id
      while (stack.length) {
        const v = stack.pop()!; vertices[id]++
        for (let s = 0; s < 4; s++) {
          const neighbor = Math.floor(edge[4*v+s]/4)
          if (graph[neighbor] === -1) { graph[neighbor] = id; stack.push(neighbor) }
        }
      }
    }
    const seenFaces = new Uint8Array(count), faces = vertices.map(() => 0)
    for (let h = 0; h < count; h++) {
      if (seenFaces[h]) continue
      faces[graph[Math.floor(h/4)]]++
      let current = h
      do { seenFaces[current] = 1; current = next(edge[current]) } while (current !== h)
    }
    // E = 2V, hence V-E+F = F-V must equal 2 on each sphere.
    if (faces.some((f,i) => f-vertices[i] !== 2)) return [issue('crossings', 'PD rotation system is not planar')]
    // Opposite half-edges and the two ends of each edge have opposite directions.
    const direction = new Int8Array(count)
    const propagate = (seed: number): boolean => {
      const stack = [seed]
      if (direction[seed] === 1) return false
      if (direction[seed] === -1) return true
      direction[seed] = -1
      while (stack.length) {
        const h = stack.pop()!
        for (const other of [opposite(h), edge[h]]) {
          const wanted = -direction[h]
          if (direction[other] && direction[other] !== wanted) return false
          if (!direction[other]) { direction[other] = wanted; stack.push(other) }
        }
      }
      return true
    }
    for (let c = 0; c < n; c++) if (!propagate(4*c)) return [issue(`crossings.${c}`, 'Inconsistent incoming underpass directions')]
    // Trace each strand cycle once; crossings do not join opposite strands.
    const seen = new Uint8Array(count)
    for (let h = 0; h < count; h++) {
      if (seen[h]) continue
      componentCount++
      let current = h
      while (!seen[current]) {
        seen[current] = seen[opposite(current)] = 1
        current = edge[opposite(current)]
      }
    }
    return []
  })
  return result.valid ? { ...result, code: result.data, componentCount, crossingCount: result.data.crossings.length } : result
}
