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
