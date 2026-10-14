import { createApp, h, ref, shallowRef } from 'vue'
import { KnotViewer, type KnotAsset, type RepresentationSelection } from 'knot-engine'
import '../../src/styles.css'

declare global {
  interface Window {
    __previewAsset?: KnotAsset
    __previewSelection?: RepresentationSelection
    __previewSetInput?: (input: { asset?: KnotAsset; selection?: RepresentationSelection }) => void
    __previewReady?: boolean
    __previewError?: string
    __previewCapture?: (width: number, height: number) => Promise<Blob>
  }
}
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
const input = shallowRef({ asset: window.__previewAsset, selection: window.__previewSelection })
window.__previewSetInput = value => { window.__previewReady = false; window.__previewError = undefined; input.value = { asset: value.asset, selection: value.selection } }
createApp({
  setup() {
    return () => h(KnotViewer, {
      ref: viewer,
      asset: input.value.asset,
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
