# KnotViewer

Vue 3 компонент для одного статичного просторового представлення [`Asset`](asset.uk.md). Для оновлення геометрії замініть об’єкт `Asset`; глибока зміна на місці не підтримується. Валідація й вибір завершуються до виділення WebGL. Об’єкт `Asset` лише із сітковою діаграмою є допустимим, але не підтримується цим компонентом.

| Властивість компонента | Значення |
| --- | --- |
| `asset?: Asset \| null` | Вхід; null/відсутність показує порожній стан |
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

Імпортуйте `knot-engine/styles.css`. Кнопки панелі та стрілки клавіатури керують камерою. Сенсорне обертання/масштабування й передавання прокрутки підтримуються; перевірка реальних touch/WebView відокремлена від headless-браузера. Автоматичного завантаження даних або анімації немає. Бюджет геометрії — 100,000 трикутників; якість знижується до виділення пам’яті або повертається помилка, якщо навіть low завелика.

## Простір імен CSS та оформлення

Кореневий клас поточного компонента — `.knot-engine-v1-viewer`; класи частин — `.knot-engine-v1-viewer__surface`, `.knot-engine-v1-viewer__canvas`, `.knot-engine-v1-viewer__fallback`, `.knot-engine-v1-viewer__poster`, `.knot-engine-v1-viewer__toolbar`. Корінь має `data-theme="light|dark"` і `data-state="empty|initializing|ready|error"`.

Простір імен CSS пакета — `knot-engine-v1`; `viewer` позначає цей компонент у його межах. Інші компоненти використовують власні назви зі спільним префіксом пакета/покоління. `v1` охоплює пакети `0.x` і подальші `1.x`; наступні покоління використовують класи `.knot-engine-v2-viewer…` та змінні `--knot-engine-v2-viewer-*`. Це дозволяє використовувати різні мажорні версії на одній сторінці. Незаверсійовані псевдоніми не додаються.

На початковій стадії розробки зворотна сумісність не вимагається, зокрема й для CSS. Простір імен не фіксує класи, змінні, розмітку або оформлення між випусками одного покоління й не гарантує взаємозамінність їхніх таблиць стилів. Кожний переглядач слід використовувати зі стилями відповідного випуску.

Переважний спосіб налаштування — публічні CSS-змінні `--knot-engine-v1-viewer-*`. Задавайте їх на контейнері для наслідування або на конкретному компоненті через `class`/`style`. Пакет не присвоює публічним змінним власні значення на корені: якщо перевизначення немає, застосовується типове значення. Приватні змінні `--_knot-engine-v1-viewer-*` зберігають палітру теми й не є публічним API. Явне перевизначення має пріоритет в обох темах; для різних кольорів тем застосунок може використати селектор `[data-theme=dark]`.

| Змінна | Типово (light / dark для кольорів) | Призначення |
| --- | --- | --- |
| `--knot-engine-v1-viewer-background` | `#f8f5ef / #171b24` | Фон переглядача й кнопок |
| `--knot-engine-v1-viewer-foreground` | `#29231d / #f2eee8` | Колір тексту |
| `--knot-engine-v1-viewer-border` | `#c9bdae / #3f4652` | Колір рамок |
| `--knot-engine-v1-viewer-focus` | `#1467b6 / #91c6ff` | Колір фокуса клавіатури |
| `--knot-engine-v1-viewer-toolbar-background` | `#fffdf7e8 / #242a34e8` | Фон панелі керування |
| `--knot-engine-v1-viewer-error` | `#9b2525 / #ffb0a7` | Колір тексту помилки |
| `--knot-engine-v1-viewer-aspect-ratio` | `4/3` | Пропорції переглядача |
| `--knot-engine-v1-viewer-min-height` | `260px` | Мінімальна висота переглядача |
| `--knot-engine-v1-viewer-border-width` | `1px` | Товщина рамок |
| `--knot-engine-v1-viewer-radius` | `12px` | Радіус кутів переглядача |
| `--knot-engine-v1-viewer-toolbar-offset` | `12px` | Відступ панелі з боків і знизу |
| `--knot-engine-v1-viewer-toolbar-gap` | `6px` | Проміжок між елементами панелі |
| `--knot-engine-v1-viewer-toolbar-padding` | `6px` | Внутрішній відступ панелі |
| `--knot-engine-v1-viewer-toolbar-radius` | `10px` | Радіус кутів панелі |
| `--knot-engine-v1-viewer-button-min-size` | `44px` | Мінімальні ширина й висота кнопки |
| `--knot-engine-v1-viewer-button-padding` | `6px 10px` | Внутрішній відступ кнопки |
| `--knot-engine-v1-viewer-button-radius` | `7px` | Радіус кутів кнопки |

```vue
<template>
  <section class="knot-gallery">
    <KnotViewer :asset="asset" label="Rope" />
    <KnotViewer :asset="otherAsset" label="Other rope"
      style="--knot-engine-v1-viewer-background: #ffffff" />
  </section>
</template>

<style>
.knot-gallery {
  --knot-engine-v1-viewer-radius: 0px;
  --knot-engine-v1-viewer-aspect-ratio: 1;
  --knot-engine-v1-viewer-toolbar-gap: 8px;
}
</style>
```

Ці змінні оформлюють HTML-інтерфейс, а не WebGL-матеріали, освітлення чи фон PNG. Властивість `theme` продовжує керувати палітрою 3D; `capture` використовує власний фон відповідно до теми/режиму, або прозорий при `transparent:true`. Менші кнопки можуть погіршити зручність сенсорного керування; типово збережено 44px.

Це рішення проєкту: назви пакета, покоління й компонента розділяють стилі різних компонентів і мажорних версій. Наслідувані змінні дозволяють оформлювати групу чи один екземпляр без зміни внутрішньої розмітки. Правила публікації описані в [design](../../design/publication.uk.md).
