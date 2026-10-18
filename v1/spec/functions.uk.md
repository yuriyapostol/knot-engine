# Функції

API ядра імпортується з `knot-engine/core`; ця точка входу не використовує Vue, Three.js або DOM. Бібліотека не змінює вхідні дані. URI-посилання не запускають мережевих запитів.

| Функція | Результат |
| --- | --- |
| `validateKnotAsset(value, options?)` | `{valid:true,asset,warnings,complete,missingDependencies,uncheckedTypes}` або `{valid:false,issues}` |
| `validateGridDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,crossingCount}` або помилки; незалежна перевірка сіткових діаграм із кодуванням `xo` або `vertex-pairs` |
| `validateDTCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` або помилки; однокомпонентний числовий DT із перевіркою планарної реалізовності |
| `validatePDCode(value)` | `{valid:true,data,code,warnings,componentCount,crossingCount}` або помилки; незалежна перевірка коду планарної діаграми |
| `validateSpatialCurve(value)` | `{valid:true,data,warnings}` або помилки |
| `validateMosaicDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,occupiedTileCount,crossingCount}` або помилки; незалежна перевірка мозаїчної діаграми |
| `validateView(value)` | `{valid:true,data,warnings}` або помилки |
| `validateResourceDocument(value)` | Перевірена оболонка ресурсу або помилки; не встановлює замкненості залежностей |
| `validateResourceRegistry(value)` | Перевірений реєстр із перевіркою конфліктів або помилки; не встановлює замкненості залежностей |
| `validateRepresentationDocument(value, options?)` | Звіт перевірки самостійного представлення |
| `resolveKnotAsset(value, {representationId?,view?}?, options?)` | Внутрішній `RenderableModel`; кидає `ViewerError` для некоректних, нерозв’язаних або непідтримуваних даних |
| `resolveRepresentation(representation, options?)` | Перетворення самостійного просторового представлення предмета опису на дані візуалізації; потрібний явний ресурсний контекст |
| `selectKnotAsset(value, {representations?,procedures?}, options?)` | Клонований самодостатній фрагмент із залежностями |
| `composeKnotAsset(values, options?)` | Клоноване об’єднання фрагментів одного документа; конфлікти є помилками |
| `expandURI(value, namespaces?)` | Точно розгорнутий URI; неоголошений префікс спричиняє помилку |

Параметри перевірки приймають `registries` (масив `KnotResourceRegistry`) і `schemas` (явні об’єкти JSON Schema). Відомі об’єкти завжди закриті; збережений параметр `strict` не послаблює перевірку. `STANDARD_RESOURCES` надає визначення вбудованих типів представлень і предметів при явному передаванні. Експортуються типи, `ViewerError`, `KNOT_ASSET_LIMITS`, константи простору імен і URI типів.

Засіб візуалізації поки підтримує лише просторові криві. Для показу й виділення недостатньо `valid:true`: потрібне також `complete:true`. Дані невідомих типів можна зберігати з неповним звітом перевірки. Жодна операція не доводить математичної тотожності вузла.

Див. [семантику даних](knot-asset.uk.md) і [API компонента](components.uk.md).

Джерела, плоскі внески й ліцензії — необов’язкові метадані. Валідація перевіряє їхню структуру, контакти та календарні дати, але не авторство чи сумісність ліцензій. Виділення переносить потрібні джерела, кореневий внесок і ліцензію; композиція перевіряє конфлікти ліцензій. Див. [спільний контракт](sources.uk.md).
