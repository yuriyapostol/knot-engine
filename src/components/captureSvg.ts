import { ViewerError } from '../core/errors'

/** Serialize a prepared SVG, optionally rasterizing it without changing the live viewer. */
export async function captureSvg(svg: SVGSVGElement, format: 'image/png' | 'image/svg+xml', background?: string): Promise<Blob> {
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  if (format === 'image/svg+xml') return blob
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Number(svg.getAttribute('width'))
    canvas.height = Number(svg.getAttribute('height'))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')
    if (background) {
      context.fillStyle = background
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('PNG encoding failed')
    return png
  } catch (error) {
    throw new ViewerError('CAPTURE_FAILED', error instanceof Error ? error.message : 'PNG capture failed')
  } finally {
    URL.revokeObjectURL(url)
  }
}
