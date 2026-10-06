import { createApp, h, ref, shallowRef } from 'vue'
import { KnotViewer, type KnotAsset, type KnotModelV1, type SnapshotSelection } from '../src'
import '../src/styles.css'

declare global {
  interface Window {
    __previewModel?: KnotModelV1
    __previewAsset?: KnotAsset
    __previewSelection?: SnapshotSelection
    __previewSetInput?: (input: { model?: KnotModelV1; asset?: KnotAsset; selection?: SnapshotSelection }) => void
    __previewReady?: boolean
    __previewError?: string
    __previewCapture?: (width: number, height: number) => Promise<Blob>
  }
}
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
const input = shallowRef({ model: window.__previewModel, asset: window.__previewAsset, selection: window.__previewSelection })
window.__previewSetInput = value => { window.__previewReady = false; window.__previewError = undefined; input.value = { model: value.model, asset: value.asset, selection: value.selection } }
createApp({
  setup() {
    return () => h(KnotViewer, {
      ref: viewer,
      model: input.value.model,
      asset: input.value.asset,
      representationId: input.value.selection?.representationId,
      snapshotId: input.value.selection?.snapshotId,
      label: 'Model preview',
      showControls: false,
      interactive: false,
      onReady: () => { window.__previewReady = true },
      onError: (error: { code: string; message: string }) => { window.__previewError = `${error.code}: ${error.message}` }
    })
  }
}).mount('#app')
window.__previewCapture = (width, height) => viewer.value!.capture({ width, height, view: 'model-preview' })
