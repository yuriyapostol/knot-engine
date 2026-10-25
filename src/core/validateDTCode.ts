import type { DTCode } from './asset'
import { issue, standalone, ASSET_LIMITS } from './validation'

/** Upper bound in 32-bit row-intersection steps, used before topology analysis. */
export const dtWork = (n: number) => n*n*Math.ceil(n/32)
const parity32 = (value: number) => {
  value ^= value >>> 16; value ^= value >>> 8; value ^= value >>> 4
  return (0x6996 >>> (value & 15)) & 1
}

/** Component arrays are local storage; labels retain global DT numbering. */
function components(code: number[] | number[][]): number[][] {
  return code.length && Array.isArray(code[0]) ? code as number[][] : [code as number[]]
}

/** Build cyclic words without changing the caller's code or numbering. */
function paragraph(code: number[] | number[][]): number[][] | undefined {
  const parts = components(code), flat = parts.flat(), n = flat.length
  if (n > ASSET_LIMITS.dtCrossings || flat.some(e => Math.abs(e) > 2*n) || new Set(flat.map(Math.abs)).size !== n) return
  const visits = new Array<number>(2*n)
  flat.forEach((e,i) => { visits[2*i] = i; visits[Math.abs(e)-1] = i })
  let offset = 0
  return parts.map(part => { const word = visits.slice(offset,offset+2*part.length); offset += 2*part.length; return word })
}

/** Archdeacon–Bokal–Gologranc Lemma 2.3: xU,xV -> xyUxyV.
 * Disjoint crossing graphs stay separate. Empty circles require no analysis. */
function reduceParagraph(input: number[][]): number[][] {
  const words = input.filter(w => w.length).map(w => [...w])
  let fresh = input.reduce((sum,w) => sum+w.length,0)/2
  for (;;) {
    const owner = new Map<number, [number,number]>()
    let shared: [number,number,number,number,number] | undefined
    for (let a = 0; a < words.length && !shared; a++) for (let p = 0; p < words[a].length; p++) {
      const x = words[a][p], previous = owner.get(x)
      if (previous && previous[0] !== a) { shared = [previous[0],previous[1],a,p,x]; break }
      owner.set(x,[a,p])
    }
    if (!shared) return words
    const [a,p,b,q,x] = shared, first = words[a], second = words[b], y = fresh++
    words[a] = [x,y,...first.slice(p+1),...first.slice(0,p),x,y,...second.slice(q+1),...second.slice(0,q)]
    words.splice(b,1)
  }
}

/** Same cost calculation for standalone and aggregate preflight, including added letters. */
export function dtAnalysisWork(code: unknown): number {
  if (!Array.isArray(code)) return 0
  const parts = code.length && Array.isArray(code[0]) ? code : [code]
  if (parts.length > ASSET_LIMITS.dtComponents || parts.some(p => !Array.isArray(p) || p.some(e => !Number.isInteger(e) || !e || e%2))) return 0
  const words = paragraph(code)
  return words ? reduceParagraph(words).reduce((sum,w) => sum+dtWork(w.length/2),0) : 0
}

/** Signed even DT for knots and links; signs do not constrain shadow planarity. */
export function validateDTCode(value: unknown, _options: { strict?: boolean } = {}) {
  const result = standalone<DTCode>('dt', value, data => {
    const words = paragraph(data.code)
    if (!words) return [issue('code', 'Absolute DT entries must permute 2, 4, ..., 2n within the crossing limit')]
    const reduced = reduceParagraph(words)
    if (reduced.reduce((sum,w) => sum+dtWork(w.length/2),0) > ASSET_LIMITS.dtWork) return [issue('code', 'DT analysis budget exceeded', 'LIMIT_EXCEEDED')]
    return reduced.every(realizableWord) ? [] : [issue('code', 'DT traversal is not planar-realizable')]
  })
  return result.valid ? { ...result, code: result.data, componentCount: components(result.data.code).length, crossingCount: components(result.data.code).reduce((sum,p) => sum+p.length,0) } : result
}

/** Shtylla–Traldi–Zulli Theorem 2 on each reduced double-occurrence word. */
function realizableWord(word: number[]): boolean {
  const n = word.length/2
  const words = Math.ceil(n/32), adjacency = new Uint32Array(n*words)
  const positions = new Map<number, number[]>()
  word.forEach((letter,i) => { const pair = positions.get(letter) ?? []; pair.push(i); positions.set(letter,pair) })
  const pairs = [...positions.values()], low = pairs.map(p => p[0]), high = pairs.map(p => p[1])
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
    const a = low[i] < low[j] && low[j] < high[i]
    const b = low[i] < high[j] && high[j] < high[i]
    if (a !== b) { adjacency[i*words+(j>>>5)] |= 1 << (j&31); adjacency[j*words+(i>>>5)] |= 1 << (i&31) }
  }
  // (A+D)^2=A+D over GF(2): even degrees, zero nonedge common-neighbor
  // parity, and d_i XOR d_j = 1 XOR common-neighbor parity on every edge.
  for (let i = 0; i < n; i++) {
    let degree = 0
    for (let w = 0; w < words; w++) degree ^= parity32(adjacency[i*words+w])
    if (degree) return false
  }
  const parent = Int32Array.from({length:n},(_,i)=>i), rank = new Uint8Array(n), xor = new Uint8Array(n)
  const find = (v: number): [number,number] => {
    let parity = 0
    while (parent[v] !== v) { parity ^= xor[v]; v = parent[v] }
    return [v,parity]
  }
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
    let common = 0
    for (let w = 0; w < words; w++) common ^= parity32(adjacency[i*words+w] & adjacency[j*words+w])
    if (!(adjacency[i*words+(j>>>5)] & (1 << (j&31)))) {
      if (common) return false
      continue
    }
    const [a,pa] = find(i), [b,pb] = find(j), required = 1 ^ common
    if (a === b) {
      if ((pa ^ pb) !== required) return false
    } else if (rank[a] < rank[b]) { parent[a] = b; xor[a] = pa ^ pb ^ required }
    else { parent[b] = a; xor[b] = pa ^ pb ^ required; if (rank[a] === rank[b]) rank[a]++ }
  }
  return true
}
