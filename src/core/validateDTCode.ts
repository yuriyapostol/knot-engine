import type { DTCode } from './asset'
import { issue, standalone } from './validation'

/** Upper bound in 32-bit row-intersection steps, used before topology analysis. */
export const dtWork = (n: number) => n*n*Math.ceil(n/32)
const parity32 = (value: number) => {
  value ^= value >>> 16; value ^= value >>> 8; value ^= value >>> 4
  return (0x6996 >>> (value & 15)) & 1
}

/** Knot-only signed even DT; realizability uses Shtylla–Traldi–Zulli, Theorem 2. */
export function validateDTCode(value: unknown, _options: { strict?: boolean } = {}) {
  const result = standalone<DTCode>('dt', value, data => {
    const n = data.code.length
    if (!n) return [] // a single crossing-free unknot
    const even = data.code.map(Math.abs)
    if (even.some(e => e > 2*n) || new Set(even).size !== n) return [issue('code', 'Absolute DT entries must permute 2, 4, ..., 2n')]
    const words = Math.ceil(n/32), adjacency = new Uint32Array(n*words)
    const low = even.map((e,i) => Math.min(2*i+1,e)), high = even.map((e,i) => Math.max(2*i+1,e))
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
      if (degree) return [issue('code', 'DT traversal is not planar-realizable')]
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
        if (common) return [issue('code', 'DT traversal is not planar-realizable')]
        continue
      }
      const [a,pa] = find(i), [b,pb] = find(j), required = 1 ^ common
      if (a === b) {
        if ((pa ^ pb) !== required) return [issue('code', 'DT traversal is not planar-realizable')]
      } else if (rank[a] < rank[b]) { parent[a] = b; xor[a] = pa ^ pb ^ required }
      else { parent[b] = a; xor[b] = pa ^ pb ^ required; if (rank[a] === rank[b]) rank[a]++ }
    }
    return []
  })
  return result.valid ? { ...result, code: result.data, componentCount: 1, crossingCount: result.data.code.length } : result
}
