import type { CrossingPassage, PDCode } from './knot'
import { validatePDCode } from './validatePDCode'

/** A visit to a crossing while following one continuous strand. */
export interface PDVisit {
  crossing: number
  /** Incoming slot in the crossing's counterclockwise rotation (0..3). */
  slot: number
  /** Incoming edge label, preserved from the source PD. */
  edge: number
  /** Slots 0 and 2 belong to the underpassing strand. */
  under: boolean
}

export interface PDComponent {
  /** Crossing visits in traversal order; the last visit connects to the first. */
  visits: PDVisit[]
}

/**
 * Extract the oriented strand cycles from a planar PD code.
 *
 * This is the topological stage of PD → 2D. It deliberately does not assign
 * coordinates: a rotation-preserving planar drawing is required before a
 * Geometry2DData can be produced without introducing spurious crossings.
 */
export function tracePDComponents(code: PDCode): PDComponent[] {
  const checked = validatePDCode(code)
  if (!checked.valid) {
    throw new Error(checked.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '))
  }

  const n = code.crossings.length
  const mate = new Int32Array(4 * n)
  const occurrence = new Map<number, number>()
  code.crossings.forEach((crossing, vertex) => crossing.forEach((label, slot) => {
    const h = vertex * 4 + slot
    const previous = occurrence.get(label)
    if (previous === undefined) occurrence.set(label, h)
    else { mate[h] = previous; mate[previous] = h }
  }))

  const opposite = (h: number) => (h & ~3) + ((h + 2) % 4)
  const visited = new Uint8Array(4 * n)
  const components: PDComponent[] = []
  for (let seed = 0; seed < 4 * n; seed++) {
    if (visited[seed]) continue
    const visits: PDVisit[] = []
    let h = seed
    do {
      if (visited[h]) throw new Error('PD strand traversal returned to a different cycle')
      visited[h] = 1
      visited[opposite(h)] = 1
      const vertex = Math.floor(h / 4), slot = h % 4
      visits.push({ crossing: vertex, slot, edge: code.crossings[vertex][slot], under: slot % 2 === 0 })
      h = mate[opposite(h)]
    } while (h !== seed)
    components.push({ visits })
  }
  for (let i = 0; i < (code.unlinkedComponents ?? 0); i++) components.push({ visits: [] })
  return components
}

/**
 * Build ordered crossing records for the 2D contract. The caller must supply
 * a planar drawing whose component orientation follows tracePDComponents().
 * Each crossing contributes exactly two passages, including self-crossings.
 */
export function pdCrossingPassages(code: PDCode): CrossingPassage[] {
  const components = tracePDComponents(code)
  const ids = components.map((_, i) => `component-${i + 1}`)
  const result: CrossingPassage[] = []
  for (let i = 0; i < components.length; i++) {
    for (const visit of components[i].visits) {
      const otherIndex = components.findIndex((component, index) =>
        index !== i && component.visits.some(v => v.crossing === visit.crossing))
      const other = otherIndex < 0 ? ids[i] : ids[otherIndex]
      result.push(visit.under
        ? { id: `crossing-${visit.crossing + 1}`, element: ids[i], overElement: other }
        : { id: `crossing-${visit.crossing + 1}`, element: ids[i], underElement: other })
    }
  }
  return result
}
