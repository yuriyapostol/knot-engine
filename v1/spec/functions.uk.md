# Функції

Core API імпортується з `knot-engine/core`; ця точка входу не використовує Vue, Three.js або DOM. Бібліотека не змінює вхідні дані. URI-посилання не запускають мережевих запитів.

| Функція | Результат |
| --- | --- |
| `validateKnotAsset(value, options?)` | `{valid:true,asset,warnings,complete,missingDependencies,uncheckedTypes}` або `{valid:false,issues}` |
| `validateGridDiagram(value)` | `{valid:true,data,diagram,warnings,componentCount,crossingCount}` або помилки; незалежна перевірка Grid X/O або vertex-pairs |
| `validateSpatialCurve(value)` | `{valid:true,data,warnings}` або помилки |
| `validateView(value)` | `{valid:true,data,warnings}` або помилки |
| `validateResourceDocument(value)` | Перевірена оболонка ресурсу або помилки; не встановлює замкненості залежностей |
| `validateResourceRegistry(value)` | Перевірений реєстр із перевіркою конфліктів або помилки; не встановлює замкненості залежностей |
| `validateRepresentationDocument(value, options?)` | Звіт перевірки самостійного представлення |
| `resolveKnotAsset(value, {representationId?,view?}?, options?)` | Внутрішній `RenderableModel`; кидає `ViewerError` для некоректних, нерозв’язаних або непідтримуваних даних |
| `resolveRepresentation(representation, options?)` | Самостійне просторове представлення subject у дані рендерингу; потрібний явний ресурсний контекст |
| `selectKnotAsset(value, {representations?,procedures?}, options?)` | Клонований самодостатній фрагмент із залежностями |
| `composeKnotAsset(values, options?)` | Клоноване об’єднання фрагментів одного документа; конфлікти є помилками |
| `expandURI(value, namespaces?)` | Точно розгорнутий URI; неоголошений префікс спричиняє помилку |

Параметри перевірки приймають `registries` (масив `KnotResourceRegistry`) і `schemas` (явні об’єкти JSON Schema). Відомі об’єкти завжди закриті; збережений параметр `strict` не послаблює перевірку. `STANDARD_RESOURCES` надає визначення вбудованих типів представлень і предметів при явному передаванні. Експортуються типи, `ViewerError`, `KNOT_ASSET_LIMITS`, константи простору імен і URI типів.

Renderer поки підтримує лише `spatial-curve`. Для показу й виділення недостатньо `valid:true`: потрібне також `complete:true`. Дані невідомих типів можна зберігати з неповним звітом перевірки. Жодна операція не доводить математичної тотожності вузла.

Див. [семантику даних](knot-asset.uk.md) і [API компонента](components.uk.md).
