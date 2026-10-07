<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { KnotViewer, validateKnotAsset, validateKnotModelV1, resolveKnotAsset, resolveKnotModelV1, ViewerError, type KnotModelV1, type KnotAsset, type CameraView, type CaptureOptions } from '../src'
import loop from '../examples/models/prototype-loop.json'
import overhand from '../examples/models/overhand.json'
import assetFixture from '../examples/assets/variants.json'
type DemoInput = { kind: 'legacy'; data: KnotModelV1 } | { kind: 'asset'; data: KnotAsset }
const examples: Record<string, DemoInput> = {
  overhand: { kind: 'legacy', data: overhand as KnotModelV1 },
  loop: { kind: 'legacy', data: loop as KnotModelV1 },
  asset: { kind: 'asset', data: assetFixture as KnotAsset }
}
const representationId = ref('view-3d')
const snapshotId = ref('rest')
function formatModel(value: unknown, level = 0): string {
  const indent = '  '.repeat(level)
  if (Array.isArray(value)) {
    if ((value.length === 2 || value.length === 3) && value.every(item => typeof item === 'number')) return `[${value.join(', ')}]`
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
const current = shallowRef<DemoInput>(examples.overhand)
const model = computed(() => current.value.kind === 'legacy' ? current.value.data : null)
const asset = computed(() => current.value.kind === 'asset' ? current.value.data : null)
const representations = computed(() => asset.value?.representations.filter(rep => rep.dimension === 3) ?? [])
const snapshots = computed(() => representations.value.find(rep => rep.id === representationId.value)?.snapshots ?? [])
const renderable = computed(() => {
  try {
    return current.value.kind === 'asset'
      ? resolveKnotAsset(current.value.data, { representationId: representationId.value, snapshotId: snapshotId.value })
      : resolveKnotModelV1(current.value.data)
  } catch { return null } // KnotViewer reports selection errors through its error event.
})
const locale = ref<'uk' | 'en'>('uk')
const theme = ref<'light' | 'dark'>('light')
const draft = ref(formatModel(examples.overhand.data))
const demoCamera = computed<CameraView | undefined>(() => {
  if (!renderable.value) return undefined
  const points = renderable.value.curves.flatMap(curve => curve.points)
  const radius = Math.max(...renderable.value.curves.map(curve => curve.radius))
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
  title: 'Knot Engine', intro: 'Система моделювання та візуалізації вузлів і мотузкових конструкцій.', model: 'Модель', overhand: 'Простий вузол', loop: 'Замкнена крива', asset: 'Мотузка з кількома станами', snapshot: 'Стан', representation: 'Представлення', custom: 'Власна модель', invalidJSON: 'Некоректний JSON', invalidFormat: 'Очікується KnotModelV1 з curves або KnotAsset з representations', fileLimit: 'Файл перевищує 1 MiB', export: 'Експорт в PNG', preview: 'Експорт прев’ю в PNG', editor: 'Код', openFile: 'Відкрити з файлу', saveFile: 'Зберегти в файл'
} : {
  title: 'Knot Engine', intro: 'A system for modeling and visualizing knots and rope structures.', model: 'Model', overhand: 'Overhand knot', loop: 'Closed curve', asset: 'Rope with multiple snapshots', snapshot: 'Snapshot', representation: 'Representation', custom: 'Custom model', invalidJSON: 'Invalid JSON', invalidFormat: 'Expected KnotModelV1 with curves or KnotAsset with representations', fileLimit: 'File exceeds 1 MiB', export: 'Export to PNG', preview: 'Export preview to PNG', editor: 'Code', openFile: 'Open from file', saveFile: 'Save to file'
})
function setCurrent(input: DemoInput) {
  if (input.kind === 'asset') {
    const rep = input.data.representations.find(r => r.dimension === 3 && r.id === representationId.value)
      ?? input.data.representations.find(r => r.dimension === 3)
    const snapshot = rep?.snapshots.find(s => s.id === snapshotId.value) ?? rep?.snapshots[0]
    const selection = { representationId: rep?.id, snapshotId: snapshot?.id }
    resolveKnotAsset(input.data, selection)
    representationId.value = rep!.id
    snapshotId.value = snapshot!.id
  } else resolveKnotModelV1(input.data)
  current.value = input
}
function chooseRepresentation() {
  snapshotId.value = snapshots.value[0]?.id ?? ''
}
function choose() {
  clearTimeout(draftTimer)
  const example = examples[selected.value]
  if (!example) return
  setCurrent(example)
  draft.value = formatModel(example.data)
  issue.value = ''
}
function scheduleDraft() {
  clearTimeout(draftTimer)
  draftTimer = setTimeout(applyDraft, 300)
}
function applyDraft() {
  clearTimeout(draftTimer)
  try {
    const data: unknown = JSON.parse(draft.value)
    if (!data || typeof data !== 'object' || Array.isArray(data)) { issue.value = content.value.invalidFormat; return }
    const hasAssetRoot = 'representations' in data
    const hasLegacyRoot = 'curves' in data
    if (hasAssetRoot === hasLegacyRoot) { issue.value = content.value.invalidFormat; return }
    if (hasAssetRoot) {
      const result = validateKnotAsset(data, { strict: true })
      if (!result.valid) { issue.value = result.issues.map(i => `${i.path}: ${i.message}`).join('\n'); return }
      setCurrent({ kind: 'asset', data: result.asset })
    } else {
      const result = validateKnotModelV1(data, { strict: true })
      if (!result.valid) { issue.value = result.issues.map(i => `${i.path}: ${i.message}`).join('\n'); return }
      setCurrent({ kind: 'legacy', data: result.model })
    }
    issue.value = ''; selected.value = 'custom'
  } catch (error) { issue.value = error instanceof ViewerError ? error.message : content.value.invalidJSON }
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) { issue.value = content.value.fileLimit; return }
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
  saveBlob(new Blob([draft.value], { type: 'application/json;charset=utf-8' }), current.value.kind === 'asset' ? 'knot-asset.json' : 'knot-model.json')
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
    <header class="top"><div><h1>{{ content.title }}</h1><p>{{ content.intro }}</p></div><div class="switches"><button type="button" @click="locale = locale === 'uk' ? 'en' : 'uk'">{{ locale.toUpperCase() }}</button><button type="button" @click="theme = theme === 'light' ? 'dark' : 'light'">{{ theme === 'light' ? '☾' : '☀' }}</button></div></header>
    <div class="layout">
      <section class="stage"><KnotViewer ref="viewer" :show-controls="false" :model="model" :asset="asset" :representation-id="representationId" :snapshot-id="snapshotId" :initial-camera="demoCamera" :label="current.data.id || 'Rope model'" :locale="locale" :theme="theme" @error="issue = $event.message" /></section>
      <aside class="panel">
        <label>{{ content.model }}<span class="model-select select-field"><select v-model="selected" @change="choose"><option value="overhand">{{ content.overhand }}</option><option value="loop">{{ content.loop }}</option><option value="asset">{{ content.asset }}</option><option v-if="selected === 'custom'" value="custom">{{ content.custom }}</option></select></span></label>
        <label v-if="asset && representations.length > 1">{{ content.representation }}<span class="select-field"><select v-model="representationId" class="representation-select" @change="chooseRepresentation"><option v-for="representation in representations" :key="representation.id" :value="representation.id">{{ representation.id }}</option></select></span></label>
        <label v-if="asset">{{ content.snapshot }}<span class="select-field"><select v-model="snapshotId" class="snapshot-select"><option v-for="snapshot in snapshots" :key="snapshot.id" :value="snapshot.id">{{ snapshot.id }}</option></select></span></label>
        <div class="actions"><button type="button" @click="fileInput?.click()">{{ content.openFile }}</button></div>
        <input ref="fileInput" class="file-input" type="file" accept=".json,application/json" @change="chooseFile">
        <section class="editor"><label class="code-label">{{ content.editor }}<textarea v-model="draft" @input="scheduleDraft" spellcheck="false" rows="18"></textarea></label><pre v-if="issue" role="alert">{{ issue }}</pre><div class="actions"><button type="button" @click="saveCode">{{ content.saveFile }}</button></div></section>
        <div class="actions"><button type="button" @click="download({ view: 'current' }, 'knot-current.png')">{{ content.export }}</button><button type="button" @click="download({ view: 'model-preview' }, 'knot-preview.png')">{{ content.preview }}</button></div>
      </aside>
    </div>
  </main>
</template>
