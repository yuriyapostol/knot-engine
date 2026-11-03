import type { Curve2D, CurveSegment2D, Point2D, SegmentedCurve2D } from './knot'
import { curveControlPoints2D, curvePath2D, mapCurve2D } from './curves2d'

/** Direction of Y in the external path. Knot coordinates always use Y up. */
export interface SVGPath2DOptions { yAxis: 'up' | 'down' }
export interface SVGPath2DImportOptions extends SVGPath2DOptions { idPrefix: string }

function checkOptions(options: SVGPath2DOptions) {
  if (!options || (options.yAxis !== 'up' && options.yAxis !== 'down')) throw new Error('SVG path requires an explicit yAxis: up or down')
}

/** Import SVG path data (not SVG markup). Arcs are rejected; subpaths become separate curves. */
export function importSVGPath2D(d: string, options: SVGPath2DImportOptions): SegmentedCurve2D[] {
  checkOptions(options)
  if (!options.idPrefix?.trim()) throw new Error('SVG path requires a nonempty idPrefix')
  if (d.length > 1_000_000) throw new Error('SVG path input budget exceeded')
  // Preserve commas to reject malformed separators instead of silently repairing input.
  const tokens: string[] = []
  const token = /[a-zA-Z]|,|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y
  let offset = 0
  while (offset < d.length) {
    if (/[\x20\t\r\n]/.test(d[offset])) { offset++; continue }
    token.lastIndex = offset
    const match = token.exec(d)
    if (!match) throw new Error(`Invalid SVG path at character ${offset}`)
    tokens.push(match[0]); offset = token.lastIndex
    if (tokens.length > 200_000) throw new Error('SVG path token budget exceeded')
  }
  const result: SegmentedCurve2D[] = []
  let i = 0, command = '', previous = ''
  let current: Point2D = [0, 0], subpathStart: Point2D = [0, 0]
  let cubicControl: Point2D | undefined, quadraticControl: Point2D | undefined
  let active: SegmentedCurve2D | undefined
  let moved = false, totalPoints = 0
  const isCommand = (s: string | undefined) => s !== undefined && /^[a-zA-Z]$/.test(s)
  function number(): number {
    if (tokens[i] === ',') {
      if (i === 0 || tokens[i - 1] === ',' || isCommand(tokens[i - 1])) throw new Error('Invalid SVG path comma')
      i++
    }
    const text = tokens[i++]
    if (text === undefined || text === ',' || isCommand(text) || !Number.isFinite(Number(text))) throw new Error('Expected a finite SVG path number')
    return Number(text)
  }
  function finish() {
    if (active?.segments.length) result.push(active)
    active = undefined
  }
  function begin() {
    active = { id: `${options.idPrefix}-${result.length + 1}`, type: 'curve', closed: false, start: [...current], segments: [] }
    totalPoints++
  }
  function add(segment: CurveSegment2D) {
    if (!active) begin()
    active!.segments.push(segment)
    totalPoints += segment.type === 'line' ? 1 : segment.type === 'quadratic' ? 2 : 3
    if (active!.segments.length > 4096 || totalPoints > 65536) throw new Error('SVG path point/segment budget exceeded')
    current = segment.end
    const points = segment.type === 'line' ? [segment.end] : segment.type === 'quadratic' ? [segment.control, segment.end] : [segment.control1, segment.control2, segment.end]
    if (points.some(p => p.some(n => !Number.isFinite(n)))) throw new Error('SVG path coordinate overflow')
  }
  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = tokens[i++]
    else if (!command || command.toUpperCase() === 'Z') throw new Error('Expected an SVG path command')
    const kind = command.toUpperCase(), relative = command !== kind
    if (!'MLHVQTCSZ'.includes(kind)) {
      if (kind === 'A') throw new Error('SVG elliptical arcs (A/a) are not supported')
      throw new Error(`Unsupported SVG path command: ${command}`)
    }
    if (!moved && kind !== 'M') throw new Error('SVG path must begin with M/m')
    const origin = current
    const point = (): Point2D => {
      const x = number(), y = number()
      const p: Point2D = [x + (relative ? origin[0] : 0), y + (relative ? origin[1] : 0)]
      if (p.some(n => !Number.isFinite(n))) throw new Error('SVG path coordinate overflow')
      return p
    }
    const reflected = (control: Point2D | undefined): Point2D => control ? [origin[0] + (origin[0] - control[0]), origin[1] + (origin[1] - control[1])] : [...origin]
    if (kind === 'M') {
      const p = point(); finish(); current = p; subpathStart = p; moved = true; begin()
      command = relative ? 'l' : 'L'
    } else if (kind === 'Z') {
      if (active) active.closed = true
      finish(); current = subpathStart
    } else if (kind === 'L') add({ type: 'line', end: point() })
    else if (kind === 'H' || kind === 'V') {
      const value = number(), axis = kind === 'H' ? 0 : 1
      const end: Point2D = [...origin]; end[axis] = value + (relative ? origin[axis] : 0)
      add({ type: 'line', end })
    } else if (kind === 'Q' || kind === 'T') {
      const control = kind === 'Q' ? point() : reflected(previous === 'Q' || previous === 'T' ? quadraticControl : undefined)
      add({ type: 'quadratic', control, end: point() }); quadraticControl = control
    } else {
      const control1 = kind === 'C' ? point() : reflected(previous === 'C' || previous === 'S' ? cubicControl : undefined)
      const control2 = point()
      add({ type: 'cubic', control1, control2, end: point() }); cubicControl = control2
    }
    if (kind !== 'C' && kind !== 'S') cubicControl = undefined
    if (kind !== 'Q' && kind !== 'T') quadraticControl = undefined
    previous = kind
  }
  finish()
  // Move-only subpaths have no curve geometry and are omitted.
  return result.map(curve => mapCurve2D(curve, ([x, y]) => [x, options.yAxis === 'down' && y !== 0 ? -y : y]))
}

/** Export normalized absolute M/L/Q/C/Z commands, preserving authored Bezier degrees. */
export function exportSVGPath2D(curve: Curve2D, options: SVGPath2DOptions): string {
  checkOptions(options)
  if (curveControlPoints2D(curve).some(p => p.some(n => !Number.isFinite(n)))) throw new Error('SVG path coordinates must be finite')
  return curvePath2D(options.yAxis === 'down' ? curve : mapCurve2D(curve, ([x, y]) => [x, -y]), value => {
    if (!Number.isFinite(value)) throw new Error('SVG path coordinate overflow')
    return String(value)
  })
}
