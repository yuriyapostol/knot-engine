import type { SpatialCurveData, ViewDefinition, Construction, RopeObject } from './asset'
import { ROPE_TYPE } from './asset'
import { duplicates, issue, parallel, standalone, structure } from './validation'
import type { ValidationIssue } from './errors'
export function validateSpatialCurve(value: unknown) {
  return standalone<SpatialCurveData>('spatial', value, data => {
    const issues = duplicates(data.curves, 'curves')
    let points = 0
    data.curves.forEach((curve, i) => {
      points += curve.points.length
      if (curve.closed && curve.points.length < 3) issues.push(issue(`curves.${i}.points`, 'Closed curve requires at least three points'))
      curve.points.forEach((p, j) => {
        const previous = j ? curve.points[j-1] : curve.closed ? curve.points.at(-1) : undefined
        if (previous && p.every((n,k) => n === previous[k])) issues.push(issue(`curves.${i}.points.${j}`, 'Repeated consecutive/end point'))
      })
    })
    if (points > 65536) issues.push(issue('curves', 'Point budget exceeded', 'LIMIT_EXCEEDED'))
    return issues
  })
}
export function viewIssues(view: ViewDefinition): ValidationIssue[] {
  if (view.space === 'plane') return []
  const c = view.camera, direction = c.mode === 'fit' ? c.direction : c.position.map((n,i) => n-c.target[i])
  return parallel(direction, c.up) ? [issue('camera', 'Direction and up must be nonzero and noncollinear')] : []
}
export const validateView = (value: unknown) => standalone<ViewDefinition>('view', value, viewIssues)
export function constructionIssues(c: Construction): ValidationIssue[] {
  const issues = [...duplicates(c.objects,'objects'), ...duplicates(c.states ?? [], 'states')]
  c.objects.forEach((object,i) => {
    if (object.type !== ROPE_TYPE) return
    const errors = structure('rope', object)
    issues.push(...errors.map(e => ({ ...e, path: `objects.${i}.${e.path}` })))
    if (errors.length) return
    const rope = object as RopeObject
    if (rope.ends.length !== (rope.topology === 'open' ? 2 : 0)) issues.push(issue(`objects.${i}.ends`, 'Open rope requires two ends; closed rope has none'))
    issues.push(...duplicates(rope.ends,`objects.${i}.ends`))
  })
  return issues
}
