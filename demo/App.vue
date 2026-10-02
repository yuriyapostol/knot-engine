<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { KnotViewer, validateModel, type KnotModelV1, type CameraView, type CaptureOptions } from '../src'
import loop from '../examples/models/prototype-loop.json'
import overhand from '../examples/models/overhand.json'

const examples: Record<string, KnotModelV1> = { overhand: overhand as KnotModelV1, loop: loop as KnotModelV1 }
function formatModel(value: unknown, level = 0): string {
  const indent = '  '.repeat(level)
  if (Array.isArray(value)) {
    if (value.length === 3 && value.every(item => typeof item === 'number')) return `[${value.join(', ')}]`
    if (!value.length) return '[]'
    return `[\n${value.map(item => `${indent}  ${formatModel(item, level + 1)}`).join(',\n')}\n${indent}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    if (!entries.length) return '{}'
    return `{\n${entries.map(([key, item]) => `${indent}  ${JSON.stringify(key)}: ${formatModel(item, level + 1)}`).join(',\n')}\n${indent}}`
  }
  return JSON.stringify(value) ?? 'null'
}
const selected = ref('overhand')
const model = ref<KnotModelV1>(examples.overhand)
const locale = ref<'uk' | 'en'>('uk')
const theme = ref<'light' | 'dark'>('light')
const status = ref('initializing')
const camera = ref<CameraView | null>(null)
const draft = ref(formatModel(examples.overhand))
const demoCamera = computed<CameraView>(() => {
  const points = model.value.curves.flatMap(curve => curve.points)
  const radius = Math.max(...model.value.curves.map(curve => curve.radius))
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]), zs = points.map(point => point[2])
  const center: CameraView['target'] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + radius * 2
  const depth = (Math.max(...zs) - Math.min(...zs)) / 2
  const distance = depth + span * 0.65 / Math.tan(55 * Math.PI / 360)
  return { position: [center[0], center[1], center[2] + distance], target: center, fov: 55 }
})
let draftTimer: ReturnType<typeof setTimeout> | undefined
const issue = ref('')
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const content = computed(() => locale.value === 'uk' ? {
  title: 'Knot Viewer', intro: 'Інтерактивний перегляд моделей мотузок із контрольних точок.', model: 'Модель', overhand: 'Простий вузол', loop: 'Замкнена крива', export: 'Експорт в PNG', preview: 'Експорт прев’ю в PNG', editor: 'Код', openFile: 'Відкрити з файлу', saveFile: 'Зберегти в файл'
} : {
  title: 'Knot Viewer', intro: 'Interactive rope models built from control points.', model: 'Model', overhand: 'Overhand knot', loop: 'Closed curve', export: 'Export to PNG', preview: 'Export preview to PNG', editor: 'Code', openFile: 'Open from file', saveFile: 'Save to file'
})
function choose() {
  clearTimeout(draftTimer)
  const example = examples[selected.value]
  if (!example) return
  model.value = example
  draft.value = formatModel(example)
  issue.value = ''
  status.value = 'initializing'
}
function scheduleDraft() {
  clearTimeout(draftTimer)
  draftTimer = setTimeout(applyDraft, 300)
}
function applyDraft() {
  clearTimeout(draftTimer)
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
onBeforeUnmount(() => clearTimeout(draftTimer))
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function saveCode() {
  saveBlob(new Blob([draft.value], { type: 'application/json;charset=utf-8' }), 'knot-model.json')
}
async function download(options: CaptureOptions, name: string) {
  try {
    const blob = await viewer.value?.capture(options)
    if (!blob) return
    saveBlob(blob, name)
  } catch (error) { issue.value = String(error) }
}
</script>

<template>
  <main :data-theme="theme">
    <header class="top"><div><p class="eyebrow">3D COMPONENT DEMO</p><h1>{{ content.title }}</h1><p>{{ content.intro }}</p></div><div class="switches"><button type="button" @click="locale = locale === 'uk' ? 'en' : 'uk'">{{ locale.toUpperCase() }}</button><button type="button" @click="theme = theme === 'light' ? 'dark' : 'light'">{{ theme === 'light' ? '☾' : '☀' }}</button></div></header>
    <div class="layout">
      <section class="stage"><KnotViewer ref="viewer" :model="model" :initial-camera="demoCamera" :label="model.id || 'Rope model'" :locale="locale" :theme="theme" @ready="status = 'ready'" @error="status = $event.code" @camera-change="camera = $event" /></section>
      <aside class="panel">
        <label>{{ content.model }}<select v-model="selected" @change="choose"><option value="overhand">{{ content.overhand }}</option><option value="loop">{{ content.loop }}</option><option v-if="selected === 'custom'" value="custom">Custom</option></select></label>
        <div class="actions"><button type="button" @click="fileInput?.click()">{{ content.openFile }}</button></div>
        <input ref="fileInput" class="file-input" type="file" accept=".json,application/json" @change="chooseFile">
        <section class="editor"><label class="code-label">{{ content.editor }}<textarea v-model="draft" @input="scheduleDraft" spellcheck="false" rows="9"></textarea></label><pre v-if="issue" role="alert">{{ issue }}</pre><div class="actions"><button type="button" @click="saveCode">{{ content.saveFile }}</button></div></section>
        <div class="actions"><button type="button" @click="download({ view: 'current' }, 'knot-current.png')">{{ content.export }}</button><button type="button" @click="download({ view: 'model-preview' }, 'knot-preview.png')">{{ content.preview }}</button></div>
        <dl><dt>ID</dt><dd>{{ model.id }}</dd><dt>Schema</dt><dd>{{ model.schemaVersion }}</dd><dt>Status</dt><dd>{{ status }}</dd><dt>Camera</dt><dd>{{ camera?.position.map(n => n.toFixed(1)).join(', ') || '—' }}</dd></dl>
      </aside>
    </div>
  </main>
</template>
