export interface ViewerMessages {
  interact: string; exit: string; reset: string; fit: string; zoomIn: string; zoomOut: string
  loading: string; empty: string; unavailable: string; retry: string
}
export const messages: Record<'uk' | 'en', ViewerMessages> = {
  uk: { interact: 'Взаємодіяти з моделлю', exit: 'Завершити взаємодію', reset: 'Скинути вид', fit: 'Умістити модель', zoomIn: 'Збільшити', zoomOut: 'Зменшити', loading: 'Завантаження моделі…', empty: 'Модель не задано', unavailable: 'Не вдалося показати модель', retry: 'Повторити' },
  en: { interact: 'Interact with model', exit: 'Stop interacting', reset: 'Reset view', fit: 'Fit model', zoomIn: 'Zoom in', zoomOut: 'Zoom out', loading: 'Loading model…', empty: 'No model selected', unavailable: 'Unable to display model', retry: 'Retry' }
}
