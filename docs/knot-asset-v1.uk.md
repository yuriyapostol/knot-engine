# Knot Engine — KnotAsset v1

[English](knot-asset-v1.md) | [Українська](knot-asset-v1.uk.md) · [Документація](../README.uk.md)

Це авторитетна специфікація доменних даних knot-engine. [Політики реалізації та архітектура міграції](architecture.uk.md) окремо документують числові ліміти, невизначені деталі та межі першого renderer.

## 1. Призначення

`KnotAsset` — еталонний машинний опис одного вузла в широкому розумінні.

Один asset може містити:

- один або кілька фізичних елементів;
- кілька незалежних 2D- і 3D-представлень;
- статичні та покрокові представлення;
- кілька алгоритмів зав'язування;
- альтернативні кінцеві форми та художні варіанти;
- представлення замкнених мотузок для теорії вузлів;
- рекомендовані параметри перегляду.

Формат описує дані вузла незалежно від Vue, Three.js, конкретного renderer, UI, локалізації та способу зберігання.

JSON є авторським джерелом даних. Three.js objects, meshes, textures, previews та інші render-specific результати є похідними даними.

---

# 2. Коренева структура

```ts
interface KnotAsset {
  schemaVersion: 1
  id: string

  units: 'm'

  elements: KnotElement[]
  representations: Representation[]

  algorithms?: Algorithm[]
  variants?: Variant[]
}
```

Приклад:

```json
{
  "schemaVersion": 1,
  "id": "bowline",
  "units": "m",

  "elements": [],
  "representations": [],
  "algorithms": [],
  "variants": []
}
```

`id` є непрозорим стабільним ідентифікатором вузла. Він не є URL, шляхом до файла або локалізованою назвою.

`schemaVersion` версіонує саме контракт `KnotAsset`.

Версія npm-пакета `knot-engine`, версія renderer та версії presentation presets є незалежними від `schemaVersion`.

---

# 3. Елементи (Elements)

`Element` — фізичний або концептуальний об'єкт, що входить до композиції вузла.

Початково визначаються три типи:

```ts
type KnotElement =
  | RopeElement
  | SupportElement
  | CarabinerElement
```

У майбутньому список може бути розширений.

## 3.1 Мотузка (Rope)

```ts
interface RopeElement {
  id: string
  type: 'rope'

  topology: 'open' | 'closed'

  ends: RopeEnd[]

  length?: number
  diameter?: number

  subtype?: string
}
```

Приклад звичайної мотузки:

```json
{
  "id": "rope-1",
  "type": "rope",

  "topology": "open",

  "ends": [
    { "id": "a" },
    { "id": "b" }
  ],

  "length": 2.0,
  "diameter": 0.01
}
```

### topology

`topology` описує фізичну структуру мотузки, а не геометричну форму конкретного representation.

```text
open
```

означає фізично відкриту мотузку.

```text
closed
```

означає замкнений шнур/петлю без фізичних кінців.

Це поняття не слід змішувати з `geometry.closed`.

### ends

`ends` містить кінці, доступні для маніпуляцій у межах описуваної задачі.

Відкрита мотузка може мати:

```text
2 accessible ends
1 accessible end
0 accessible ends
```

Наприклад:

```json
{
  "topology": "open",
  "ends": [
    { "id": "a" },
    { "id": "b" }
  ]
}
```

— доступні обидва кінці.

```json
{
  "topology": "open",
  "ends": [
    { "id": "a" }
  ]
}
```

— доступний один кінець; інший може бути закріплений, приєднаний до вантажу, людини тощо.

```json
{
  "topology": "open",
  "ends": []
}
```

— доступна лише частина мотузки, але жоден фізичний кінець недоступний.

Для:

```json
{
  "topology": "closed",
  "ends": []
}
```

мотузка фізично замкнена.

Для `topology: "closed"` непорожній `ends` є помилкою validation.

`ends` не описує connections з іншими об'єктами.

Connections у KnotAsset v1 не визначаються.

### length і diameter

Фізичні розміри задаються в метрах.

```json
{
  "length": 1.5,
  "diameter": 0.01
}
```

означає 1,5 м і 10 мм.

Обидва поля optional.

Довжина `geometry` не зобов'язана точно дорівнювати `length`.

---

## 3.2 Опора (Support)

```ts
interface SupportElement {
  id: string
  type: 'support'
  subtype?: string
}
```

`support` представляє опору, навколо або відносно якої формується вузол.

Конкретні конструктивні параметри додаються лише за реальною потребою.

---

## 3.3 Карабін (Carabiner)

```ts
interface CarabinerElement {
  id: string
  type: 'carabiner'
  subtype?: string
}
```

Конструктивні параметри карабіна не стандартизуються в KnotAsset v1.

---

# 4. Представлення (Representations)

`Representation` — конкретне координатне представлення вузла.

Один KnotAsset може містити довільну кількість незалежних representations.

```ts
interface Representation {
  id: string
  dimension: 2 | 3

  snapshots: Snapshot[]

  presentation?: Presentation
}
```

Наприклад:

```json
{
  "id": "primary-3d",
  "dimension": 3,
  "snapshots": []
}
```

або:

```json
{
  "id": "instruction-diagram",
  "dimension": 2,
  "snapshots": []
}
```

`id` не має прихованої семантики. Не слід визначати тип representation за значеннями на кшталт `spatial`, `diagram` тощо.

Формальну dimensionality задає `dimension`.

Один asset може містити кілька representations з однаковою dimensionality.

---

# 5. Стани геометрії (Snapshots)

`Snapshot` — стан геометрії representation у певний момент або логічний етап.

```ts
interface Snapshot {
  id: string
  elements: SnapshotElement[]

  crossings?: Crossing[]
}
```

Приклад:

```json
{
  "id": "finished",

  "elements": [
    {
      "id": "rope-1",
      "geometry": {
        "type": "curve",
        "closed": false,
        "interpolation": {
          "type": "catmullrom",
          "tension": 0.7
        },
        "points": [
          [0, 0, 0],
          [0.1, 0.2, 0.1],
          [0.3, 0.4, 0.2]
        ]
      }
    }
  ]
}
```

Snapshots належать конкретному Representation.

2D- і 3D-representations не зобов'язані мати однаковий набір snapshots.

Наприклад:

```text
primary-3d
├── start
├── loop
├── pass-through
├── wrap
└── finished

instruction-2d
├── start
├── loop
├── wrap
└── finished
```

Вони можуть описувати той самий процес із різною кількістю логічних станів.

Representation може містити лише один Snapshot. Наявність Algorithm для статичного representation не вимагається.

---

# 6. Елемент стану (SnapshotElement)

```ts
interface SnapshotElement {
  id: string
  geometry: Geometry
}
```

`id` посилається на `KnotAsset.elements[].id`.

Фізичні властивості Element не дублюються в Snapshot.

Snapshot містить лише стан, який може змінюватися між snapshots.

---

# 7. Геометрія (Geometry)

`geometry` — універсальна назва координатної геометрії Element.

У KnotAsset v1 визначається:

```ts
type Geometry = CurveGeometry
```

Архітектура повинна дозволяти в майбутньому додати інші типи:

```text
curve
mesh
primitive
...
```

без зміни семантики поля `geometry`.

## 7.1 Геометрія кривої (CurveGeometry)

```ts
interface CurveGeometry {
  type: 'curve'

  closed: boolean

  interpolation: {
    type: 'catmullrom'
    tension: number
  }

  points: Point[]
}
```

`Point` залежить від `Representation.dimension`.

Для 3D:

```ts
type Point3D = [number, number, number]
```

Для 2D:

```ts
type Point2D = [number, number]
```

Усі coordinates використовують `KnotAsset.units`.

### geometry.closed

`geometry.closed` означає лише геометричне замикання конкретної кривої.

Воно не визначає фізичну topology Element.

Наприклад, відкрита фізична мотузка може мати спеціальне теоретичне representation із замкненою geometry.

Перша точка не дублюється як остання. Замикання задається через `closed: true`.

---

# 8. Стабільна параметризація Element

Положення вздовж rope адресується нормалізованою координатою:

```text
u ∈ [0, 1]
```

Для відкритої мотузки:

```text
u = 0   → один край параметризованого Element
u = 1   → другий край
```

`u` описує стабільне положення вздовж самого Element, а не індекс конкретної контрольної точки і не частку довжини поточної spline.

Це дозволяє використовувати `u` після resampling geometry.

Ідентичність напрямку параметризації Element повинна залишатися стабільною між snapshots.

---

# 9. Відповідність контрольних точок

Для snapshots, що використовуються послідовно одним Algorithm для анімації, відповідний Element повинен мати однакову кількість контрольних точок та стабільний порядок цих точок.

Таким чином:

```text
snapshot A points[i]
```

відповідає:

```text
snapshot B points[i]
```

для того самого Element.

Це дозволяє renderer інтерполювати координати контрольних точок.

Формат KnotAsset v1 не гарантує, що проста лінійна інтерполяція створить фізично правильний рух мотузки.

Transitions та trajectories в KnotAsset v1 не специфікуються.

---

# 10. Перехрещення (Crossings)

`crossings` застосовуються лише до 2D Representation.

Вони не є частиною `Geometry`, оскільки описують відношення між двома ділянками geometry.

```ts
interface CrossingPoint {
  element: string
  u: number
}

interface Crossing {
  id?: string
  over: CrossingPoint
  under: CrossingPoint
}
```

Приклад:

```json
{
  "over": {
    "element": "rope-1",
    "u": 0.27
  },

  "under": {
    "element": "rope-1",
    "u": 0.73
  }
}
```

Crossings зберігаються в конкретному Snapshot 2D Representation, оскільки взаємне проходження ділянок може змінюватися між snapshots.

Для `dimension: 3` наявність `crossings` є validation error.

У 3D взаємне просторове положення визначається координатами geometry.

---

# 11. Алгоритми (Algorithms)

`Algorithm` описує один спосіб зав'язування вузла.

```ts
interface Algorithm {
  id: string
  representation: string
  steps: Step[]
}
```

Algorithm працює в межах одного Representation.

Це дозволяє мати незалежні алгоритми/послідовності для 3D та 2D:

```text
algorithm: standard-3d
representation: primary-3d

algorithm: standard-diagram
representation: instruction-2d
```

Вони не зобов'язані мати однакову кількість Steps.

## Крок (Step)

```ts
interface Step {
  id: string
  snapshot: string
}
```

`snapshot` посилається на Snapshot у Representation, визначеному через `Algorithm.representation`.

`Step` не є Snapshot.

Step є семантичним елементом алгоритму, а Snapshot — станом геометрії.

Це дозволяє надалі додавати до Step:

- локалізовані instructions;
- annotations;
- active elements/ends;
- hints;
- timing;
- інші навчальні metadata,

не змінюючи геометричну модель Snapshot.

У KnotAsset v1 Algorithm є лінійною послідовністю Steps.

Branching не визначається. Альтернативний спосіб зав'язування описується окремим Algorithm.

Transitions між Steps у KnotAsset v1 не описуються.

Їхня runtime-реалізація залишається відповідальністю knot-engine/viewer.

---

# 12. Варіанти (Variants)

`Variant` — іменоване посилання на конкретний Snapshot конкретного Representation.

```ts
interface Variant {
  id: string
  representation: string
  snapshot: string
}
```

Наприклад:

```json
{
  "id": "standard",
  "representation": "primary-3d",
  "snapshot": "finished"
}
```

або:

```json
{
  "id": "decorative-spread",
  "representation": "primary-3d",
  "snapshot": "decorative-spread"
}
```

Один Snapshot може одночасно:

- бути Variant;
- бути Step одного Algorithm;
- бути Step кількох Algorithms.

Variant не дублює geometry.

---

# 13. Параметри відображення (Presentation)

Presentation-параметри належать Representation, а не Snapshot.

Початково допускається:

```ts
interface Presentation {
  camera?: CameraView
  preset?: string
}
```

Для 3D:

```ts
interface CameraView {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}
```

Presentation не змінює семантику geometry.

Одна й та сама geometry може бути відображена різними renderer/presentation presets.

У майбутньому за потреби може бути додано кілька іменованих camera views.

---

# 14. Приклад мінімального KnotAsset

```json
{
  "schemaVersion": 1,
  "id": "bowline",
  "units": "m",

  "elements": [
    {
      "id": "rope-1",
      "type": "rope",
      "topology": "open",
      "ends": [
        { "id": "a" },
        { "id": "b" }
      ],
      "length": 2,
      "diameter": 0.01
    }
  ],

  "representations": [
    {
      "id": "primary-3d",
      "dimension": 3,

      "snapshots": [
        {
          "id": "start",
          "elements": [
            {
              "id": "rope-1",
              "geometry": {
                "type": "curve",
                "closed": false,
                "interpolation": {
                  "type": "catmullrom",
                  "tension": 0.7
                },
                "points": [
                  [0, 0, 0],
                  [0.5, 0, 0],
                  [1, 0, 0]
                ]
              }
            }
          ]
        },

        {
          "id": "finished",
          "elements": [
            {
              "id": "rope-1",
              "geometry": {
                "type": "curve",
                "closed": false,
                "interpolation": {
                  "type": "catmullrom",
                  "tension": 0.7
                },
                "points": [
                  [0, 0, 0],
                  [0.4, 0.3, 0.1],
                  [1, 0, 0]
                ]
              }
            }
          ]
        }
      ]
    }
  ],

  "algorithms": [
    {
      "id": "standard",
      "representation": "primary-3d",

      "steps": [
        {
          "id": "start",
          "snapshot": "start"
        },
        {
          "id": "finished",
          "snapshot": "finished"
        }
      ]
    }
  ],

  "variants": [
    {
      "id": "standard",
      "representation": "primary-3d",
      "snapshot": "finished"
    }
  ]
}
```

---

# 15. Валідація

Validator повинен щонайменше перевіряти:

- підтримуваний `schemaVersion`;
- унікальність Element IDs;
- унікальність Representation IDs;
- унікальність Snapshot IDs у межах Representation;
- унікальність Algorithm IDs;
- унікальність Variant IDs;
- існування всіх referenced IDs;
- `units === "m"` для v1;
- finite coordinates;
- правильну dimensionality points;
- допустимий `tension`;
- мінімальну кількість points;
- відсутність послідовних однакових points;
- відсутність дублювання першої точки в кінці closed curve;
- `u ∈ [0,1]`;
- crossings тільки для dimension=2;
- `topology:"closed"` → `ends.length === 0`;
- для `topology:"open"` не більше двох accessible ends;
- унікальність RopeEnd IDs;
- однакову кількість відповідних control points у snapshots, які послідовно використовуються Algorithm для анімації.

Resource limits мають бути окремо визначені й протестовані, а не неявно успадковані зі старого KnotModelV1.

---

# 16. Що навмисно не входить до KnotAsset v1

KnotAsset v1 не визначає:

- transitions;
- easing;
- trajectories;
- фізичну симуляцію;
- collision/contact model;
- connections між Elements;
- автоматичне визначення правильності вузла;
- механічну міцність;
- навантаження;
- довільний executable code;
- Three.js objects;
- shaders;
- зовнішні URL;
- спосіб завантаження asset;
- локалізовані навчальні тексти.

Ці можливості можуть бути додані окремими versioned capabilities після появи конкретних вимог.

---

# 17. Відношення до legacy KnotModelV1

Існуючий `KnotModelV1` не є KnotAsset v1.

Він розглядається як legacy/render-oriented формат статичної геометрії.

Під час міграції knot-engine може тимчасово підтримувати:

```text
KnotModelV1
      ↓
legacy adapter
      ↓
KnotAsset v1
```

або безпосередньо перетворювати legacy model у внутрішній renderable representation.

Не слід змінювати значення старого `schemaVersion: 1`, щоб воно мовчки означало новий KnotAsset.

`KnotAsset.schemaVersion: 1` належить новому окремому schema contract.

Тип root object повинен визначатися явним validator/entry point, а не вгадуватися лише за числом `schemaVersion`.

---

# 18. Архітектурний принцип knot-engine

Рекомендована залежність:

```text
KnotAsset
   │
   ▼
core / validation
   │
   ▼
representation resolver
   │
   ▼
geometry builder
   │
   ▼
renderer
   │
   ├── viewer
   ├── preview
   └── future editor
```

Viewer не є власником формату KnotAsset.

Renderer не повинен мутувати авторські дані.

Редактор у майбутньому працює з KnotAsset, а не з Three.js scene як джерелом істини.