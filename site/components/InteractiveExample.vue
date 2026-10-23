<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { KnotViewer, validateKnotAsset, selectRepresentation, ViewerError, type KnotAsset, SPATIAL_CURVE, MOSAIC_DIAGRAM, expandURI, type Camera3D, type CaptureOptions } from 'knot-engine'
import loop from '../../v1/examples/assets/twisted-loop.json'
import overhand from '../../v1/examples/assets/overhand.json'
import assetFixture from '../../v1/examples/assets/procedures.json'
type DemoInput = { kind: 'asset'; data: KnotAsset }
const examples: Record<string, DemoInput> = {
  overhand: { kind: 'asset', data: overhand as unknown as KnotAsset },
  loop: { kind: 'asset', data: loop as unknown as KnotAsset },
  asset: { kind: 'asset', data: assetFixture as unknown as KnotAsset }
}
const representationId = ref(overhand.representations[0].id)
function formatModel(value: unknown, level = 0): string {
  const indent = '  '.repeat(level)
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'number')) return `[${value.join(', ')}]`
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
function localizedEntryName(entry: { id: string; names?: { language: string; value: string }[] }, language: string): string {
  return entry.names?.find(item => item.language === language)?.value ?? entry.names?.find(item => item.language === 'en')?.value ?? entry.names?.[0]?.value ?? entry.id
}
function localizedName(data: KnotAsset, language: string): string {
  return data.subject.names?.find(item => item.language === language)?.value
    ?? data.subject.names?.find(item => item.language === 'en')?.value
    ?? data.subject.names?.[0]?.value
    ?? data.subject.id
}
const selected = ref('overhand')
const current = shallowRef<DemoInput>(examples.overhand)
const asset = computed(() => current.value.kind === 'asset' ? current.value.data : null)
function supportedRepresentations(data: KnotAsset) {
  return data.representations?.filter(rep => [SPATIAL_CURVE, MOSAIC_DIAGRAM].includes(expandURI(rep.type, data.namespaces) as typeof SPATIAL_CURVE | typeof MOSAIC_DIAGRAM)) ?? []
}
const representations = computed(() => asset.value ? supportedRepresentations(asset.value) : [])
const procedures = computed(() => asset.value?.procedures ?? [])
const selectedProcedure = ref('')
const steps = computed(() => procedures.value.find(procedure => procedure.id === selectedProcedure.value)?.steps ?? [])
function chooseProcedure() {
  selectedStep.value = ''
}
const selectedStep = ref('')
function chooseStep() {
  const step = steps.value.find(item => item.id === selectedStep.value)
  const id = step?.representations?.find((ref): ref is { id: string } => 'id' in ref && representations.value.some(rep => rep.id === ref.id))
  if (id && 'id' in id) representationId.value = id.id
}
const host = document.documentElement
const locale = ref<'uk' | 'en'>(host.lang === 'uk' ? 'uk' : 'en')
const theme = ref<'light' | 'dark'>(host.dataset.theme === 'dark' ? 'dark' : 'light')
let hostObserver: MutationObserver | undefined
onMounted(() => {
  const inherit = () => {
    locale.value = host.lang === 'uk' ? 'uk' : 'en'
    theme.value = host.dataset.theme === 'dark' ? 'dark' : 'light'
  }
  inherit()
  hostObserver = new MutationObserver(inherit)
  hostObserver.observe(host, { attributes: true, attributeFilter: ['lang', 'data-theme'] })
})
onBeforeUnmount(() => hostObserver?.disconnect())
const draft = ref(formatModel(examples.overhand.data))
const demoCamera: Camera3D = { mode: 'fit', direction: [0, 0, 1], up: [0, 1, 0], projection: { kind: 'perspective', fovY: 55 * Math.PI / 180 } }
let draftTimer: ReturnType<typeof setTimeout> | undefined
const issue = ref('')
const viewer = ref<InstanceType<typeof KnotViewer> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const content = computed(() => locale.value === 'uk' ? {
  model: 'Модель', representation: 'Представлення', procedure: 'Спосіб зав’язування', step: 'Крок зав’язування', custom: 'Власна модель', invalidJSON: 'Некоректний JSON', invalidFormat: 'Очікується KnotAsset', fileLimit: 'Файл перевищує 1 MiB', export: 'Експорт зображення', editor: 'Код', openFile: 'Відкрити з файлу', saveFile: 'Зберегти в файл'
} : {
  model: 'Model', representation: 'Representation', procedure: 'Tying procedure', step: 'Tying step', custom: 'Custom model', invalidJSON: 'Invalid JSON', invalidFormat: 'Expected KnotAsset', fileLimit: 'File exceeds 1 MiB', export: 'Export image', editor: 'Code', openFile: 'Open from file', saveFile: 'Save to file'
})
function setCurrent(input: DemoInput) {
  const candidates = supportedRepresentations(input.data)
  const rep = candidates.find(r => r.id === representationId.value) ?? candidates[0]
  if (!rep) throw new ViewerError('UNSUPPORTED_SCHEMA', 'No supported representation')
  const selection = selectRepresentation(input.data, { representationId: rep.id })
  if (!selection.ok) throw new ViewerError('INVALID_MODEL', selection.issues[0]?.message ?? 'Invalid representation')
  representationId.value = rep.id
  current.value = input
  selectedProcedure.value = input.data.procedures?.[0]?.id ?? ''
  selectedStep.value = ''
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
    const result = validateKnotAsset(data)
    if (!result.valid) { issue.value = result.issues.map(i => `${i.path}: ${i.message}`).join('\n'); return }
    setCurrent({ kind: 'asset', data: result.asset })
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
  saveBlob(new Blob([draft.value], { type: 'application/json;charset=utf-8' }), 'knot-asset.json')
}
const isMosaic = computed(() => {
  const rep = representations.value.find(rep => rep.id === representationId.value)
  return rep ? expandURI(rep.type, asset.value?.namespaces) === MOSAIC_DIAGRAM : false
})
async function download(options: CaptureOptions, name: string) {
  try {
    const blob = await viewer.value?.capture(options)
    if (!blob) return
    saveBlob(blob, name)
  } catch (error) { issue.value = String(error) }
}
</script>

<template>
  <section class="knot-engine-v1-demo" :data-theme="theme" :lang="locale" :aria-label="locale === 'uk' ? 'Інтерактивний приклад' : 'Interactive example'">
    <div class="knot-engine-v1-demo__layout">
      <aside class="knot-engine-v1-demo__sidebar">
        <section class="knot-engine-v1-demo__panel">
          <label>{{ content.model }}<span class="knot-engine-v1-demo__model-select knot-engine-v1-demo__select-field"><select v-model="selected" @change="choose"><option v-for="(example, key) in examples" :key="key" :value="key">{{ localizedName(example.data, locale) }}</option><option v-if="selected === 'custom'" value="custom">{{ content.custom }}</option></select></span></label>
          <input ref="fileInput" class="knot-engine-v1-demo__file-input" type="file" accept=".json,application/json" @change="chooseFile">
          <section class="knot-engine-v1-demo__editor"><label class="knot-engine-v1-demo__code-label">{{ content.editor }}<textarea v-model="draft" @input="scheduleDraft" spellcheck="false" rows="18"></textarea></label><output v-if="issue" class="knot-engine-v1-demo__issue" role="alert">{{ issue }}</output><div class="knot-engine-v1-demo__actions"><button type="button" @click="fileInput?.click()">{{ content.openFile }}</button><button type="button" @click="saveCode">{{ content.saveFile }}</button></div></section>
        </section>
      </aside>
      <section class="knot-engine-v1-demo__stage">
        <section class="knot-engine-v1-demo__panel knot-engine-v1-demo__view-settings">
          <label v-if="asset">{{ content.representation }}<span class="knot-engine-v1-demo__select-field"><select v-model="representationId" class="knot-engine-v1-demo__representation-select"><option v-for="representation in representations" :key="representation.id" :value="representation.id">{{ localizedEntryName(representation, locale) }}</option></select></span></label>
          <label v-if="procedures.length > 1">{{ content.procedure }}<span class="knot-engine-v1-demo__select-field"><select v-model="selectedProcedure" @change="chooseProcedure"><option v-for="procedure in procedures" :key="procedure.id" :value="procedure.id">{{ procedure.name ?? procedure.id }}</option></select></span></label>
          <label v-if="steps.length">{{ content.step }}<span class="knot-engine-v1-demo__select-field"><select v-model="selectedStep" @change="chooseStep"><option value="">{{ content.step }}</option><option v-for="step in steps" :key="step.id" :value="step.id">{{ localizedEntryName(step, locale) }}</option></select></span></label>
        </section>
        <KnotViewer ref="viewer" :show-controls="false" :asset="asset" :representation-id="representationId" :initial-camera="demoCamera" :label="localizedName(current.data, locale)" :locale="locale" :theme="theme" @error="issue = $event.message" />
        <div class="knot-engine-v1-demo__actions"><button type="button" @click="download({ view: 'current', format: isMosaic ? 'image/svg+xml' : 'image/png' }, isMosaic ? 'knot-current.svg' : 'knot-current.png')">{{ content.export }}</button></div>
      </section>
    </div>
  </section>
</template>
