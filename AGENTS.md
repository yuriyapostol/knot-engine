# Repository authoring guidance

These conventions improve readability; they are not normative Knot schema rules.

- Prefer compact one-line numeric arrays in examples, especially XYZ coordinate triples, tile rows and short vectors: `[0.4, 0.3, 0.1]`.
- Prefer declared namespace prefixes in example data where supported, e.g. `knot-engine:tile-sets/lomonaco-kauffman-11`, rather than repeated absolute URIs. Keep full URIs where required (JSON Schema identifiers, external links and standalone validators).
- Keep Ukrainian and English specifications aligned when changing contracts.

Localization data convention: write English (`en`) first in authored arrays of localized strings; this is a code style convention, not a validation requirement.
