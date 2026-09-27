import { createApp, h, ref } from 'vue'
import { KnotViewer, type KnotModelV1 } from '../src'
import '../src/styles.css'

declare global {
  interface Window {
    __previewModel: KnotModelV1
    __previewReady?: boolean
    __previewError?: string
    __previewCapture?: (width: number, height: number) => Promise<Blob>
  }
}
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
createApp({
  setup() {
    return () => h(KnotViewer, {
      ref: viewer,
      model: window.__previewModel,
      label: 'Model preview',
      showControls: false,
      interactive: false,
      onReady: () => { window.__previewReady = true },
      onError: (error: { code: string; message: string }) => { window.__previewError = `${error.code}: ${error.message}` }
    })
  }
}).mount('#app')
window.__previewCapture = (width, height) => viewer.value!.capture({ width, height, view: 'model-preview' })
