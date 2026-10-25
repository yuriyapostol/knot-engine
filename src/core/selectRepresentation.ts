import { Asset } from './model'
import { type RawAsset, type RawRepresentation } from './asset'
import { expandURI } from './resources'
import { preflight } from './validation'
import { validateAsset, normalizeAsset, type ValidationOptions } from './validateAsset'

export type RepresentationQuery = { representationId?: string; type?: string }
export type SelectionIssueCode =
  | 'INVALID_ASSET' | 'REPRESENTATION_NOT_FOUND' | 'AMBIGUOUS_REPRESENTATION'
  | 'UNSUPPORTED_REPRESENTATION' | 'MISSING_DEPENDENCY' | 'INVALID_REPRESENTATION'
export interface SelectionIssue { code: SelectionIssueCode; message: string; path?: string }
export type SelectionResult =
  | { ok: true; asset: RawAsset; representation: RawRepresentation; typeUri: string }
  | { ok: false; issues: SelectionIssue[] }
export interface SelectionOptions extends ValidationOptions {
  /** Validate only the selected representation and its context (default), or the entire asset. */
  scope?: 'selected' | 'all'
}

const failure = (code: SelectionIssueCode, message: string, path?: string): SelectionResult =>
  ({ ok: false, issues: [{ code, message, ...(path === undefined ? {} : { path }) }] })

/**
 * Independently select and validate a representation. The root must satisfy
 * the v1 RawAsset structure; unrelated representations and procedures do not
 * prevent targeted selection. The returned asset retains the full context.
 */
export function selectRepresentation(
  asset: RawAsset | Asset,
  query: RepresentationQuery = {},
  options: SelectionOptions = {},
): SelectionResult {
  if (asset instanceof Asset) asset = asset.toRaw()
  // Reject non-JSON values and malformed root structures before inspecting fields.
  const structural = preflight(asset)
  if (!structural.length && (!asset || typeof asset !== 'object' || !Array.isArray(asset.representations))) {
    return failure('INVALID_ASSET', 'Expected RawAsset with representations')
  }
  if (structural.length) return {
    ok: false,
    issues: structural.map(i => ({ code: 'INVALID_ASSET', message: i.message, path: i.path })),
  }

  let normalized: RawAsset, requestedType: string | undefined
  try {
    normalized = normalizeAsset(asset)
    requestedType = query.type === undefined ? undefined : expandURI(query.type, asset.namespaces)
  } catch (error) {
    return failure('INVALID_ASSET', (error as Error).message)
  }

  const byId = query.representationId === undefined
    ? normalized.representations ?? []
    : (normalized.representations ?? []).filter(r => r.id === query.representationId)
  if (!byId.length) return failure('REPRESENTATION_NOT_FOUND', 'Requested representation was not found')
  const matches = requestedType === undefined ? byId : byId.filter(r => r.type === requestedType)
  if (!matches.length) return failure('UNSUPPORTED_REPRESENTATION', 'No representation matches the requested type')
  if (matches.length > 1) return failure('AMBIGUOUS_REPRESENTATION', 'Specify representationId to select one representation')

  const selected = matches[0]
  // Scope only the representation graph needed by this request. Preserve the
  // original full asset in the result for metadata and procedure navigation.
  const target = selected.target
  const localConstructionId = target && target.kind !== 'subject' && target.construction.id
  const sourceIds = new Set((selected.sources ?? []).flatMap(s => 'id' in s && s.id ? [s.id] : []))
  const validationAsset: RawAsset = options.scope === 'all' ? asset : {
    ...asset,
    representations: [asset.representations!.find(r => r.id === selected.id)!],
    procedures: [],
    constructions: (asset.constructions ?? []).filter(c =>
      'ref' in c
        ? target !== undefined && target.kind !== 'subject' && c.ref === target.construction.ref
        : c.id === localConstructionId),
    sources: (asset.sources ?? []).filter(s => sourceIds.has(s.id)),
    // Catalog identifiers belong to subject metadata and remain in scope.
  }
  const checked = validateAsset(validationAsset, options)
  if (!checked.valid) return {
    ok: false,
    issues: checked.issues.map(i => ({
      code: i.path.startsWith('representations.') ? 'INVALID_REPRESENTATION' : 'INVALID_ASSET',
      message: i.message, path: i.path,
    })),
  }
  if (!checked.complete) return {
    ok: false,
    issues: [
      ...checked.missingDependencies.map(d => ({
        code: 'MISSING_DEPENDENCY' as const, message: `Missing ${d.kind}: ${d.ref}`,
      })),
      ...checked.uncheckedTypes.map(type => ({
        code: 'UNSUPPORTED_REPRESENTATION' as const, message: `Unchecked representation type: ${type}`,
      })),
    ],
  }
  return { ok: true, asset: normalized, representation: selected, typeUri: selected.type }
}
