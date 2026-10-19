# Publication, generations and language editions

Status: implemented site organization and release workflow. A local build does not deploy the website or publish an npm release. Package 0.1.0 and `schemaVersion` 1 remain unchanged.

## Source organization

```text
v1/
  index.md / index.uk.md
  guide/
  schema/
  spec/
    examples/
  resources/
  version.json
design/
site/
  components/
  runtime/
  releases/
src/
tests/
```

Versioned materials live once under root vN directories. Guide pages explain tasks; specifications define implemented data and component/function behavior. Schemas and format examples are part of specifications. Resources hold actual reusable definitions; catalogs are specifically identification systems. Proposed contracts, research, acceptance plans and architectural decisions live in design, visibly separate from implemented specifications.

The site directory contains common navigation, localization, rendering and the interactive-example host. Current-generation examples mount directly into page containers; only pages with examples load their generation-local JavaScript and CSS bundles. Demo styles are scoped to `knot-engine-v1-demo` and inherit the page palette. It does not duplicate v1/v2 source content. Its release snapshots are immutable generated artifacts, not another authoring tree. Package components implement knot rendering; the site supplies the editor and explanatory context. Current renderer code is not silently applied to incompatible old generations: only the current generation receives the current interactive runtime. Archived snapshots preserve their built runtime. Another actively interactive generation needs an explicitly compatible runtime.

## Two language editions

English uses name.md and Ukrainian name.uk.md, with identical topic keys. Shared JSON schemas and examples are not duplicated. The site publishes English pages at the canonical topic route and Ukrainian pages with a .uk.html suffix; for example /v1/spec/knot-asset.html and /v1/spec/knot-asset.uk.html. Links retain the .html extension. Site and generation home pages use index.uk.html for Ukrainian and index.html for English. Language switches preserve the topic, and navigation, status labels and example controls are localized. HTML lang matches the selected edition. Configuration in site/locales.mjs currently enables only en and uk. A missing counterpart fails the build instead of silently presenting another language as a translation.

Design materials have the same two-language coverage at /design/architecture.html and /design/architecture.uk.html, for example. They are working material outside the npm package, not versioned runtime contracts. Cross-generation or design links in release snapshots point back to the corresponding site-level pages; the snapshot's own content remains local.

## One release and stable identities

Package, documentation, specifications, schemas and available data form one release with the package version. v1 includes pre-1.0 packages and later 1.x. Before stabilization, incompatible changes are allowed without bumping the current numbers. `KnotModelV1` support has been removed; the current package uses `KnotAsset` exclusively.

/v1/ is the current first-generation material. /releases/<package-version>/ is an explicitly created immutable snapshot of that generation. Other vN directories are published concurrently; no independent specification-release or data-release numbering is introduced. Current documentation has a visible development label; no /next/ is needed.

The namespace remains https://yuriyapostol.github.io/knot-engine/v1/. Moving files or documentation does not rename entities. Schemas live directly under v1/schema/ and are published at their canonical IDs under /v1/schema/. Package schema exports map to the same directory. Schema filenames do not repeat the generation suffix.

Archives preserve canonical IDs. Reproducible validation supplies the chosen snapshot's schemas in an isolated registry rather than silently fetching current definitions. Different revisions with one canonical ID must not be mixed in the same validator registry.


## CSS namespace for major generations

CSS names start with the full package namespace `knot-engine`, followed by the major generation and component name. Classes follow `knot-engine-vN-<component>` / `knot-engine-vN-<component>__<part>`; component variables follow `--knot-engine-vN-<component>-<setting>`. The implemented `KnotViewer` uses `.knot-engine-v1-viewer`, `.knot-engine-v1-viewer__…` and `--knot-engine-v1-viewer-*`. Other components receive distinct names under the same package/generation prefix.

Different major versions can be used on the same page. Future `v2`, `v3`, etc. use their own class and variable namespaces; no separate namespace is introduced for each `0.x` release.

During initial development, no part of the package requires backward compatibility, including CSS. There are no separate guarantees of stable classes, variables or stylesheet compatibility between releases in one generation. A viewer uses its release's stylesheet. This is a project decision about namespace separation; see the [component contract](../v1/spec/components.md#css-namespace-and-styling) for current styling settings. Published release snapshots remain immutable.

## Package and website selection

package.json selects the current generation through knotEngine.resourceDirectory, currently v1. Its files and exports include only that generation, dist, README and LICENSE; other generations, design notes and website archives are excluded. Public imports remain knot-engine/schema/.... Update selection, files and exports together when the package changes generation. Git branches do not determine package versions.

Each vN/version.json records packageVersion, `schemaVersion` and status. The current generation's packageVersion must match package.json. Other generations retain their own metadata. Source code, tests and site implementation remain outside vN.

## Commands and archive policy

- npm run dev: build and serve the complete site on port 5173, automatically rebuilding and reloading after changes to source materials, components, schemas or examples.
- npm run build:site: produce site-dist with all generations, bilingual pages and committed release snapshots.
- npm run preview:site: rebuild and serve the production result on port 5174.
- npm run site:archive: explicitly create site/releases/<package-version>; refuse to overwrite an existing snapshot. This does not publish npm or deploy Pages.
- npm run test:site: check translations, language routing, multiple generations, links and archive preservation.

GitHub Pages deploys the whole site-dist after checks on main. Archive sources in site/releases are durable tracked files, not expiring CI caches. Commit release sources before generating a snapshot so its metadata identifies the source commit; dirty worktrees are recorded. Review and commit the generated snapshot with the release, and use Git tags for released code. Maintenance branches are needed only for actively maintained old code. Never edit a published snapshot; corrections enter the next release.
