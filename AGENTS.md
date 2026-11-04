# Repository authoring guidance

These conventions improve readability; they are not normative Knot schema rules.

- Prefer compact one-line numeric arrays in examples, especially XYZ coordinate triples, tile rows and short vectors: `[0.4, 0.3, 0.1]`.
- Prefer standard v1 short names in built-in representation type, object type, algorithm purpose, tile-set and convention fields (e.g. `3d`, `rope`, `untying`, `lomonaco-kauffman-11`, `dt-signed-even`). For other resource identities, prefer declared namespace prefixes where supported, e.g. `example:custom-type`. Use URI identities for resource definitions. Keep full URIs where required (JSON Schema identifiers and external links).
- Keep Ukrainian and English specifications aligned when changing contracts.

Localization data convention: write English (`en`) first in authored arrays of localized strings; this is a code style convention, not a validation requirement.
