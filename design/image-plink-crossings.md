# Image representations, 2D crossing semantics, and PLink import

Status: approved design direction; implementation in progress. This document does not describe functionality already available in the package.

## Image representation

Introduce a single built-in representation type `image` for existing raster or vector image files, regardless of the tool that created them. An image is not a structural knot diagram.

The `data` contract has exactly two required fields:

```json
{"mimeType":"image/svg+xml","src":"./images/trefoil.svg"}
```

- `mimeType` is an image MIME type (`image/*`), not a filename extension.
- `src` accepts an HTTPS URL, a relative file reference, or a `data:` URL. An application-provided base URL resolves relative references, preferably relative to the loaded Knot document.
- Validate the MIME type, URL scheme, and matching MIME declarations in data URLs. Schema validation does not fetch remote files.
- Do not embed untrusted SVG markup into the document DOM; render it as an image. Browser-origin restrictions apply to image capture and export.
- Preserve the source reference in serialization. Do not automatically inline external resources or normalize an existing data URL.
- Provide `KnotImageViewer` and delegate `image` from `KnotViewer`, including pan, wheel/pinch zoom, fit/reset and PNG export. SVG export is conditional on access to original SVG bytes.
- Update English and Ukrainian documentation, examples, schemas, resource definitions, viewer contracts and tests.

Retire the *proposed* `diagram-image` type and all other image-only proposed types. Keep structured `2d`, `3d`, `grid-diagram`, `mosaic-diagram`, `pd-code` and `dt-code` unchanged.

## 2D crossing types

Support `classical`, `unknown` and `virtual` crossings in the existing `2d` representation.

- `classical`: the over/under relationship is known.
- `unknown`: the over/under relationship is not specified; this is **not** a virtual crossing.
- `virtual`: a virtual crossing in virtual-knot theory; this is **not** merely a display preference.

Preserve existing ordered crossing-passage semantics. An omitted `type` on a legacy crossing remains valid and means `classical` permanently; round-trip serialization must not silently add `type`. Extend validation and the viewer without breaking existing fixtures. Step overrides may change the crossing type without replacing unchanged geometry.

A mere geometrical intersection or touching does not necessarily imply an explicit crossing record.

## PLink import

Implement a parser/importer for ordinary `% Link Projection` and `% Virtual Link Projection` files. Preserve directed edges, component order, closure, coordinates, crossing relationships, and the `r` (real/classical) versus `v` (virtual) distinction. Reject malformed or unsupported variants explicitly.

Map the result to existing `2d` elements and crossings. When necessary, split source edges into addressable curve elements so that crossing references remain unambiguous; avoid inventing a separate `planar-diagram` representation. Keep original text as provenance if exact re-export is required. Editor-only active-vertex selection is not part of the geometric model.

Validate imports with source fixtures, multiple components, self-crossings, virtual crossings, and round-trip topology checks. The importer must not infer structure from a rendered SVG or PNG.

## Documentation cleanup

Remove the proposed `planar-diagram` representation and its duplicate schema proposal after the PLink mapping is implemented and verified. Explain PLink as an input format rather than a representation type. Replace `diagram-image` references with `image` and remove stale future-work statements in both languages.

## Acceptance criteria

- Existing `2d` crossings without `type` remain valid and serialize unchanged.
- Explicit classical, unknown and virtual crossings validate and render distinctly.
- Both PLink projection variants import without confusing unknown and virtual crossings.
- URL, relative file and data URL images work in the built-in viewer.
- Browser, schema, package and documentation checks pass before the PR is marked ready.
