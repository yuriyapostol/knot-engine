import type { MosaicDiagram } from '../core'

/** Tile-local SVG paths with circular quarter arcs and separate strands at crossings. */
const arcs: readonly (readonly string[])[] = [
  [], ['M 0 0.5 A 0.5 0.5 0 0 1 0.5 1'], ['M 0.5 1 A 0.5 0.5 0 0 1 1 0.5'],
  ['M 0.5 0 A 0.5 0.5 0 0 0 1 0.5'], ['M 0.5 0 A 0.5 0.5 0 0 1 0 0.5'],
  ['M 0 0.5 L 1 0.5'], ['M 0.5 0 L 0.5 1'],
  ['M 0 0.5 A 0.5 0.5 0 0 1 0.5 1', 'M 0.5 0 A 0.5 0.5 0 0 0 1 0.5'],
  ['M 0.5 0 A 0.5 0.5 0 0 1 0 0.5', 'M 0.5 1 A 0.5 0.5 0 0 1 1 0.5'],
  ['M 0.5 0 L 0.5 0.35', 'M 0.5 0.65 L 0.5 1', 'M 0 0.5 L 1 0.5'],
  ['M 0 0.5 L 0.35 0.5', 'M 0.65 0.5 L 1 0.5', 'M 0.5 0 L 0.5 1'],
]
export interface MosaicPath { key: string; d: string; transform: string }
export function mosaicPaths(diagram: MosaicDiagram): MosaicPath[] {
  return diagram.tiles.flatMap((row, r) => row.flatMap((code, c) =>
    arcs[code].map((d, i) => ({ key: `${r}-${c}-${i}`, d, transform: `translate(${c} ${r})` }))
  ))
}
