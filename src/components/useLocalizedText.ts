import { computed, onScopeDispose, ref, type ComputedRef } from 'vue'
import { subscribeLocalization } from '../core/model'

/**
 * Recompute a localized label when the global localization configuration changes.
 * The getter can also read reactive Vue props, refs or computed values.
 */
export function useLocalizedText(getter: () => string | undefined): ComputedRef<string | undefined> {
  const revision = ref(0)
  const unsubscribe = subscribeLocalization(() => { revision.value++ })
  onScopeDispose(unsubscribe, true)
  return computed(() => {
    void revision.value
    return getter()
  })
}
