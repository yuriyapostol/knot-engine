export interface ViewerMessages {
  interact: string; exit: string; reset: string; fit: string; zoomIn: string; zoomOut: string
  guides: string; grid: string; axes: string; ticks: string; coordinateLabels: string
  loading: string; empty: string; unavailable: string; retry: string
}
export const messages: Record<'en' | 'uk', ViewerMessages> = {
  en: { guides: 'Guides', grid: 'Grid', axes: 'Axes / indices', ticks: 'Ticks', coordinateLabels: 'Coordinate labels', interact: 'Interact with model', exit: 'Stop interacting', reset: 'Reset view', fit: 'Fit model', zoomIn: 'Zoom in', zoomOut: 'Zoom out', loading: 'Loading model…', empty: 'No model selected', unavailable: 'Unable to display model', retry: 'Retry' },
  uk: { guides: 'Орієнтири', grid: 'Сітка', axes: 'Осі / індекси', ticks: 'Поділки', coordinateLabels: 'Координатні підписи', interact: 'Взаємодіяти з моделлю', exit: 'Завершити взаємодію', reset: 'Скинути вид', fit: 'Умістити модель', zoomIn: 'Збільшити', zoomOut: 'Зменшити', loading: 'Завантаження моделі…', empty: 'Модель не задано', unavailable: 'Не вдалося показати модель', retry: 'Повторити' }
}
