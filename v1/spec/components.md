# KnotViewer

Vue 3 component for one static spatial representation of a [KnotAsset](knot-asset.md). Replace the asset object to update geometry; deep mutation is unsupported. Validation and selection finish before WebGL allocation. A Grid-only asset is valid data but is unsupported by this component.

| Prop | Meaning |
| --- | --- |
| `asset?: KnotAsset \| null` | Input; null/omitted displays the empty state |
| `label: string` | Required accessible label |
| `representationId?: string` | Selected representation; defaults to first spatial-curve |
| `view?: Reference \| ViewDefinition` | Select a listed view or supply an explicit complete view |
| `registries?: KnotResourceRegistry[]` | Explicit external resource definitions |
| `initialCamera?: Camera3D` | Application camera override |
| `description?`, `poster?` | Accessible description and fallback image URL |
| `locale?: 'uk' \| 'en'`, `messages?` | UI language (default uk) and message overrides |
| `theme?: 'light' \| 'dark'` | Default light |
| `quality?: 'low' \| 'medium' \| 'high'` | Default medium; triangle budget may lower it |
| `active?`, `interactive?`, `showControls?` | Boolean controls, all default true |

Events: `ready({assetId?,schemaVersion:1,warnings})`, `error({code,message,issues?,recoverable})`, `camera-change(CameraView)`. `CameraView` is a complete fixed camera: position, target, up and projection; perspective FOV is in radians. Error codes are `INVALID_MODEL`, `UNSUPPORTED_SCHEMA`, `LIMIT_EXCEEDED`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `RENDER_FAILED`, `CAPTURE_FAILED`.

Methods: `resetView()`, `fitToView()`, `capture(options?): Promise<Blob>`. Capture options are `width`, `height`, `format:'image/png'`, `view:'current'|'model-preview'`, `transparent`. Default size 512×512; dimensions must be integers in 1..2048. Current capture preserves the current view, adjusting perspective FOV for narrower output. Preview capture independently prepares the author view for the output aspect. Capture does not modify the live camera.

Slots: `toolbar({reset,fit,zoomIn,zoomOut,ready,touchActive})`, `fallback({state,error,poster})`, `loading({state})`. States are empty, initializing, ready and error. SSR renders a stable fallback without WebGL. The component cleans listeners, observers and GPU resources on unmount; rendering pauses while inactive, hidden or outside the viewport.

Import `knot-engine/styles.css`. CSS classes and `--knot-viewer-*` variables remain available for host styling. Toolbar buttons and arrow keys support camera interaction. Touch orbit/pinch and scroll handoff remain supported; hardware touch/WebView verification is separate from headless browser coverage. There is no automatic data fetching or animation. Geometry quality has a 100,000-triangle budget; it is reduced before allocation or fails when low quality is still too large.
