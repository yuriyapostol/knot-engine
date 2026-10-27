# Viewer components

`KnotViewer` selects and delegates one static representation of a [`RawKnot` or prepared `Knot`](prepared-model.md). Built-ins render spatial curves with `Knot3DViewer` and mosaics with `KnotMosaicViewer`. Grid, PD and DT have no built-in viewers. Replace input objects to update data; deep mutation is unsupported. Selection and validation precede renderer allocation.

| Prop | Meaning |
| --- | --- |
| `knot?: RawKnot \| Knot \| null` | Input; null/omitted displays the empty state |
| `label: string` | Required accessible label |
| `representationId?: string` | Explicit selection; otherwise exactly one supported representation is required |
| `registry?: ViewerRegistry` | Compositor-only component registry; replaces built-ins |
| `view?: Reference \| ViewDefinition` | Explicit application-owned view |
| `views?: ViewDefinition[]` | Application-owned presets for local view lookup |
| `registries?: RawResourceRegistry[]` | Explicit external resource definitions |
| `initialCamera?: Camera3D` | 3D display-camera override |
| `description?`, `poster?` | Accessible description; poster is a 3D fallback image |
| `locale?: 'uk' \| 'en'`, `messages?` | UI language (default uk); message overrides apply to 3D |
| `theme?: 'light' \| 'dark'` | Default light |
| `quality?: 'low' \| 'medium' \| 'high'` | 3D quality, default medium; triangle budget may lower it |
| `active?`, `interactive?`, `showControls?` | Boolean controls, all default true |

Specialized viewers accept the relevant props directly and select only their supported type. The compositor forwards props, methods, events and available slots. View selection, camera modes, registry helpers and error meanings are detailed in [viewer contracts](viewer-contracts.md).

Events: `ready({knotId?,schemaVersion:1,warnings})`, `error({code,message,issues?,recoverable})`, `view-change`. 3D also emits `camera-change(CameraView)`; the spatial view is a complete fixed camera with `position`, `target`, `up`, `projection`, and perspective FOV in radians. Mosaic view changes carry `{center:[x,y],height}`. Dispatch errors use core selection codes; specialized viewers use `INVALID_MODEL` for invalid input/view selection. 3D also reports `UNSUPPORTED_SCHEMA`, `LIMIT_EXCEEDED`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `RENDER_FAILED`, `CAPTURE_FAILED` as applicable.

Methods: `resetView()`, `fitToView()`, `capture(options?): Promise<Blob>`. Capture accepts `width`, `height`, `format`, `view:'current'|'model-preview'`, `transparent`; dimensions are integers in 1..2048. 3D supports `image/png` (default 512×512); mosaic supports `image/svg+xml` (default 1024×1024). `current` preserves local framing; `model-preview` uses the resolved spatial camera/default or the full mosaic extent. Capture leaves the live view unchanged.

3D slots: `toolbar({reset,fit,zoomIn,zoomOut,ready,touchActive})`, `fallback({state,error,poster})`, `loading({state})`. Its states are `empty`, `initializing`, `ready`, `error`; SSR renders a stable fallback without WebGL. Mosaic provides toolbar and fallback slots and renders valid input directly as SVG, including during SSR. It has no asynchronous loading state or poster behavior.

3D cleans listeners, observers and GPU resources on unmount and pauses rendering when inactive, hidden or outside the viewport. Toolbar buttons, arrow keys and touch orbit/pinch control its camera. Mosaic supports wheel zoom and pointer pan without WebGL. Hardware touch/WebView verification is separate from headless coverage. There is no automatic fetching or animation. The 3D geometry budget is 100,000 triangles; quality is reduced before allocation or fails if low quality remains too large.

Import `knot-engine/styles.css` for all visual components. Dedicated entries `knot-engine/3d` and `knot-engine/mosaic` export the specialized viewers; the root entry exports all viewers and registry helpers.

## CSS namespace and styling

The built-in viewers share root class `.knot-engine-v1-viewer`; part classes are `.knot-engine-v1-viewer__surface`, `.knot-engine-v1-viewer__canvas`, `.knot-engine-v1-viewer__fallback`, `.knot-engine-v1-viewer__poster`, `.knot-engine-v1-viewer__toolbar`. The root exposes `data-theme="light|dark"` and `data-state="empty|initializing|ready|error"`.

The package CSS namespace is `knot-engine-v1`; `viewer` is shared by the built-in viewer components. Mosaic SVG additionally uses `.knot-engine-v1-mosaic`. New component families can use their own names under the package/generation prefix. `v1` covers `0.x` and later `1.x` packages; subsequent generations use `.knot-engine-v2-viewer…` classes and `--knot-engine-v2-viewer-*` variables. This permits different major versions on the same page. Unversioned aliases are not added.

Backward compatibility is not required during initial development, including for CSS. The namespace does not freeze classes, variables, markup or appearance between releases in one generation or guarantee interchangeable stylesheets. Each viewer should use the stylesheet from its corresponding release.

Public `--knot-engine-v1-viewer-*` CSS variables are the preferred customization mechanism. Set them on a host container for inheritance or on an individual component through `class`/`style`. The package does not assign public variables on its root: absent overrides use defaults. Private `--_knot-engine-v1-viewer-*` variables hold the theme palette and are not public API. Explicit overrides win in both themes; hosts can use `[data-theme=dark]` for theme-specific colors.

| Variable | Default (light / dark for colors) | Meaning |
| --- | --- | --- |
| `--knot-engine-v1-viewer-background` | `#f8f5ef / #171b24` | Viewer and button background |
| `--knot-engine-v1-viewer-foreground` | `#29231d / #f2eee8` | Text color |
| `--knot-engine-v1-viewer-border` | `#c9bdae / #3f4652` | Border color |
| `--knot-engine-v1-viewer-focus` | `#1467b6 / #91c6ff` | Keyboard focus color |
| `--knot-engine-v1-viewer-toolbar-background` | `#fffdf7e8 / #242a34e8` | Toolbar background |
| `--knot-engine-v1-viewer-error` | `#9b2525 / #ffb0a7` | Error text color |
| `--knot-engine-v1-viewer-aspect-ratio` | `4/3` | Viewer aspect ratio |
| `--knot-engine-v1-viewer-min-height` | `260px` | Minimum viewer height |
| `--knot-engine-v1-viewer-border-width` | `1px` | Border width |
| `--knot-engine-v1-viewer-radius` | `12px` | Viewer corner radius |
| `--knot-engine-v1-viewer-toolbar-offset` | `12px` | Toolbar side/bottom inset |
| `--knot-engine-v1-viewer-toolbar-gap` | `6px` | Gap between toolbar controls |
| `--knot-engine-v1-viewer-toolbar-padding` | `6px` | Toolbar padding |
| `--knot-engine-v1-viewer-toolbar-radius` | `10px` | Toolbar corner radius |
| `--knot-engine-v1-viewer-button-min-size` | `44px` | Minimum button width and height |
| `--knot-engine-v1-viewer-button-padding` | `6px 10px` | Button padding |
| `--knot-engine-v1-viewer-button-radius` | `7px` | Button corner radius |

```vue
<template>
  <section class="knot-gallery">
    <KnotViewer :knot="knot" label="Rope" />
    <KnotViewer :knot="otherKnot" label="Other rope"
      style="--knot-engine-v1-viewer-background: #ffffff" />
  </section>
</template>

<style>
.knot-gallery {
  --knot-engine-v1-viewer-radius: 0px;
  --knot-engine-v1-viewer-aspect-ratio: 1;
  --knot-engine-v1-viewer-toolbar-gap: 8px;
}
</style>
```

These variables style the HTML interface, not WebGL materials, lighting or PNG backgrounds. The `theme` prop continues to control the 3D palette; `capture` uses its own theme/mode background, or transparency with `transparent:true`. Smaller buttons can reduce touch usability; the default remains 44px.

This is a project decision: package, generation and component names distinguish styles for multiple components and major versions. Inherited variables customize a group or individual instance without changing internal markup. See the [publication policy](../../design/publication.md).
