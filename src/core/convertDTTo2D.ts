import type { DTCode, PDCode, Geometry2DData, PDCrossing } from './knot'
import { validateDTCode } from './validateDTCode'
import { validatePDCode } from './validatePDCode'
import { convertPDTo2D } from './convertPDTo2D'

/**
 * Recover a planar rotation system from a signed-even Dowker–Thistlethwaite
 * traversal, then use the independent PD layout algorithm.
 *
 * DT signs determine which visit goes under, not the planar handedness.
 * We therefore search the two local rotations at each crossing and accept
 * only a spherical embedding. This bounded exhaustive implementation is
 * intended for small and medium diagrams, not arbitrary-sized DT codes.
 */
export function convertDTToPD(input: DTCode): PDCode {
  const checked = validateDTCode(input)
  if (!checked.valid) throw new Error(checked.issues[0]?.message ?? 'Invalid DT code')
  const parts = input.code.length && Array.isArray(input.code[0])
    ? input.code as number[][] : [input.code as number[]]
  const entries = parts.flat(), n = entries.length
  if (n > 16) throw new Error('DT → PD conversion currently supports at most 16 crossings')
  if (!n) throw new Error('DT without crossings has no unambiguous PD representation')

  // Visit indices are global: odd visit 2*i and even visit |DT[i]|-1
  // belong to crossing i. Each component's visit interval is cyclic.
  const owner = new Int32Array(2*n)
  const under = new Uint8Array(2*n)
  entries.forEach((entry, i) => {
    const odd = 2*i, even = Math.abs(entry)-1
    owner[odd] = owner[even] = i
    under[entry < 0 ? odd : even] = 1
  })
  const successor = new Int32Array(2*n)
  let start = 0
  for (const part of parts) {
    const length = 2*part.length
    for (let k = 0; k < length; k++) successor[start+k] = start+(k+1)%length
    start += length
  }

  // For each visit: incoming and outgoing ports, opposite at its crossing.
  // The underpass always uses slots 0 and 2. Overpass uses 1 and 3;
  // its orientation is the binary rotation choice for that crossing.
  const crossings: PDCrossing[] = Array.from({ length: n }, () => [0,0,0,0])
  const incoming = new Int32Array(2*n)
  const outgoing = new Int32Array(2*n)
  for (let mask = 0; mask < 2**n; mask++) {
    for (let visit = 0; visit < 2*n; visit++) {
      const c = owner[visit]
      const slot = under[visit] ? 0 : (mask & (1<<c)) ? 3 : 1
      incoming[visit] = slot
      outgoing[visit] = (slot+2)%4
    }
    for (let visit = 0; visit < 2*n; visit++) {
      const label = visit+1
      crossings[owner[visit]][outgoing[visit]] = label
      const next = successor[visit]
      crossings[owner[next]][incoming[next]] = label
    }
    const candidate: PDCode = { convention: 'pd-ccw-under-first', crossings }
    if (validatePDCode(candidate).valid) return {
      convention: candidate.convention,
      crossings: crossings.map(c => [...c] as PDCrossing),
    }
  }
  throw new Error('No planar PD rotation found for this DT traversal')
}

/** Convert a signed-even DT diagram to an explicit 2D polyline representation. */
export function convertDTTo2D(input: DTCode): Geometry2DData {
  return convertPDTo2D(convertDTToPD(input))
}
