# Release snapshots

`npm run build:site` discovers root `vN/` source directories and builds each under `site-dist/vN/` and includes every committed snapshot
from `site/releases/`. The Pages workflow publishes the complete result.

Commit the release sources first so `release.json` identifies their commit.
The metadata records whether the source worktree was dirty during the build.
For an explicitly prepared release, run `npm run site:archive`. It builds the
current package and creates `site/releases/<package-version>/`. Review and
commit that directory with the release. The command refuses to overwrite an
existing snapshot. Do not edit published snapshots: include corrections in the
next release. No snapshot is created by ordinary builds or deployments.

Snapshots contain rendered documentation, specifications, raw schemas, examples,
and a relocatable interactive example. Canonical schema IDs and namespaces remain under `/v1/`.
Use schemas from the chosen snapshot in an isolated validator registry for
reproducible validation. Do not fetch their current canonical URLs implicitly.

The tracked snapshots are the durable archive; CI caches and expiring workflow
artifacts are not used as the source of previous releases. Do not commit
`site-dist/`. Empty registries or invented data are not published for planned
resource types that have no implemented definitions yet.

Each generation needs `version.json`, paired English/Ukrainian Markdown, and `guide/`, `spec/schema/`, `spec/examples/`, and `resources/` directories. Other resource directories are copied as present. The current package generation is selected by `package.json#knotEngine.resourceDirectory`; only that generation receives the current interactive runtime and release snapshot. npm files and exports must select that same generation.

Run `npm run preview:site` to rebuild and serve the complete site at `http://localhost:5174/`. Use `npm run dev` on port 5173 for the complete site with automatic rebuild and browser reload. The shared `site/components/InteractiveExample.vue` host imports the package viewer; `site/runtime/` bundles that host. Content lives in root `vN/` and `design/`, with no version-specific source copies in `site/`.

After starting the site, `node scripts/site/browser-smoke.mjs` checks the language switch, embedded viewer and mobile layout. Override the server address with `SITE_TEST_URL` and Chrome with `CHROME_PATH`.
