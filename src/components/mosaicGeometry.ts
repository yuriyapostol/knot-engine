import type { MosaicDiagram } from '../core'

/** Tile-local SVG path geometry. Each strand stays separate at crossings. */
const arcs: readonly (readonly string[])[] = [
  [], ['M 0 0.5 Q 0.5 0.5 0.5 1'], ['M 0.5 1 Q 0.5 0.5 1 0.5'],
  ['M 0.5 0 Q 0.5 0.5 1 0.5'], ['M 0.5 0 Q 0.5 0.5 0 0.5'],
  ['M 0 0.5 L 1 0.5'], ['M 0.5 0 L 0.5 1'],
  ['M 0 0.5 Q 0.5 0.5 0.5 1', 'M 0.5 0 Q 0.5 0.5 1 0.5'],
  ['M 0.5 0 Q 0.5 0.5 0 0.5', 'M 0.5 1 Q 0.5 0.5 1 0.5'],
  ['M 0.5 0 L 0.5 0.41', 'M 0.5 0.59 L 0.5 1', 'M 0 0.5 L 1 0.5'],
  ['M 0 0.5 L 0.41 0.5', 'M 0.59 0.5 L 1 0.5', 'M 0.5 0 L 0.5 1'],
]
export interface MosaicPath { key: string; d: string; transform: string }
export function mosaicPaths(diagram: MosaicDiagram): MosaicPath[] {
  return diagram.tiles.flatMap((row, r) => row.flatMap((code, c) =>
    arcs[code].map((d, i) => ({ key: `${r}-${c}-${i}`, d, transform: `translate(${c} ${r})` }))
  ))
}
