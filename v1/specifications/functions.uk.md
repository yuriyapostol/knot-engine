# Функції

API ядра імпортується з `knot-engine/core`; ця точка входу не використовує Vue, Three.js або DOM. Валідація й вибір не змінюють вхід; підготовлені об’єкти `Knot` підтримують явні методи редагування. URI-посилання не запускають мережевих запитів.

| Функція | Результат |
| --- | --- |
| `Knot.validate(raw, options?)` / `knot.validate(options?)` | Звіт перевірки сирого або підготовленого документа |
| `validateGridDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,crossingCount}` або помилки; незалежна перевірка сіткових діаграм із кодуванням `xo` або `vertex-pairs` |
| `validateDTCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` або помилки; числовий DT вузлів і зачеплень із перевіркою планарної реалізовності |
| `validatePDCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` або помилки; незалежна перевірка коду планарної діаграми |
| `validateGeometry2D(value)` / `validateGeometry3D(value)` | `{valid:true,data,warnings}` або помилки |
| `validateMosaicDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,occupiedTileCount,crossingCount}` або помилки; незалежна перевірка мозаїчної діаграми |
| `validateView(value)` | `{valid:true,data,warnings}` або помилки |
| `validateResourceDocument(value)` | Перевірена оболонка ресурсу або помилки; не встановлює замкненості залежностей |
| `validateResourceRegistry(value)` | Перевірений реєстр із перевіркою конфліктів або помилки; не встановлює замкненості залежностей |
| `validateRepresentationDocument(value, options?)` | Звіт перевірки самостійного представлення |
| `Knot.from(raw, options?)` / `knot.select(selection)` / `Knot.compose(parts)` | Підготовка, вибір і об'єднання документів |
| `selectRepresentation(knot, query?, options?)` | Вибір і перевірка одного представлення; структурована діагностика |
| `resolveRepresentationView(requested, views?, registries?, namespaces?)` | Розв’язання ракурсу застосунку без завантаження |
| `expandURI(value, namespaces?)` | Точно розгорнутий URI; неоголошений префікс спричиняє помилку |

`Knot.validate()` і `knot.validate()` приймають `registries` (масив `RawResourceRegistry`). `ValidationOptions` для перевірки/вибору представлення додатково приймає `schemas` (явні об’єкти JSON Schema). Відомі об’єкти завжди закриті; `strict: false` не послаблює перевірку. `STANDARD_RESOURCES` надає визначення вбудованих типів представлень і предметів при явному передаванні. Експортуються типи, `ViewerError`, `KNOT_LIMITS`, константи простору імен і URI типів.

Вбудовані переглядачі відображають 2D-криві, 3D-криві й сітки та SVG-мозаїки. Відображення вимагає повної перевірки вибраного представлення та його залежностей; виділення — повного документа. Дані невідомих типів можна зберігати з неповним звітом перевірки. Жодна операція не доводить математичної тотожності вузла.

Див. [семантику даних](knot.uk.md) і [API компонента](components.uk.md).

Джерела, плоскі внески й ліцензії — необов’язкові метадані. Валідація перевіряє їхню структуру, контакти та календарні дати, але не авторство чи сумісність ліцензій. Виділення переносить потрібні джерела, кореневий внесок і ліцензію; композиція перевіряє конфлікти ліцензій. Див. [спільний контракт](sources.uk.md).
