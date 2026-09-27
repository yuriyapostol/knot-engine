# Специфікація knot-viewer

Дата: 2026-09-27. Документ для реалізації окремого пакета. Продукт має власний публічний API, формат даних та демонстраційну сторінку. Конкретні імена API й технічні параметри тут запропоновані та стабілізуються після прототипу.

## Призначення

Переносимий Vue-компонент будує геометрію мотузки за контрольними точками та показує інтерактивну 3D-модель. Підтримує клієнтський рендеринг, SSR із hydration, настільні й сенсорні браузери та сумісні WebView. Окремі можливості — генерація статичних зображень і демонстраційна сторінка.

Вхід компонента — дані моделі. Джерело й спосіб зберігання цих даних визначає користувач бібліотеки. model.id є непрозорим рядком, наприклад examples/loops/sample; він не інтерпретується як шлях до файла, URL або DOM-селектор.

## Перший реліз

Обов'язкові: статичні моделі з однією або кількома кривими, керування камерою, reset/fit, touch і клавіатура, локалізовані контролі uk/en, poster fallback, зміна моделі без remount, контроль життєвого циклу й ресурсів, export зображення та демка. Перевірка формату до створення геометрії обов'язкова навіть для локальних assets.

Не входять: редактор вузлів, фізична симуляція, автоматичне визначення правильності вузла, та інший, неописаний в специфікації функціонал. Кроки зав'язування й анімація — наступний реліз, не прихована частина v1.

## Архітектура пакета

Рекомендація: Vue 3 peer dependency, Three.js як залежність реалізації. Узгодити підтримані версії Node/Vue/Three.js під час прототипу й зафіксувати lockfile. Залежності встановлюються менеджером пакетів; не включати вручну скопійовані збірки рушія.

```text
src/
  index.ts                  публічний Vue API
  core/                     типи, validation, нормалізація даних без DOM
  geometry/                 спільний builder Three.js geometry
  renderer/                 scene, camera, controls, lifecycle, capture
  components/KnotViewer.vue
  locales/                  uk/en, типізовані ключі
  styles/                   явний CSS export
examples/models/            невеликі локальні fixture-моделі
demo/                       окремий Vue + Vite застосунок
scripts/preview/            browser harness/CLI для CI-прев'ю
tests/                      meaningful contract/integration/browser tests
docs/
```

Пропоновані package entry points: кореневий Vue export, /core для типів і validateModel без WebGL/DOM, /styles.css та /preview для окремої інтеграції capture за потреби. CLI/harness не має потрапляти в клієнтський bundle. Geometry builder спільний у viewer і preview, не дві незалежні реалізації.

Публічний API не повертає Three.js scene/material/renderer як стабільний контракт. Це дозволяє змінювати внутрішню реалізацію. Vue й типи external у library build; Three.js не дублювати окремо для controls. Документувати фактичні bundle sizes і перевіряти tree shaking, а не обіцяти lazy-loading лише через наявність кількох файлів. Host може завантажувати компонент через defineAsyncComponent.

Контролі мають власні базові стилі й не потребують сторонньої UI-бібліотеки. Користувач бібліотеки може замінити toolbar/fallback slots і налаштувати кольори через публічні CSS-токени.

## Запропонований Vue API

| Prop | Тип / default | Поведінка |
| --- | --- | --- |
| model | KnotModelV1 або null | Не мутується; null означає відсутність моделі |
| label | string, обов'язковий | Доступна назва конкретної моделі, задається host мовою контенту |
| description | string, optional | Текстова альтернатива/пояснення до моделі |
| poster | string, optional | Уже резолвлений URL локального/дозволеного host зображення |
| locale | 'uk' або 'en', default 'uk' | Мова вбудованих контролів; default не залежить від navigator під час SSR |
| messages | Partial<ViewerMessages> | Override локалізованих рядків, без i18n-framework dependency |
| theme | 'light' або 'dark', default 'light' | Host визначає system mode; змінює renderer і контролі узгоджено |
| quality | 'low'/'medium'/'high', default 'medium' | Tessellation/DPR budget, не змінює контрольні точки |
| active | boolean, default true | Дозволяє host призупиняти viewer, наприклад при прихованому екрані |
| interactive | boolean, default true | false вимикає controls/input, але дозволяє статичний render/capture |
| showControls | boolean, default true | Видимість toolbar; host відповідає за альтернативні controls при false |
| initialCamera | CameraView, optional | Перекриває модельну preview camera; інакше preview → auto-fit |

Розмір задається CSS контейнера, не window.innerWidth. Компонент має документований default aspect-ratio та min-height, підтримує resize. Для нового object reference model: скасувати стару підготовку, провалідувати, перебудувати й звільнити старі ресурси, застосувати початкову камеру. Глибока мутація масивів точок не є підтриманим update API v1; host передає новий об'єкт.

Валідна заміна initialCamera скидає вид за тим самим правилом, тема/locale не перебудовують геометрію, якість змінює лише tessellation. При невалідній новій моделі показати error/fallback, а не видавати стару геометрію за нову.

Події:

- ready: { modelId?, schemaVersion, warnings } після першого успішного render поточної моделі; один раз на завантаження/відновлення контексту. Не emit для скасованої моделі.
- error: { code, message, issues?, recoverable }, без кидання необробленої помилки в host render. Коди: INVALID_MODEL, UNSUPPORTED_SCHEMA, LIMIT_EXCEEDED, WEBGL_UNAVAILABLE, CONTEXT_LOST, RENDER_FAILED, CAPTURE_FAILED.
- camera-change: CameraView після завершення взаємодії, не кожен frame. Немає аналітики чи мережевої відправки всередині пакета.

Expose methods: resetView(), fitToView(), capture(options): Promise<Blob>. Capture до ready відхиляється типізованою помилкою; unmount/context loss скасовує незавершені операції. Reset і fit до ready безпечні no-op. Slots: toolbar (reset/fit/zoom callbacks + state), fallback (state/error/poster), loading; їхні props задокументувати в types.

Мінімальний приклад майбутнього API (import path залежить від npm-назви):

```vue
<KnotViewer
  :model="model"
  label="Модель вузла"
  poster="/images/knot-preview.png"
  locale="uk"
  theme="light"
  @error="handleViewerError"
/>
```

model приймає об'єкт із даними. Завантаження файла або перетворення зовнішнього ідентифікатора на об'єкт виконується до передачі prop; неявного fetch усередині компонента немає.

## Керування й доступність

Миша: drag для orbit, масштабування після активації viewer. Touch: окремий режим «Взаємодіяти з моделлю», щоб стаття прокручувалась одним пальцем до активації; після активації один палець обертає, pinch масштабує, є явний вихід із режиму. Escape виходить і повертає стандартне прокручування. Wheel не перехоплює прокручування сторінки без фокусу/активації. Pan у v1 можна вимкнути, якщо він не потрібен сценарію; reset/fit завжди повертають видиму модель.

Клавіатура на сфокусованому viewer: стрілки обертають, +/- масштабують, Home скидає камеру; доступні еквівалентні кнопки. Не перехоплювати клавіші глобально. Видимий focus, семантичні button, label та текстова альтернатива; canvas сам собою не передає форму screen reader. Повідомлення про помилку оголошується один раз, зміни камери не заповнюють live region. Reduced motion вимикає плавний reset/damping, самостійного auto-rotate у v1 немає.

Обмеження камери не дозволяють пройти всередину об'єкта/втратити його через zoom; near/far розраховуються з bounding box, а не фіксованого масштабу моделі. Perspective camera і framing мають враховувати aspect-ratio. На вузькому екрані кнопки залишаються доступними, touch targets не менші за 44 CSS px як проєктний критерій.

## SSR, офлайн і життєвий цикл

Імпорт пакета і SSR render не звертаються до window/document/WebGL. Сервер і перший клієнтський render показують ту саму оболонку/poster, GPU створюється після mount. Сумісність перевірити через SSR + hydration, із перевіркою відсутності hydration mismatch. Відсутність poster не повинна породжувати мережевий запит або порожній необмежений canvas.

Без зовнішніх запитів зсередини пакета: шрифти, icons, матеріали й shaders локальні, textures у v1 не потрібні. poster надає host і відповідає за доступність URL. Renderer не містить eval/довільних shaders із JSON. Модель — дані, новий код розповсюджується версією пакета.

Стани: empty → initializing → ready; із initializing/ready можливий error; active=false, hidden tab/viewport або context loss призупиняють роботу. Поки документ hidden, кадри не плануються. Для нерухомої моделі render-on-demand; damping планує кадри лише доки триває рух. IntersectionObserver оптимізує невидимі instances, active лишається явним host API.

Використати ResizeObserver, не припускати fullscreen. Нульовий розмір контейнера відкладає render, не ділить на нуль. При unmount від'єднати listeners/observers/controls, скасувати animation frame/capture, dispose renderer/geometries/materials. Спільні geometry pipe/outline не dispose двічі. Кілька viewer instances не ділять камеру, DOM ID або mutable state.

Context loss: припинити рендер, показати poster/стан, emit помилку; відновлення за browser event перебудовує ресурси з поточної моделі й дає ready. За повторного збою — керована кнопка retry, без нескінченного циклу. Зовнішній контейнер може синхронізувати active зі своїм життєвим циклом.

## Прев'ю карток

Один geometry builder та версійований preset застосовуються для viewer й карток. Capture(options) підтримує width/height, format='image/png' у v1, view='current' або 'model-preview', opaque/transparent background. Default — current, 512×512, opaque. Upper bound — 2048×2048 у v1; перевірити ресурсні бюджети перед збільшенням.

Захоплення не змінює видиму користувацьку камеру/розмір; використати окремий target або надійне тимчасове збереження/відновлення стану. Render у потрібному aspect-ratio з framing, readback з правильною орієнтацією та alpha; результат — Blob, без автоматичного download. Demo може завантажити його сама. Не лишати preserveDrawingBuffer=true за замовчуванням заради export.

CLI/harness запускає browser renderer у CI, чекає ready, викликає capture(view='model-preview') і пише image asset. Результат кешується за model data + preset + camera + renderer version + output size. Фіксуються browser/Three.js versions; pixel-identical картинки на різних GPU не гарантуються. Помилка capture зупиняє генерацію обов'язкової картки, не дає порожній image.

У demo та browser capture мають працювати без Node APIs; Node потрібний лише CI harness. Згенероване зображення є окремим результатом API; спосіб його зберігання визначає користувач бібліотеки.

## Темізація

Явний stylesheet export, без прихованого global reset. Префікс CSS класів/токенів --knot-viewer-*. Мінімальні токени: background, foreground, border, focus, toolbar-background, error; їхні default light/dark значення забезпечують самостійне використання. SVG/icons локальні. Renderer preset визначає мотузку/outline; CSS не змінює 3D-матеріали неявно. Theme prop узгоджує preset defaults, явний preview preset має стабільний вигляд незалежно від теми сторінки.

Публічні CSS-токени дозволяють узгодити вигляд компонента з довільною дизайн-системою. uk/en мають повний однаковий набір ключів, мова моделі й label може відрізнятися від мови toolbar. Додати нову мову можна через messages, не змінюючи формат геометрії.

## Приймання й план

1. Типи/validation і fixture імпорту старого прототипу. Валідатор повертає результат із шляхами до помилок, не змінює вхід.
2. Geometry/renderer: відкрита, замкнена та дві незалежні мотузки; reset/fit, шов, resize, capture, disposal.
3. Vue API, SSR/hydration та lifecycle; заміна моделі під час підготовки, кілька instances, context loss, offline.
4. Demo за demo.md та генератор preview; controls миші/touch/клавіатури, uk/en, light/dark.
5. Пакування: typecheck, library/demo build, npm pack і встановлення tarball у чисті клієнтський Vue та Vue SSR fixtures. Якщо версія Vue peer підтримує діапазон — перевірити його нижню межу.
6. Перевірка на сенсорних пристроях і в WebView: scroll vs orbit/pinch, background/resume, offline, memory. Матрицю підтриманих браузерів і версій середовищ опублікувати за результатами фактичних перевірок; емуляцію не видавати за перевірку на пристрої.

Обов'язкові перевірки: malformed/oversized input, unsupported schema, duplicate IDs/points, invalid camera; geometry finite/bounds; closed seam; відсутність зайвих кадрів у спокої; відсутність listeners/resources після repeated mount/unmount; SSR без DOM; fallback без WebGL; export валідного PNG; model changes не дають stale ready/capture. Візуальні регресії — на фіксованому browser середовищі з допуском, не точне порівняння на довільному GPU.

Зафіксувати bundle gzip, cold viewer startup, кількість triangles та frame time на визначеному базовому сенсорному пристрої. До вибору базового пристрою числову обіцянку FPS не давати. Початкові захисні ліміти формату — model-format.md; зміни на основі вимірювання явно версіонувати/документувати.

Реліз готовий, коли приклад використання з tarball працює у двох web consumers, демка зібрана, наведені сценарії протестовані, відомі обмеження опубліковані. Publishing npm/GitHub Pages — окрема дія після готового результату; цей документ не означає, що щось уже опубліковано.

## Приклад і технічні довідки

Локальний fixture examples/models/prototype-loop.json містить замкнену криву з шести контрольних точок. Використовувати його для початкової перевірки форми й камери разом із прикладами відкритої кривої та кількох мотузок. closed застосовується узгоджено до кривої та її оболонки; frame loop і resize мають відповідати життєвому циклу компонента.

Первинні довідки: [CatmullRomCurve3](https://threejs.org/docs/pages/CatmullRomCurve3.html), [Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html). Перед реалізацією перевірити API саме обраної версії залежностей.
