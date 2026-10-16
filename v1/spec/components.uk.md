# `KnotViewer`

Vue 3 компонент для одного статичного просторового представлення [`KnotAsset`](knot-asset.uk.md). Для оновлення геометрії замініть об’єкт документа; глибока зміна на місці не підтримується. Валідація й вибір завершуються до виділення WebGL. Документ лише із сітковою діаграмою є допустимим, але не підтримується цим компонентом.

| Властивість компонента | Значення |
| --- | --- |
| `asset?: KnotAsset \| null` | Вхід; null/відсутність показує порожній стан |
| `label: string` | Обов’язковий доступний підпис |
| `representationId?: string` | Вибране представлення; типово перше представлення просторових кривих |
| `view?: Reference \| ViewDefinition` | Вибір ракурсу зі списку або явний повний ракурс |
| `registries?: KnotResourceRegistry[]` | Явні визначення зовнішніх ресурсів |
| `initialCamera?: Camera3D` | Перевизначення камери застосунком |
| `description?`, `poster?` | Доступний опис і URL резервного зображення |
| `locale?: 'uk' \| 'en'`, `messages?` | Мова UI (типово uk) і перевизначення повідомлень |
| `theme?: 'light' \| 'dark'` | Типово light |
| `quality?: 'low' \| 'medium' \| 'high'` | Типово medium; бюджет трикутників може зменшити якість |
| `active?`, `interactive?`, `showControls?` | Булеві перемикачі, типово всі true |

Події: `ready({assetId?,schemaVersion:1,warnings})`, `error({code,message,issues?,recoverable})`, `camera-change(CameraView)`. `CameraView` — повний опис камери у фіксованому режимі: `position`, `target`, `up` та `projection`; перспективний FOV у радіанах. Коди помилок: `INVALID_MODEL`, `UNSUPPORTED_SCHEMA`, `LIMIT_EXCEEDED`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `RENDER_FAILED`, `CAPTURE_FAILED`.

Методи: `resetView()`, `fitToView()`, `capture(options?): Promise<Blob>`. Параметри знімка: `width`, `height`, `format:'image/png'`, `view:'current'|'model-preview'`, `transparent`. Типовий розмір 512×512; розміри — цілі числа в 1..2048. Знімок поточного ракурсу (`current`) зберігає поточний вид, коригуючи перспективний FOV для вужчого результату. Знімок попереднього перегляду (`model-preview`) незалежно готує авторський ракурс під пропорції результату. Знімок не змінює камеру на екрані.

Слоти: `toolbar({reset,fit,zoomIn,zoomOut,ready,touchActive})`, `fallback({state,error,poster})`, `loading({state})`. Стани: `empty`, `initializing`, `ready`, `error`. SSR створює стабільне резервне відображення без WebGL. При демонтуванні компонент прибирає обробники подій, спостерігачі та ресурси GPU; рендеринг призупиняється при неактивності, прихованій вкладці або виході за область перегляду.

Імпортуйте `knot-engine/styles.css`. CSS-класи та змінні `--knot-viewer-*` доступні для оформлення. Кнопки панелі та стрілки клавіатури керують камерою. Сенсорне обертання/масштабування й передавання прокрутки підтримуються; перевірка реальних touch/WebView відокремлена від headless-браузера. Автоматичного завантаження даних або анімації немає. Бюджет геометрії — 100,000 трикутників; якість знижується до виділення пам’яті або повертається помилка, якщо навіть low завелика.
