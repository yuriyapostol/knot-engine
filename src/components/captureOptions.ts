/** Common capture request. Format availability is viewer-specific. */
export interface CaptureOptions {
  width?: number
  height?: number
  format?: 'image/png' | 'image/svg+xml'
  view?: 'current' | 'model-preview'
  transparent?: boolean
}
