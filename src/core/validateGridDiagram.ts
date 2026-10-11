import type { GridDiagram } from './asset'
import type { ValidationIssue } from './legacy'
import { validateKnotAsset } from './validateAsset'

export type GridDiagramValidationResult =
  | { valid: true; diagram: GridDiagram; warnings: string[] }
  | { valid: false; issues: ValidationIssue[] }

/** Validates a standalone grid with the same structural and semantic rules as the asset. */
export function validateGridDiagram(value: unknown, options: { strict?: boolean } = {}): GridDiagramValidationResult {
  const result = validateKnotAsset({
    schema: 'KnotAsset', schemaVersion: 1, id: 'standalone-grid', units: 'm',
    elements: [], representations: [], diagrams: [value]
  }, options)
  if (!result.valid) return {
    valid: false,
    issues: result.issues.map(issue => ({ ...issue, path: issue.path.replace(/^diagrams\[0\]\.?/, '') }))
  }
  return { valid: true, diagram: value as GridDiagram, warnings: result.warnings }
}
