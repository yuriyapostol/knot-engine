# KnotViewer

Vue 3 component for one static spatial representation of a [`Knot`](knot.md). Replace the knot object to update geometry; deep mutation is unsupported. Validation and selection finish before WebGL allocation. A Grid-only knot is valid data but is unsupported by this component.

| Prop | Meaning |
| --- | --- |
| `knot?: Knot \| null` | Input; null/omitted displays the empty state |
| `label: string` | Required accessible label |
| `representationId?: string` | Selected representation; defaults to first `spatial-curve` |
| `view?: Reference \| ViewDefinition` | Select a listed view or supply an explicit complete view |
| `registries?: ResourceRegistry[]` | Explicit external resource definitions |
| `initialCamera?: Camera3D` | Application camera override |
| `description?`, `poster?` | Accessible description and fallback image URL |
| `locale?: 'uk' \| 'en'`, `messages?` | UI language (default uk) and message overrides |
| `theme?: 'light' \| 'dark'` | Default light |
| `quality?: 'low' \| 'medium' \| 'high'` | Default medium; triangle budget may lower it |
| `active?`, `interactive?`, `showControls?` | Boolean controls, all default true |

Events: `ready({knotId?,schemaVersion:1,warnings})`, `error({code,message,issues?,recoverable})`, `camera-change(CameraView)`. `CameraView` is a complete fixed camera: `position`, `target`, `up` and `projection`; perspective FOV is in radians. Error codes are `INVALID_MODEL`, `UNSUPPORTED_SCHEMA`, `LIMIT_EXCEEDED`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `RENDER_FAILED`, `CAPTURE_FAILED`.

Methods: `resetView()`, `fitToView()`, `capture(options?): Promise<Blob>`. Capture options are `width`, `height`, `format:'image/png'`, `view:'current'|'model-preview'`, `transparent`. Default size 512×512; dimensions must be integers in 1..2048. Current capture preserves the current view, adjusting perspective FOV for narrower output. Preview capture independently prepares the author view for the output aspect. Capture does not modify the live camera.

Slots: `toolbar({reset,fit,zoomIn,zoomOut,ready,touchActive})`, `fallback({state,error,poster})`, `loading({state})`. States are `empty`, `initializing`, `ready` and `error`. SSR renders a stable fallback without WebGL. The component cleans listeners, observers and GPU resources on unmount; rendering pauses while inactive, hidden or outside the viewport.

Import `knot-engine/styles.css`. Toolbar buttons and arrow keys support camera interaction. Touch orbit/pinch and scroll handoff remain supported; hardware touch/WebView verification is separate from headless browser coverage. There is no automatic data fetching or animation. Geometry quality has a 100,000-triangle budget; it is reduced before allocation or fails when low quality is still too large.

## CSS namespace and styling

The current component's root class is `.knot-engine-v1-viewer`; part classes are `.knot-engine-v1-viewer__surface`, `.knot-engine-v1-viewer__canvas`, `.knot-engine-v1-viewer__fallback`, `.knot-engine-v1-viewer__poster`, `.knot-engine-v1-viewer__toolbar`. The root exposes `data-theme="light|dark"` and `data-state="empty|initializing|ready|error"`.

The package CSS namespace is `knot-engine-v1`; `viewer` identifies this component within it. Other components use their own names under the same package/generation prefix. `v1` covers `0.x` and later `1.x` packages; subsequent generations use `.knot-engine-v2-viewer…` classes and `--knot-engine-v2-viewer-*` variables. This permits different major versions on the same page. Unversioned aliases are not added.

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
