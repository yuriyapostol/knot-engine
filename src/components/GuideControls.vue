<script setup lang="ts">
import { computed, ref } from 'vue'
import { messages, type ViewerMessages } from '../locales'
import type { GuidePlane, ResolvedViewerGuides, ViewerGuides } from './guides'
const props = withDefaults(defineProps<{ guides: ResolvedViewerGuides; spatial?: boolean; disabled?: boolean; locale?: 'en' | 'uk'; messages?: Partial<ViewerMessages> }>(), { locale: 'en' })
const emit = defineEmits<{ change: [value: ViewerGuides] }>()
const open = ref(false)
const button = ref<HTMLButtonElement | null>(null)
function close() { open.value = false; button.value?.focus() }
const text = computed(() => ({ ...messages[props.locale], ...props.messages }))
function toggle(group: 'grid' | 'axes', key: 'visible' | 'ticks' | 'labels', event: Event) {
  emit('change', { ...props.guides, [group]: { ...props.guides[group], [key]: (event.target as HTMLInputElement).checked } })
}
function plane(value: GuidePlane, event: Event) {
  const planes = new Set(props.guides.grid.planes)
  if ((event.target as HTMLInputElement).checked) planes.add(value)
  else planes.delete(value)
  emit('change', { ...props.guides, grid: { ...props.guides.grid, planes: [...planes] } })
}
</script>
<template>
  <div class="knot-engine-v1-viewer__guides" @keydown.esc.stop="close">
    <button ref="button" type="button" :aria-label="text.guides" :title="text.guides" :aria-expanded="open" :disabled="disabled" @click="open = !open"><span class="knot-engine-v1-viewer__button-icon" aria-hidden="true">▦</span></button>
    <div v-if="open" class="knot-engine-v1-viewer__guide-options" role="group" :aria-label="text.guides">
      <label><input type="checkbox" :checked="guides.grid.visible" :disabled="disabled" @change="toggle('grid', 'visible', $event)">{{ text.grid }}</label>
      <template v-if="spatial && guides.grid.visible">
        <label v-for="p in (['xy', 'xz', 'yz'] as const)" :key="p"><input type="checkbox" :checked="guides.grid.planes.includes(p)" :disabled="disabled" @change="plane(p, $event)">{{ p.toUpperCase() }}</label>
      </template>
      <label><input type="checkbox" :checked="guides.axes.visible" :disabled="disabled" @change="toggle('axes', 'visible', $event)">{{ text.axes }}</label>
      <label><input type="checkbox" :checked="guides.axes.ticks" :disabled="disabled || !guides.axes.visible" @change="toggle('axes', 'ticks', $event)">{{ text.ticks }}</label>
      <label><input type="checkbox" :checked="guides.axes.labels" :disabled="disabled || !guides.axes.visible" @change="toggle('axes', 'labels', $event)">{{ text.coordinateLabels }}</label>
    </div>
  </div>
</template>
