import type { DTCode, PDCode } from './knot'
import { tracePDComponents } from './tracePDComponents'
import { validateDTCode } from './validateDTCode'

/**
 * Encode an oriented PD traversal as signed-even DT. Each component must
 * have an even number of visits; the start parity of each component is
 * chosen to give opposite parity to the two visits of every crossing.
 * No geometry is constructed and the input is not mutated.
 */
export function convertPDToDT(input: PDCode): DTCode {
  const components = tracePDComponents(input)
  const n = input.crossings.length
  if (components.some(component => component.visits.length % 2 !== 0)) {
    throw new Error('PD components with odd visit counts cannot use this signed-even DT convention')
  }
  if (!n) throw new Error('Crossing-free PD has no signed-even DT encoding')
  const occurrences: { component: number; index: number }[][] =
    Array.from({ length: n }, () => [])
  components.forEach((component, c) => component.visits.forEach((visit, index) => {
    occurrences[visit.crossing].push({ component: c, index })
  }))
  const constraints: { other: number; parity: number }[][] =
    components.map(() => [])
  occurrences.forEach((pair, crossing) => {
    if (pair.length !== 2) throw new Error(`Crossing ${crossing} must have two visits`)
    const [a, b] = pair
    const parity = 1 ^ (a.index & 1) ^ (b.index & 1)
    constraints[a.component].push({ other: b.component, parity })
    constraints[b.component].push({ other: a.component, parity })
  })
  const flips = new Int8Array(components.length).fill(-1)
  for (let root = 0; root < components.length; root++) {
    if (flips[root] !== -1) continue
    flips[root] = 0
    const stack = [root]
    while (stack.length) {
      const current = stack.pop()!
      for (const edge of constraints[current]) {
        const wanted = flips[current] ^ edge.parity
        if (flips[edge.other] !== -1) {
          if (flips[edge.other] !== wanted) {
            throw new Error('PD traversal has no consistent signed-even DT numbering')
          }
        } else { flips[edge.other] = wanted; stack.push(edge.other) }
      }
    }
  }
  const visits = components.map((component, c) => {
    const list = component.visits
    return flips[c] && list.length ? [...list.slice(1), list[0]] : [...list]
  })
  const labels = new Map<number, { number: number; under: boolean }[]>()
  let offset = 0
  for (const component of visits) {
    component.forEach((visit, i) => {
      const list = labels.get(visit.crossing) ?? []
      list.push({ number: offset+i+1, under: visit.under })
      labels.set(visit.crossing, list)
    })
    offset += component.length
  }
  const entries = new Array<number>(n)
  for (const pair of labels.values()) {
    const odd = pair.find(p => p.number % 2 === 1)
    const even = pair.find(p => p.number % 2 === 0)
    if (!odd || !even) throw new Error('PD to DT parity mismatch')
    entries[(odd.number-1)/2] = odd.under ? -even.number : even.number
  }
  const parts: number[][] = []
  let index = 0
  for (const component of visits) {
    const count = component.length/2
    parts.push(entries.slice(index,index+count))
    index += count
  }
  const result: DTCode = {
    convention: 'dt-signed-even',
    code: parts.length === 1 ? parts[0] : parts,
  }
  const checked = validateDTCode(result)
  if (!checked.valid) throw new Error(checked.issues[0]?.message ?? 'Generated DT code failed validation')
  return result
}
