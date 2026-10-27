# Interactive example acceptance

The demo in `site/runtime/` uses the public package API and local `Knot` fixtures. It edits the complete knot, including all representations and procedures. Selection uses representation IDs; changing a static state selects its representation. Animation is outside this profile.

The demo mounts directly into the documentation page without an iframe; multiple hosts create independent component instances. Its `knot-engine-v1-demo` classes scope all layout and control styling. The root and panels have no background, border or padding; controls and the viewer use the documentation palette. The UI observes the current document’s English/Ukrainian language and light/dark theme without changing either or remounting the editor. It provides fixture selection, JSON editor, local file import/save and current-view PNG (3D) or SVG (mosaic) export. Files are limited to 1 MiB before parsing. Editing applies after a short delay; invalid drafts display a diagnostic and preserve the previous valid knot. Existing representation selection is preserved when possible; otherwise the first supported spatial or mosaic representation is selected explicitly by the editor. Imported content is never executed or uploaded.

Automated acceptance covers:

1. Rendering open/closed ropes and SVG mosaics, representation replacement and PNG/SVG output.
2. Validation before WebGL allocation, invalid selection errors and recovery.
3. Perspective and orthographic views; viewport/capture share camera preparation.
4. Editor recovery, selection preservation, repeated local import and exact JSON save.
5. SSR/hydration and a separate tarball consumer; demo builds do not substitute for package checks.
6. Independent schemas, resource dependency checks, extraction and composition.
7. Site languages, links, multiple generations and immutable release snapshots.

Hardware touch/WebView behavior and device performance still require device-specific verification. No service worker, hosting deployment or publication is part of local builds. See [component contract](../v1/specifications/components.md), [data contract](../v1/specifications/knot.md) and [publication policy](publication.md).
