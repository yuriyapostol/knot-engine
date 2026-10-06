# KnotViewer in the knot-engine package

[English](specification.md) | [Українська](specification.uk.md) · [Documentation](../README.md)

Original document: 2026-09-27. KnotViewer is a Vue component of knot-engine. The authoritative domain contract belongs to [KnotAsset v1](knot-asset-v1.md), while the historical [KnotModelV1](model-format.md) is supported through a legacy adapter. Current APIs, migration boundaries and implementation policies are described in the [architecture](architecture.md). The initial acceptance criteria are also retained below; they do not mean that all historical scenarios have already been implemented.

## Purpose

A portable Vue component builds rope geometry from control points and displays an interactive 3D model. It supports client rendering, SSR with hydration, desktop and touch browsers, and compatible WebViews. Additional capabilities are static image generation and a demo page.

The component input is model data. The library consumer determines its source and storage method. model.id is an opaque string, such as examples/loops/sample; it is not interpreted as a file path, URL or DOM selector.

## First release

Required: static models with one or more curves, camera controls, reset/fit, touch and keyboard input, localized uk/en controls, poster fallback, model replacement without remounting, lifecycle and resource management, image export and a demo. Format validation before geometry creation is required even for local assets.

Excluded: a knot editor, physical simulation, automatic determination of knot correctness and other functionality not described in the specification. Algorithms and steps are KnotAsset v1 data; their animation and instructional UI remain future viewer capabilities.

## Package architecture

Recommendation: Vue 3 as a peer dependency, Three.js as an implementation dependency. Agree on supported Node/Vue/Three.js versions during prototyping and commit a lockfile. Dependencies are installed through the package manager; do not include manually copied engine builds.

```text
src/
  index.ts                  public Vue API
  core/                     types, validation, data normalization without DOM
  geometry/                 shared Three.js geometry builder
  renderer/                 scene, camera, controls, lifecycle, capture
  components/KnotViewer.vue
  locales/                  uk/en, typed keys
  styles/                   explicit CSS export
examples/models/            small local fixture models
demo/                       separate Vue + Vite application
scripts/preview/            browser harness/CLI for CI previews
tests/                      meaningful contract/integration/browser tests
docs/
```

Proposed package entry points: root Vue export, /core for types, validateKnotAsset, validateKnotModelV1, legacy alias validateModel and resolvers without WebGL/DOM, /styles.css and /preview for separate capture integration if needed. The CLI/harness must not enter the client bundle. Viewer and preview share one geometry builder, rather than two independent implementations.

The public API does not expose a Three.js scene/material/renderer as a stable contract. This allows internal implementation changes. Vue and types are external in the library build; do not duplicate Three.js separately for controls. Document actual bundle sizes and verify tree shaking rather than promising lazy loading solely because several files exist. A host can load the component through defineAsyncComponent.

Controls have their own base styles and do not require a third-party UI library. Library consumers can replace toolbar/fallback slots and customize colors through public CSS tokens.

## Proposed Vue API

| Prop | Type / default | Behavior |
| --- | --- | --- |
| model | KnotModelV1 or null, optional | Legacy static input; do not supply together with asset |
| asset | KnotAsset or null, optional | Domain input; full validation before the renderer |
| representationId | string, optional | Representation selection; default is the first dimension=3 representation |
| snapshotId | string, optional | Snapshot within the selected representation; default is the first |
| label | string, required | Accessible name of the particular model, supplied by the host in the content language |
| description | string, optional | Text alternative/explanation for the model |
| poster | string, optional | Already resolved URL of a local/host-approved image |
| locale | 'uk' or 'en', default 'uk' | Built-in control language; the default does not depend on navigator during SSR |
| messages | Partial<ViewerMessages> | Localized string overrides, without an i18n framework dependency |
| theme | 'light' or 'dark', default 'light' | The host determines system mode; changes renderer and controls consistently |
| quality | 'low'/'medium'/'high', default 'medium' | Tessellation/DPR budget; does not change control points |
| active | boolean, default true | Allows the host to pause the viewer, for example on a hidden screen |
| interactive | boolean, default true | false disables controls/input but allows static rendering/capture |
| showControls | boolean, default true | Toolbar visibility; the host is responsible for alternative controls when false |
| initialCamera | CameraView, optional | Overrides the model preview camera; otherwise preview → auto-fit |

Size is set by container CSS, not window.innerWidth. The component has documented default aspect-ratio and min-height values and supports resizing. For a new model object reference: cancel old preparation, validate, rebuild and release old resources, then apply the initial camera. Deep mutation of point arrays is not a supported v1 update API; the host supplies a new object.

A valid initialCamera replacement resets the view using the same rule; theme/locale do not rebuild geometry, and quality changes only tessellation. An invalid new model must display error/fallback, not present old geometry as the new model.

Events:

- ready: { modelId?, schemaVersion, warnings } after the first successful render of the current model; once per load/context restoration. Do not emit for a cancelled model.
- error: { code, message, issues?, recoverable }, without throwing an unhandled error in the host render. Codes: INVALID_MODEL, UNSUPPORTED_SCHEMA, LIMIT_EXCEEDED, WEBGL_UNAVAILABLE, CONTEXT_LOST, RENDER_FAILED, CAPTURE_FAILED.
- camera-change: CameraView after interaction ends, not every frame. The package contains no analytics or network reporting.

Exposed methods: resetView(), fitToView(), capture(options): Promise<Blob>. Capture before ready rejects with a typed error; unmount/context loss cancels pending operations. Reset and fit before ready are safe no-ops. Slots: toolbar (reset/fit/zoom callbacks + state), fallback (state/error/poster), loading; document their props in types.

Minimal example of the future API (the import path depends on the npm name):

```vue
<KnotViewer
  :model="model"
  label="Knot model"
  poster="/images/knot-preview.png"
  locale="en"
  theme="light"
  @error="handleViewerError"
/>
```

model accepts a data object. Loading a file or resolving an external identifier to an object happens before passing the prop; there is no implicit fetch inside the component.

## Controls and accessibility

Mouse: drag to orbit, zoom after viewer activation. Touch: a separate “Interact with model” mode allows one-finger article scrolling before activation; after activation, one finger rotates, pinch zooms and there is an explicit way to exit the mode. Escape exits and restores normal scrolling. Wheel input does not intercept page scrolling without focus/activation. Pan may be disabled in v1 if the scenario does not need it; reset/fit always restore a visible model.

Keyboard on a focused viewer: arrows rotate, +/- zoom, Home resets the camera; equivalent buttons are available. Do not intercept keys globally. Provide visible focus, semantic buttons, a label and a text alternative; canvas alone does not communicate shape to a screen reader. An error is announced once, and camera changes do not fill a live region. Reduced motion disables smooth reset/damping; v1 has no autonomous auto-rotate.

Camera constraints prevent entering the object/losing it through zoom; near/far are calculated from the bounding box, not a fixed model scale. Perspective camera and framing must account for aspect-ratio. Buttons remain accessible on narrow screens, with touch targets of at least 44 CSS px as a project criterion.

## SSR, offline use and lifecycle

Package import and SSR rendering do not access window/document/WebGL. The server and first client render display the same shell/poster; GPU resources are created after mount. Verify compatibility through SSR + hydration, checking that no hydration mismatch occurs. A missing poster must not trigger a network request or an empty, unbounded canvas.

No external requests from inside the package: fonts, icons, materials and shaders are local; v1 does not require textures. The host supplies the poster and is responsible for URL availability. The renderer contains no eval/arbitrary shaders from JSON. A model is data; new code is distributed through a package version.

States: empty → initializing → ready; initializing/ready may transition to error; active=false, a hidden tab/viewport or context loss pauses work. No frames are scheduled while the document is hidden. A stationary model renders on demand; damping schedules frames only while motion continues. IntersectionObserver optimizes invisible instances; active remains an explicit host API.

Use ResizeObserver; do not assume fullscreen. A zero-sized container defers rendering rather than dividing by zero. On unmount, detach listeners/observers/controls, cancel animation frame/capture and dispose of the renderer/geometries/materials. Do not dispose of shared tube/outline geometry twice. Multiple viewer instances do not share a camera, DOM ID or mutable state.

Context loss: stop rendering, display poster/state and emit an error; restoration through a browser event rebuilds resources from the current model and emits ready. A repeated failure offers a controlled retry button, without an infinite loop. The external container may synchronize active with its own lifecycle.

## Card previews

One geometry builder and versioned preset are used for both viewer and cards. Capture(options) supports width/height, format='image/png' in v1, view='current' or 'model-preview', and opaque/transparent backgrounds. Default: current, 512×512, opaque. Upper bound: 2048×2048 in v1; verify resource budgets before increasing it.

Capture does not change the user's visible camera/size; use a separate target or reliable temporary state save/restore. Render at the required aspect-ratio with framing, and read back with the correct orientation and alpha; the result is a Blob without automatic download. The demo may download it itself. Do not leave preserveDrawingBuffer=true by default just for export.

The CLI/harness launches the browser renderer in CI, waits for ready, calls capture(view='model-preview') and writes an image asset. The result is cached by model data + preset + camera + renderer version + output size. Browser/Three.js versions are pinned; pixel-identical images across GPUs are not guaranteed. A capture failure stops generation of a required card rather than producing an empty image.

Demo and browser capture must work without Node APIs; Node is needed only for the CI harness. The generated image is a separate API output; the library consumer determines how it is stored.

## Theming

Explicit stylesheet export, without a hidden global reset. CSS class/token prefix: --knot-viewer-*. Minimum tokens: background, foreground, border, focus, toolbar-background, error; their default light/dark values enable standalone use. SVG/icons are local. The renderer preset defines the rope/outline; CSS does not implicitly change 3D materials. The theme prop coordinates preset defaults; an explicit preview preset has a stable appearance independently of the page theme.

Public CSS tokens allow the component's appearance to match any design system. uk/en have the same complete set of keys; the model and label language may differ from the toolbar language. A new language can be added through messages without changing the geometry format.

## Acceptance and plan

1. Types/validation and a fixture imported from the old prototype. The validator returns a result with error paths and does not mutate input.
2. Geometry/renderer: open, closed and two independent ropes; reset/fit, seam, resize, capture, disposal.
3. Vue API, SSR/hydration and lifecycle; model replacement during preparation, multiple instances, context loss, offline use.
4. Demo according to demo.md and a preview generator; mouse/touch/keyboard controls, uk/en, light/dark.
5. Packaging: typecheck, library/demo build, npm pack and tarball installation in clean client Vue and Vue SSR fixtures. If the Vue peer version supports a range, test its lower bound.
6. Checks on touch devices and in WebViews: scroll vs orbit/pinch, background/resume, offline use, memory. Publish the supported browser/environment version matrix based on actual checks; do not present emulation as device testing.

Required checks: malformed/oversized input, unsupported schema, duplicate IDs/points, invalid camera; finite geometry/bounds; closed seam; no unnecessary frames at rest; no lingering listeners/resources after repeated mount/unmount; SSR without DOM; fallback without WebGL; valid PNG export; model changes do not produce stale ready/capture. Visual regressions use a fixed browser environment with tolerance, not exact comparison on arbitrary GPUs.

Record gzipped bundle size, cold viewer startup, triangle count and frame time on a designated baseline touch device. Do not promise a numerical FPS before selecting the baseline device. Initial protective format limits are in model-format.md; explicitly version/document measurement-driven changes.

The release is ready when the tarball usage example works in two web consumers, the demo is built, the listed scenarios are tested and known limitations are published. Publishing to npm/GitHub Pages is a separate action after the result is ready; this document does not mean anything has already been published.

## Example and technical references

The local fixture examples/models/prototype-loop.json contains a closed curve with six control points. Use it for initial shape and camera checks alongside open-curve and multiple-rope examples. closed is applied consistently to the curve and its surface; the frame loop and resize behavior must follow the component lifecycle.

Primary references: [CatmullRomCurve3](https://threejs.org/docs/pages/CatmullRomCurve3.html), [Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html). Before implementation, check the API of the selected dependency versions.
