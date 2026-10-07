# knot-engine

[English](README.md) | [Українська](README.uk.md)

Пакет для моделювання й рендерингу вузлів із Vue 3 компонентом `KnotViewer`. KnotAsset v1 є авторитетним доменним форматом; legacy KnotModelV1 підтримується протягом міграції. Пакет містить валідацію, рендеринг статичних 3D-станів, керування камерою, резервне відображення для SSR, захоплення PNG і локальний демонстраційний застосунок.

## Локальний запуск

Потрібні Node 20.19+ та npm.

```sh
npm ci
npm run dev:demo
```

Відкрийте URL, який виведе Vite. Команди перевірки:

```sh
npm run typecheck
npm test
npm run build
npm run build:demo
npm run test:browser
npm run test:package
npm pack --dry-run
```

Щоб згенерувати PNG для картки, виконайте `npm run preview:model -- --model examples/models/prototype-loop.json --out /tmp/knot-preview.png`. Скрипт використовує локальний Chrome (або `CHROME_PATH`) і кешує результат за моделлю, розміром, браузером та версією renderer.

Робоча назва пакета — `knot-engine`; реліз у npm ще не публікувався. Збірка бібліотеки міститься в `dist/`, а збірка демо — у `demo-dist/`. Для збірки демо за підшляхом проєкту задайте `BASE_PATH=/your-path/`.

## Демо на GitHub Pages

[Workflow Pages](.github/workflows/pages.yml) збирає й публікує `demo-dist/` після push у `main` або ручного запуску на `main`. Перед цим мають пройти typecheck і модульні тести. Базовий шлях Vite береться з метаданих GitHub Pages: `/knot-engine/` для цього репозиторію та `/` для налаштованого власного домену. Особистий токен доступу або додаткові secrets не потрібні.

1. У репозиторії відкрийте **Settings → Pages → Build and deployment** і виберіть **GitHub Actions** у полі **Source**. Див. [інструкції GitHub щодо джерела публікації](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
2. Зробіть коміт і push workflow та змін демо в `main`.
3. Відкрийте **Actions → Deploy demo to GitHub Pages** і перевірте успішне завершення обох jobs: `build` та `deploy`. Для ручного повторного запуску виберіть **Run workflow** і гілку `main`.
4. Відкрийте URL із deployment `github-pages`. Очікувана стандартна адреса — [yuriyapostol.github.io/knot-engine/](https://yuriyapostol.github.io/knot-engine/).

Якщо Actions вимкнено, увімкніть їх у **Settings → Actions → General** і дозвольте офіційні actions `actions/*`, які використовує workflow. Якщо середовище `github-pages` обмежує гілки публікації, дозвольте `main` у **Settings → Environments → github-pages**. Workflow сам задає потрібні права токена. Згенеровані файли не потрібно комітити в гілку `gh-pages`. Локальна перевірка не означає, що сайт уже опубліковано.

## Використання

```vue
<script setup lang="ts">
import { KnotViewer, type KnotModelV1 } from 'knot-engine'
import 'knot-engine/styles.css'
defineProps<{ model: KnotModelV1 }>()
</script>

<template>
  <KnotViewer :model="model" label="Rope model" locale="en" />
</template>
```

Імпортуйте `validateKnotAsset`, `validateKnotModelV1` (legacy-псевдонім: `validateModel`) і типи з `knot-engine/core`, щоб перевіряти авторські дані без завантаження viewer. Нове посилання на об'єкт моделі спричиняє перебудову; зміна масивів точок на місці не підтримується. Компонент ніколи самостійно не завантажує дані моделі.

Відкриті методи: `resetView()`, `fitToView()` і `capture({ width, height, view, transparent })`, який повертає PNG `Blob` через Promise. `view` має значення `current` (за замовчуванням) або `model-preview`; стандартний розмір — 512×512, максимальний — 2048×2048. Події: `ready`, `error` і `camera-change`. Див. [специфікацію API](docs/specification.uk.md), [формат моделі](docs/model-format.uk.md) та [JSON Schema](schema/knot-model-v1.schema.json).

За замовчуванням viewer має співвідношення сторін 4:3 і мінімальну висоту 260px. Ці значення можна перевизначити на елементі компонента. Кольори панелі інструментів налаштовуються через CSS-властивості `--knot-viewer-*` із `src/styles.css`. На сенсорному екрані перетягування обертає модель, а жест двома пальцями змінює масштаб. Вертикальне перетягування за межі кутів обертання прокручує сторінку; зміна напрямку відновлює обертання.

## KnotAsset v1

```vue
<script setup lang="ts">
import { KnotViewer, type KnotAsset } from 'knot-engine'
import 'knot-engine/styles.css'
defineProps<{ asset: KnotAsset }>()
</script>

<template>
  <KnotViewer :asset="asset" representation-id="view-3d" snapshot-id="rest" label="Rope snapshot" />
</template>
```

Передавайте або `asset`, або legacy `model`. Якщо ID вибору не задані, використовується перше 3D-представлення та його перший snapshot. Зміна вибору перебудовує статичний вид, а не анімує кроки. Валідація завершується до виділення пам'яті під геометрію. Діаметр мотузки визначає товщину трубки; за відсутності розмірів і для кривих інших типів елементів використовується задокументований радіус відображення з попередженням.

[**Специфікація KnotAsset v1**](docs/knot-asset-v1.uk.md) · [JSON Schema KnotAsset](schema/knot-asset-v1.schema.json) · [Архітектура, міграція та політики реалізації](docs/architecture.uk.md) · [Технічні приклади](examples/assets/)

Доменна модель підтримує 2D-представлення, перехрещення, алгоритми й варіанти. Перший шлях рендерингу показує один 3D snapshot. Імпорт `knot-engine/core` не завантажує Vue, Three.js або код DOM. `validateKnotAsset(value, { strict: true })` перевіряє авторські дані за структурним і семантичним контрактом, не змінюючи їх. `resolveKnotAsset` і `resolveKnotModelV1` надають явні адаптери до внутрішніх даних рендерингу. Спільний номер версії ніколи не використовується для визначення формату.

## Документація

[Англійська](README.md) та [українська](README.uk.md) версії документації рівнозначні. Змінюючи вимогу, API або політику реалізації, оновлюйте обидві версії разом. Технічні ідентифікатори, виконувані приклади й числові ліміти мають залишатися узгодженими; пояснення та підписи інтерфейсу можна локалізувати. Посилання всередині кожної версії ведуть на документи тією самою мовою.

| Документ | Зміст |
| --- | --- |
| [KnotAsset v1](docs/knot-asset-v1.uk.md) | Авторитетна специфікація доменних даних |
| [Архітектура та міграція](docs/architecture.uk.md) | Політики реалізації, сумісність і поточні обмеження |
| [Специфікація KnotViewer](docs/specification.uk.md) | API компонента та збережені критерії приймання |
| [Legacy-формат моделі](docs/model-format.uk.md) | Контракт статичної геометрії KnotModelV1 для рендерингу |
| [Демонстраційний застосунок](docs/demo.uk.md) | Поведінка демо та план приймання |

## Поточні обмеження

Автоматизовані перевірки охоплюють валідацію, геометрію, SSR/hydration, браузерне захоплення зображень і споживача tarball. Поведінка на реальних сенсорних пристроях та у WebView, мінімальні підтримувані версії peer-залежностей і генерація зображень на CI runner ще потребують перевірки. Браузерне захоплення використовує GPU-рендеринг, тому пікселі можуть відрізнятися між пристроями. Геометрія має просту поверхню мотузки та контур; вона не перевіряє фізичну правильність вузла.

Ліцензія репозиторію міститься у [LICENSE](LICENSE).
