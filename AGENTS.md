# Repository authoring guidance

These conventions improve readability; they are not normative Knot schema rules.

- Prefer compact one-line numeric arrays in examples, especially XYZ coordinate triples, tile rows and short vectors: `[0.4, 0.3, 0.1]`.
- Prefer standard v1 short names in built-in representation type, object type, algorithm purpose, tile-set and convention fields (e.g. `3d`, `rope`, `untying`, `lomonaco-kauffman-11`, `dt-signed-even`). For other resource identities, prefer declared namespace prefixes where supported, e.g. `example:custom-type`. Use URI identities for resource definitions. Keep full URIs where required (JSON Schema identifiers and external links).
- Keep English and Ukrainian specifications aligned when changing contracts.

Localization policy: English (`en`) is the default UI language for every viewer and standalone entry point. Use English first in language lists, locale unions, translation maps and authored arrays of localized strings. Ukrainian (`uk`) must be explicitly selected (by a locale option or the Ukrainian documentation page). Keep this policy consistent in code and both documentation editions, and preserve regression coverage for defaults and language order. Localized data array order remains an authoring convention, not a schema validation requirement.
