<script setup lang="ts">
import { computed, ref } from 'vue'
import { KnotViewer, validateModel, type KnotModelV1, type CameraView, type CaptureOptions } from '../src'
import loop from '../examples/models/prototype-loop.json'

const open: KnotModelV1 = { schemaVersion: 1, id: 'open-rope', coordinateSystem: 'right-handed-y-up', units: 'relative', curves: [{ id: 'open', closed: false, interpolation: { type: 'catmullrom', tension: 0.5 }, radius: 0.46, points: [[-7,-3,0],[-4,3,1],[0,5,-1],[4,1,1],[7,-3,0]] }] }
const pair: KnotModelV1 = { ...open, id: 'two-ropes', curves: [open.curves[0], { id: 'second', closed: false, interpolation: { type: 'catmullrom', tension: 0.5 }, radius: 0.38, points: [[-6,4,-1],[-3,0,-2],[0,-3,-1],[3,0,-2],[6,4,-1]] }] }
const complex: KnotModelV1 = { schemaVersion: 1, id: 'complex-curve', coordinateSystem: 'right-handed-y-up', units: 'relative', curves: [{ id: 'complex', closed: true, interpolation: { type: 'catmullrom', tension: 0.6 }, radius: 0.32, points: [[-6,-3,0],[-3,-6,1],[0,-2,2],[3,-6,1],[6,-3,0],[3,0,-2],[6,3,-1],[2,6,1],[0,2,2],[-2,6,1],[-6,3,-1],[-3,0,-2]] }] }
const examples: Record<string, KnotModelV1> = { loop: loop as KnotModelV1, open, pair, complex }
const selected = ref('loop')
const model = ref<KnotModelV1>(examples.loop)
const locale = ref<'uk' | 'en'>('uk')
const theme = ref<'light' | 'dark'>('light')
const quality = ref<'low' | 'medium' | 'high'>('medium')
const active = ref(true)
const status = ref('initializing')
const camera = ref<CameraView | null>(null)
const draft = ref('')
const issue = ref('')
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
const content = computed(() => locale.value === 'uk' ? {
  title: 'Knot Viewer', intro: 'Інтерактивний перегляд моделей мотузок із контрольних точок.', model: 'Модель', loop: 'Замкнена крива', open: 'Відкрита мотузка', pair: 'Дві мотузки', complex: 'Складніша крива', quality: 'Якість', active: 'Активний перегляд', export: 'Зберегти поточний PNG', preview: 'Зберегти PNG прев’ю', editor: 'Перевірити власну модель', apply: 'Застосувати JSON', restore: 'Відновити приклад', hint: 'Вставте JSON або виберіть локальний файл. Дані залишаються в браузері.', file: 'Вибрати JSON файл', reset: 'Скинути', fit: 'Умістити'
} : {
  title: 'Knot Viewer', intro: 'Interactive rope models built from control points.', model: 'Model', loop: 'Closed curve', open: 'Open rope', pair: 'Two ropes', complex: 'Complex curve', quality: 'Quality', active: 'Viewer active', export: 'Save current PNG', preview: 'Save preview PNG', editor: 'Try your own model', apply: 'Apply JSON', restore: 'Restore example', hint: 'Paste JSON or choose a local file. Data stays in your browser.', file: 'Choose JSON file', reset: 'Reset', fit: 'Fit'
})
function choose() { model.value = examples[selected.value]; issue.value = ''; status.value = 'initializing' }
function applyDraft() {
  try {
    const data: unknown = JSON.parse(draft.value)
    const result = validateModel(data, { strict: true })
    if (!result.valid) { issue.value = result.issues.map(i => `${i.path}: ${i.message}`).join('\n'); return }
    model.value = result.model; issue.value = ''; selected.value = 'custom'; status.value = 'initializing'
  } catch { issue.value = 'Invalid JSON' }
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) { issue.value = 'File exceeds 1 MiB'; return }
  draft.value = await file.text()
  applyDraft()
}
async function download(options: CaptureOptions, name: string) {
  try {
    const blob = await viewer.value?.capture(options)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) { issue.value = String(error) }
}
</script>

<template>
  <main :data-theme="theme">
    <header class="top"><div><p class="eyebrow">3D COMPONENT DEMO</p><h1>{{ content.title }}</h1><p>{{ content.intro }}</p></div><div class="switches"><button type="button" @click="locale = locale === 'uk' ? 'en' : 'uk'">{{ locale.toUpperCase() }}</button><button type="button" @click="theme = theme === 'light' ? 'dark' : 'light'">{{ theme === 'light' ? '☾' : '☀' }}</button></div></header>
    <div class="layout">
      <section class="stage"><KnotViewer ref="viewer" :model="model" :label="model.id || 'Rope model'" :locale="locale" :theme="theme" :quality="quality" :active="active" @ready="status = 'ready'" @error="status = $event.code" @camera-change="camera = $event" /></section>
      <aside class="panel"><label>{{ content.model }}<select v-model="selected" @change="choose"><option value="loop">{{ content.loop }}</option><option value="open">{{ content.open }}</option><option value="pair">{{ content.pair }}</option><option value="complex">{{ content.complex }}</option><option v-if="selected === 'custom'" value="custom">Custom</option></select></label><label>{{ content.quality }}<select v-model="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="check"><input v-model="active" type="checkbox">{{ content.active }}</label><div class="actions"><button type="button" @click="viewer?.resetView()">{{ content.reset }}</button><button type="button" @click="viewer?.fitToView()">{{ content.fit }}</button><button type="button" @click="download({ view: 'current' }, 'knot-current.png')">{{ content.export }}</button><button type="button" @click="download({ view: 'model-preview' }, 'knot-preview.png')">{{ content.preview }}</button></div><dl><dt>ID</dt><dd>{{ model.id }}</dd><dt>Schema</dt><dd>{{ model.schemaVersion }}</dd><dt>Status</dt><dd>{{ status }}</dd><dt>Camera</dt><dd>{{ camera?.position.map(n => n.toFixed(1)).join(', ') || '—' }}</dd></dl></aside>
    </div>
    <section class="editor"><h2>{{ content.editor }}</h2><p>{{ content.hint }}</p><label class="file">{{ content.file }}<input type="file" accept=".json,application/json" @change="chooseFile"></label><textarea v-model="draft" spellcheck="false" rows="9" placeholder="{ &quot;schemaVersion&quot;: 1, ... }"></textarea><pre v-if="issue" role="alert">{{ issue }}</pre><div class="actions"><button type="button" @click="applyDraft">{{ content.apply }}</button><button type="button" @click="selected = 'loop'; choose()">{{ content.restore }}</button></div></section>
  </main>
</template>
