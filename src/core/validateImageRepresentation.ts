import { standalone, issue, type DataResult } from './validation'
import type { ImageRepresentationData } from './knot'
export function validateImageRepresentation(value: unknown): DataResult<ImageRepresentationData> {
  return standalone<ImageRepresentationData>('imageRepresentation', value, data => {
    const src = data.src.trim()
    if (/^data:/i.test(src)) {
      const match = /^data:([^;,]+)(?:;base64)?,/i.exec(src)
      if (!match || match[1].toLowerCase() !== data.mimeType.toLowerCase())
        return [issue('src', 'Data URL MIME type does not match mimeType')]
      return []
    }
    if (/^https:\/\//i.test(src) || /^(?:\.\.?\/|\/)?[^:/?#]+(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/.test(src)) return []
    return [issue('src', 'Expected HTTPS URL, relative path or data URL')]
  })
}
