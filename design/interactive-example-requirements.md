# Interactive example acceptance

The demo in `site/runtime/` uses the public package API and local `KnotAsset` fixtures. It edits the complete asset, including all representations and procedures. Selection uses representation IDs; changing a static state selects its representation. Animation is outside this profile.

The UI inherits English/Ukrainian and light/dark theme from the site. It provides fixture selection, JSON editor, local file import/save and current-view PNG export. Files are limited to 1 MiB before parsing. Editing applies after a short delay; invalid drafts display a diagnostic and preserve the previous valid asset. Existing representation selection is preserved when possible; otherwise the first spatial representation is selected. Imported content is never executed or uploaded.

Automated acceptance covers:

1. Rendering open/closed rope fixtures, representation replacement and PNG output containing geometry.
2. Validation before WebGL allocation, invalid selection errors and recovery.
3. Perspective and orthographic views; viewport/capture share camera preparation.
4. Editor recovery, selection preservation, repeated local import and exact JSON save.
5. SSR/hydration and a separate tarball consumer; demo builds do not substitute for package checks.
6. Independent schemas, resource dependency checks, extraction and composition.
7. Site languages, links, multiple generations and immutable release snapshots.

Hardware touch/WebView behavior and device performance still require device-specific verification. No service worker, hosting deployment or publication is part of local builds. See [component contract](../v1/spec/components.md), [data contract](../v1/spec/knot-asset.md) and [publication policy](publication.md).
