export type ViewerErrorCode = 'INVALID_MODEL' | 'UNSUPPORTED_SCHEMA' | 'LIMIT_EXCEEDED' | 'WEBGL_UNAVAILABLE' | 'CONTEXT_LOST' | 'RENDER_FAILED' | 'CAPTURE_FAILED'
export interface ValidationIssue { path: string; message: string; code: ViewerErrorCode }
export class ViewerError extends Error {
  constructor(public code: ViewerErrorCode, message: string, public issues?: ValidationIssue[], public recoverable = true) { super(message); this.name = 'ViewerError' }
}
