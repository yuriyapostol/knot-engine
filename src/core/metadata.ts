import type { Contribution, License, SourceFields } from './asset'
import { issue } from './validation'
import type { ValidationIssue } from './errors'

function urlIssues(url: string | undefined, path: string): ValidationIssue[] {
  if (url === undefined) return []
  try {
    const parsed = new URL(url)
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || /\s/.test(url)) throw new Error()
    return []
  } catch { return [issue(path, 'Expected an absolute HTTP(S) URL')] }
}
function dateIssues(date: string | undefined, path: string): ValidationIssue[] {
  if (date === undefined) return []
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? [] : [issue(path, 'Expected a valid calendar date YYYY-MM-DD')]
}
export function licenseIssues(license: License | undefined, path: string): ValidationIssue[] {
  return urlIssues(license?.url, `${path}.url`)
}
export function sourceIssues(source: SourceFields, path: string): ValidationIssue[] {
  const issues = [...urlIssues(source.url,`${path}.url`), ...dateIssues(source.accessed,`${path}.accessed`), ...licenseIssues(source.license,`${path}.license`)]
  source.authors?.forEach((a,i) => issues.push(...urlIssues(a.url,`${path}.authors.${i}.url`)))
  return issues
}
export function contributionIssues(contributions: Contribution[] | undefined, path: string): ValidationIssue[] {
  return (contributions ?? []).flatMap((c,i) => [...urlIssues(c.url,`${path}.${i}.url`), ...dateIssues(c.date,`${path}.${i}.date`)])
}
