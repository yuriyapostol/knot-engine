# knot-engine demo application

[English](demo.md) | [Українська](demo.uk.md) · [Documentation](../README.md)

The demo is a required v1 development deliverable. The local application is implemented in demo/; this document remains an acceptance plan, and unverified scenarios are listed in README. Technology: a separate Vue 3 + TypeScript + Vite project in demo/ that uses the package's public API.

## Purpose

Present the component as a standalone product and provide reproducible scenarios for model authors and integrators. All basic fixtures are supplied locally; once assets/the build are loaded, working with models requires no network. This is not a promise of a PWA/installable offline cache: a service worker is outside the demo scope.

A static KnotAsset fixture with snapshot selection has been added to the main viewer. The JSON textarea retains legacy mode; KnotAsset editing and algorithm animation are not implemented.

## Main screen

- Responsive layout: a large viewer, fixture selection, a short name/description and a controls panel. On phones, the panel sits below the viewer and page scrolling is unrestricted until 3D is activated.
- A uk/en switch for the entire UI, including errors; light/dark modes simulate the host theme. Labels are accessible by keyboard and screen reader.
- Fixtures: a simple knot with a symmetric loop, a closed curve from the local fixture, an open rope, two separate ropes and a more complex curve for inspecting geometry. The demo's initial camera looks along the z axis at the x-y plane and adjusts its distance to the model's bounds. Other examples remain technical models until an editor confirms a particular knot.
- An interaction button and camera controls in the viewer; current model ID/schema version/state in the side panel without overloading the main view.
- Exporting a PNG of the current view and a PNG of the model preview are separate actions; download the Blob locally and revoke object URLs after use.

## Checking a custom model

The JSON open/save buttons and textarea are in the side column below model selection. The editor displays the selected preset's JSON and automatically applies valid changes after a short typing pause. The save button downloads the current editor text as a JSON file. Files are read locally and are not sent to a server. The file limit is 1 MiB before parsing; geometry limits are additionally checked by the core validator. An invalid draft remains in the editor with an error path, while the viewer retains the previous valid model. This is demo behavior, not the viewer's own contract for an invalid model prop.

Errors, such as curves[0].points[2], have understandable text and a code, not just a stack trace. There is no eval, HTML insertion from JSON or automatic navigation to model.id. Import works when the same file is selected again. Selecting a preset in the list restores its fixture.

## Integration examples

Show a copyable minimal Vue snippet with the actual npm name once chosen, explicit CSS import and props. Separate sections show a model in an article with long text, two independent models side by side and a narrow container. The component works in differently sized containers independently of page structure.

Fallback page/section: null model, invalid model, missing poster and simulated renderer unavailability through a demo test adapter. Do not add a production simulateWebGLFailure prop to the public component just for the demo. Real context loss is checked in a browser test where the relevant extension is available, with an explicit skip in environments without it.

## Build and hosting

Current npm scripts: dev:demo, build:demo, build, typecheck, test, test:browser, test:package and preview:model. There are no preview:demo, lint or format scripts. Development uses the source package; a separate CI smoke test checks an installed npm pack tarball so that an alias to src cannot hide broken exports/styles/types.

The demo builds to its own output directory, separate from library dist; it is not included in the package's npm files. The base path is configurable for a GitHub Pages project path; /knot-engine/ is not hardcoded in components. All fixture/poster URLs work under a nonempty base; use no browser history routes or use consistent hash routing for static hosting. A custom domain or deployment is not required for a local acceptance build.

Prepare a GitHub Actions build workflow during implementation; public deployment is enabled after choosing the repository's Pages target. A written workflow is not evidence of successful hosting. There is no third-party analytics, external fonts or advertising SDKs.

## Readiness criteria

1. Local startup from README using documented commands and a production build/preview.
2. The default fixture displays; switching fixture/uk/en/theme works without stale rendering or loss of controls.
3. An open curve has caps; a closed curve has a correct seam; two curves display simultaneously.
4. Touch page scrolling is not blocked until viewer activation; buttons/keyboard provide accessible alternatives.
5. Invalid/oversized JSON does not hang and shows the problem path; all examples are available locally.
6. Export produces a nonempty PNG of the required size; current/model-preview are not confused; capture does not change the current camera.
7. Scrolling the viewer out of the viewport and active=false stop rendering; returning restores the current model.
8. Two instances are independent; repeated mount/unmount does not accumulate listeners/RAF/GPU resources.
9. The build works at / and a project base; the library tarball passes a separate consumer smoke test.

The demo does not replace the Vue SSR, touch-device and WebView checks in specification.md.
