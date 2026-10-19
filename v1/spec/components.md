# KnotViewer

Vue 3 component for one static spatial representation of a [`KnotAsset`](knot-asset.md). Replace the asset object to update geometry; deep mutation is unsupported. Validation and selection finish before WebGL allocation. A Grid-only asset is valid data but is unsupported by this component.

| Prop | Meaning |
| --- | --- |
| `asset?: KnotAsset \| null` | Input; null/omitted displays the empty state |
| `label: string` | Required accessible label |
| `representationId?: string` | Selected representation; defaults to first `spatial-curve` |
| `view?: Reference \| ViewDefinition` | Select a listed view or supply an explicit complete view |
| `registries?: KnotResourceRegistry[]` | Explicit external resource definitions |
| `initialCamera?: Camera3D` | Application camera override |
| `description?`, `poster?` | Accessible description and fallback image URL |
| `locale?: 'uk' \| 'en'`, `messages?` | UI language (default uk) and message overrides |
| `theme?: 'light' \| 'dark'` | Default light |
| `quality?: 'low' \| 'medium' \| 'high'` | Default medium; triangle budget may lower it |
| `active?`, `interactive?`, `showControls?` | Boolean controls, all default true |

Events: `ready({assetId?,schemaVersion:1,warnings})`, `error({code,message,issues?,recoverable})`, `camera-change(CameraView)`. `CameraView` is a complete fixed camera: `position`, `target`, `up` and `projection`; perspective FOV is in radians. Error codes are `INVALID_MODEL`, `UNSUPPORTED_SCHEMA`, `LIMIT_EXCEEDED`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `RENDER_FAILED`, `CAPTURE_FAILED`.

Methods: `resetView()`, `fitToView()`, `capture(options?): Promise<Blob>`. Capture options are `width`, `height`, `format:'image/png'`, `view:'current'|'model-preview'`, `transparent`. Default size 512×512; dimensions must be integers in 1..2048. Current capture preserves the current view, adjusting perspective FOV for narrower output. Preview capture independently prepares the author view for the output aspect. Capture does not modify the live camera.

Slots: `toolbar({reset,fit,zoomIn,zoomOut,ready,touchActive})`, `fallback({state,error,poster})`, `loading({state})`. States are `empty`, `initializing`, `ready` and `error`. SSR renders a stable fallback without WebGL. The component cleans listeners, observers and GPU resources on unmount; rendering pauses while inactive, hidden or outside the viewport.

Import `knot-engine/styles.css`. Toolbar buttons and arrow keys support camera interaction. Touch orbit/pinch and scroll handoff remain supported; hardware touch/WebView verification is separate from headless browser coverage. There is no automatic data fetching or animation. Geometry quality has a 100,000-triangle budget; it is reduced before allocation or fails when low quality is still too large.

## CSS compatibility and styling

The public CSS contract is stable within generation `v1`, including all `0.x` and later `1.x` packages. The root class is `.knot-viewer-v1`; part classes are `.knot-viewer-v1__surface`, `.knot-viewer-v1__canvas`, `.knot-viewer-v1__fallback`, `.knot-viewer-v1__poster`, `.knot-viewer-v1__toolbar`. The root exposes `data-theme="light|dark"` and `data-state="empty|initializing|ready|error"`. Existing classes, attribute values and documented variables retain their meaning; extensions must remain compatible with existing host styling. Pixel identity and the complete internal DOM structure are not guaranteed.

Different `v1` releases can share the CSS contract; their stylesheets must coexist without incompatible overrides depending on load order. `v2` and later major generations may introduce incompatible changes: they use separate `.knot-viewer-v2…` classes and `--knot-viewer-v2-*` variables. Unversioned `.knot-viewer…` aliases are not added, keeping generation styles separate.

Public `--knot-viewer-v1-*` CSS variables are the preferred customization mechanism. Set them on a host container for inheritance or on an individual component through `class`/`style`. The package does not assign public variables on its root: absent overrides use defaults. Private `--_knot-viewer-v1-*` variables hold the theme palette and are not public API. Explicit overrides win in both themes; hosts can use `[data-theme=dark]` for theme-specific colors.

| Variable | Default (light / dark for colors) | Meaning |
| --- | --- | --- |
| `--knot-viewer-v1-background` | `#f8f5ef / #171b24` | Viewer and button background |
| `--knot-viewer-v1-foreground` | `#29231d / #f2eee8` | Text color |
| `--knot-viewer-v1-border` | `#c9bdae / #3f4652` | Border color |
| `--knot-viewer-v1-focus` | `#1467b6 / #91c6ff` | Keyboard focus color |
| `--knot-viewer-v1-toolbar-background` | `#fffdf7e8 / #242a34e8` | Toolbar background |
| `--knot-viewer-v1-error` | `#9b2525 / #ffb0a7` | Error text color |
| `--knot-viewer-v1-aspect-ratio` | `4/3` | Viewer aspect ratio |
| `--knot-viewer-v1-min-height` | `260px` | Minimum viewer height |
| `--knot-viewer-v1-border-width` | `1px` | Border width |
| `--knot-viewer-v1-radius` | `12px` | Viewer corner radius |
| `--knot-viewer-v1-toolbar-offset` | `12px` | Toolbar side/bottom inset |
| `--knot-viewer-v1-toolbar-gap` | `6px` | Gap between toolbar controls |
| `--knot-viewer-v1-toolbar-padding` | `6px` | Toolbar padding |
| `--knot-viewer-v1-toolbar-radius` | `10px` | Toolbar corner radius |
| `--knot-viewer-v1-button-min-size` | `44px` | Minimum button width and height |
| `--knot-viewer-v1-button-padding` | `6px 10px` | Button padding |
| `--knot-viewer-v1-button-radius` | `7px` | Button corner radius |

```vue
<template>
  <section class="knot-gallery">
    <KnotViewer :asset="asset" label="Rope" />
    <KnotViewer :asset="otherAsset" label="Other rope"
      style="--knot-viewer-v1-background: #ffffff" />
  </section>
</template>

<style>
.knot-gallery {
  --knot-viewer-v1-radius: 0px;
  --knot-viewer-v1-aspect-ratio: 1;
  --knot-viewer-v1-toolbar-gap: 8px;
}
</style>
```

These variables style the HTML interface, not WebGL materials, lighting or PNG backgrounds. The `theme` prop continues to control the 3D palette; `capture` uses its own theme/mode background, or transparency with `transparent:true`. Smaller buttons can reduce touch usability; the default remains 44px.

This is a project decision: a shared CSS generation supports concurrent viewers from different releases without a separate styling namespace per `0.x`. A generation suffix isolates potentially incompatible major versions; inherited variables customize a group or individual instance without depending on internal markup. See the [publication policy](../../design/publication.md).
