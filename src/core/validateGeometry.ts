import { GEOMETRY_2D, GEOMETRY_3D, type Geometry2DData, type Geometry3DData, type GeometryElement2D, type GeometryElement3D, type CrossingPassage, type StepData } from './knot'
import { duplicates, issue, standalone, type DataResult } from './validation'
import type { ValidationIssue } from './errors'

type Geometry = Geometry2DData | Geometry3DData
type Element = GeometryElement2D | GeometryElement3D

function geometryIssues(data: Geometry, is2d: boolean): ValidationIssue[] {
  const issues = duplicates(data.elements, 'elements')
  let points = 0
  data.elements.forEach((element, i) => {
    if (element.type === 'curve') {
      points += element.points.length
      if (element.closed && element.points.length < 3) issues.push(issue(`elements.${i}.points`, 'Closed curve requires at least three points'))
      element.points.forEach((point, j) => {
        const prev = j ? element.points[j - 1] : element.closed ? element.points.at(-1) : undefined
        if (prev && point.every((n, k) => n === prev[k])) issues.push(issue(`elements.${i}.points.${j}`, 'Repeated consecutive/end point'))
      })
    } else {
      points += element.vertices.length
      element.faces.forEach((face, j) => {
        if (new Set(face).size !== 3 || face.some(n => n >= element.vertices.length)) issues.push(issue(`elements.${i}.faces.${j}`, 'Invalid triangle vertex indices'))
      })
    }
  })
  if (points > 65536) issues.push(issue('elements', 'Point budget exceeded', 'LIMIT_EXCEEDED'))
  if (is2d) {
    const crossings = (data as Geometry2DData).crossings ?? []
    const byId = new Map<string, CrossingPassage[]>()
    const curves = new Set(data.elements.filter(e => e.type === 'curve').map(e => e.id))
    crossings.forEach((passage, i) => {
      if (!curves.has(passage.element)) issues.push(issue(`crossings.${i}.element`, 'Unknown curve'))
      const other = 'underElement' in passage ? passage.underElement : passage.overElement
      if (!other || !curves.has(other)) issues.push(issue(`crossings.${i}`, 'Unknown crossing curve'))
      byId.set(passage.id, [...(byId.get(passage.id) ?? []), passage])
    })
    for (const [id, passages] of byId) {
      if (passages.length !== 2) { issues.push(issue('crossings', `Crossing ${id} must have two passages`)); continue }
      const [a, b] = passages
      const otherA = 'underElement' in a ? a.underElement : a.overElement
      const otherB = 'underElement' in b ? b.underElement : b.overElement
      if (a.element !== otherB || b.element !== otherA || ('underElement' in a) === ('underElement' in b)) issues.push(issue('crossings', `Inconsistent crossing ${id}`))
    }
  }
  return issues
}
export const validateGeometry2D = (value: unknown): DataResult<Geometry2DData> => standalone<Geometry2DData>('geometry2d', value, data => geometryIssues(data, true))
export const validateGeometry3D = (value: unknown): DataResult<Geometry3DData> => standalone<Geometry3DData>('geometry3d', value, data => geometryIssues(data, false))

/** Resolve one step directly against its base, never against a previous step. */
export function applyStepData(base: Geometry, data: StepData, type: typeof GEOMETRY_2D | typeof GEOMETRY_3D): DataResult<Geometry> {
  const errors: ValidationIssue[] = []
  const validData = standalone<StepData>('stepData', data)
  if (!validData.valid) return validData
  if (type === GEOMETRY_3D && data.crossings !== undefined) return { valid: false, issues: [issue('crossings', '3D steps cannot define crossings')] }
  const elements = new Map<string, Element>(base.elements.map(e => [e.id, structuredClone(e)]))
  const touched = new Set<string>()
  for (const id of data.remove ?? []) {
    if (touched.has(id) || !elements.has(id)) errors.push(issue('remove', `Unknown or repeated element: ${id}`))
    touched.add(id); elements.delete(id)
  }
  for (const element of data.replace ?? []) {
    if (touched.has(element.id) || !elements.has(element.id)) errors.push(issue('replace', `Unknown or repeated element: ${element.id}`))
    touched.add(element.id); elements.set(element.id, structuredClone(element))
  }
  for (const element of data.add ?? []) {
    if (touched.has(element.id) || elements.has(element.id)) errors.push(issue('add', `Duplicate element: ${element.id}`))
    touched.add(element.id); elements.set(element.id, structuredClone(element))
  }
  if (errors.length) return { valid: false, issues: errors }
  const result = { ...structuredClone(base), elements: [...elements.values()] } as Geometry
  const dimension = type === GEOMETRY_2D ? 2 : 3
  for (const [i, element] of result.elements.entries()) {
    if (type === GEOMETRY_2D && element.type !== 'curve') return { valid: false, issues: [issue(`elements.${i}`, '2D geometry supports curves only')] }
    if (element.type === 'curve' && element.points.some(point => point.length !== dimension)) return { valid: false, issues: [issue(`elements.${i}.points`, 'Point dimension does not match base')] }
  }
  if (type === GEOMETRY_2D) {
    if (data.crossings !== undefined) (result as Geometry2DData).crossings = structuredClone(data.crossings)
    return validateGeometry2D(result)
  }
  return validateGeometry3D(result)
}
