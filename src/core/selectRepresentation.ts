import { type KnotAsset, type Representation } from './asset'
import { expandURI } from './resources'
import { validateKnotAsset, normalizeAsset, type ValidationOptions } from './validateAsset'

export type RepresentationQuery = { representationId?: string; type?: string }
export type SelectionIssueCode =
  | 'INVALID_ASSET' | 'REPRESENTATION_NOT_FOUND' | 'AMBIGUOUS_REPRESENTATION'
  | 'UNSUPPORTED_REPRESENTATION' | 'MISSING_DEPENDENCY' | 'INVALID_REPRESENTATION'
export interface SelectionIssue { code: SelectionIssueCode; message: string; path?: string }
export type SelectionResult =
  | { ok: true; asset: KnotAsset; representation: Representation; typeUri: string }
  | { ok: false; issues: SelectionIssue[] }

/**
 * Select and validate a representation independently of the UI.
 * Validates the complete supplied asset under the existing v1 contract.
 * Partial-asset validation will be added once its schema is defined.
 */
export function selectRepresentation(
  asset: KnotAsset,
  query: RepresentationQuery = {},
  options: ValidationOptions = {},
): SelectionResult {
  const checked = validateKnotAsset(asset, options)
  if (!checked.valid) return {
    ok: false,
    issues: checked.issues.map(i => ({
      code: 'INVALID_ASSET' as const,
      message: i.message,
      path: i.path,
    })),
  }
  if (!checked.complete) return {
    ok: false,
    issues: [
      ...checked.missingDependencies.map(d => ({
        code: 'MISSING_DEPENDENCY' as const,
        message: `Missing ${d.kind}: ${d.ref}`,
      })),
      ...checked.uncheckedTypes.map(type => ({
        code: 'UNSUPPORTED_REPRESENTATION' as const,
        message: `Unchecked representation type: ${type}`,
      })),
    ],
  }
  const normalized = normalizeAsset(checked.asset)
  let typeUri: string | undefined
  if (query.type !== undefined) {
    try {
      typeUri = expandURI(query.type, asset.namespaces)
    } catch (error) {
      return { ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION', message: (error as Error).message }] }
    }
  }
  const byId = query.representationId === undefined
    ? normalized.representations ?? []
    : (normalized.representations ?? []).filter(r => r.id === query.representationId)
  if (!byId.length) return {
    ok: false,
    issues: [{ code: 'REPRESENTATION_NOT_FOUND', message: 'Requested representation was not found' }],
  }
  const matches = typeUri === undefined ? byId : byId.filter(r => r.type === typeUri)
  if (!matches.length) return {
    ok: false,
    issues: [{
      code: typeUri === undefined ? 'REPRESENTATION_NOT_FOUND' : 'UNSUPPORTED_REPRESENTATION',
      message: 'No representation matches the requested type',
    }],
  }
  if (matches.length > 1) return {
    ok: false,
    issues: [{ code: 'AMBIGUOUS_REPRESENTATION', message: 'Specify representationId to select one representation' }],
  }
  return { ok: true, asset: normalized, representation: matches[0], typeUri: matches[0].type }
}
