import { createApp, h, ref, shallowRef } from 'vue'
import { KnotViewer, type RawKnot, type RepresentationSelection } from 'knot-engine'
import '../../src/styles.css'

declare global {
  interface Window {
    __previewKnot?: RawKnot
    __previewSelection?: RepresentationSelection
    __previewSetInput?: (input: { knot?: RawKnot; selection?: RepresentationSelection }) => void
    __previewReady?: boolean
    __previewError?: string
    __previewCapture?: (width: number, height: number) => Promise<Blob>
  }
}
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
const input = shallowRef({ knot: window.__previewKnot, selection: window.__previewSelection })
window.__previewSetInput = value => { window.__previewReady = false; window.__previewError = undefined; input.value = { knot: value.knot, selection: value.selection } }
createApp({
  setup() {
    return () => h(KnotViewer, {
      ref: viewer,
      knot: input.value.knot,
      representationId: input.value.selection?.representationId,
      view: input.value.selection?.view,
      label: 'Model preview',
      showControls: false,
      interactive: false,
      onReady: () => { window.__previewReady = true },
      onError: (error: { code: string; message: string }) => { window.__previewError = `${error.code}: ${error.message}` }
    })
  }
}).mount('#app')
window.__previewCapture = (width, height) => viewer.value!.capture({ width, height, view: 'model-preview' })
