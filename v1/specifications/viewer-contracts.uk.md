# Контракти вибору представлень і переглядачів

**Статус:** `selectRepresentation` реалізовано з цільовою перевіркою обраного представлення; повністю довільні часткові кореневі структури та базовий UI-композитор і реєстр реалізовано; решта UI-контрактів ще в розробці. Доповнює [архітектуру](../../design/modular-viewers.uk.md).

## Вхід і вибір

Усі компоненти отримують `asset: KnotAsset` (повний або допустимий частковий), `representationId?: string` та окремі `settings`. Наявність схеми, просторів імен, ресурсів, побудов, процедур і станів перевіряється за потребами вибраного представлення. `core` приймає той самий контейнер і не залежить від Vue.

Пропоновані операції `core`:

```ts
type RepresentationQuery = { representationId?: string; type?: string }
type SelectionResult =
  | { ok: true; asset: KnotAsset; representation: Representation; typeUri: string }
  | { ok: false; issues: SelectionIssue[] }
type SelectionIssue = {
  code: 'INVALID_ASSET' | 'REPRESENTATION_NOT_FOUND' | 'AMBIGUOUS_REPRESENTATION'
      | 'UNSUPPORTED_REPRESENTATION' | 'MISSING_DEPENDENCY' | 'INVALID_REPRESENTATION'
  message: string
  path?: string
}
function selectRepresentation(asset: KnotAsset, query?: RepresentationQuery, options?: SelectionOptions): SelectionResult
```

Функція повертає дані, не створює UI, не мутує аргументи та не завантажує ресурси. Тип у запиті порівнюється за розгорнутим URI. Явний ID має збігатися з потрібним типом; відсутність збігів і кілька збігів діагностуються окремо. Універсальний компонент без ID може вибрати представлення лише за однозначним правилом; прихований вибір першого за порядком заборонений. Для часткового активу перевіряється мінімально достатній замкнений набір залежностей. Кореневий контейнер повинен відповідати структурі `KnotAsset` v1; необов'язкові секції можуть бути відсутні. За замовчуванням перевіряються вибране представлення та потрібний йому контекст, а не всі представлення й процедури. `scope: 'all'` вимагає перевірки всього документа. Відсутні залежності вибраного представлення залишаються помилкою.

## Контракт UI

`KnotViewer` визначає компонент за `typeUri`; спеціалізовані переглядачі викликають `selectRepresentation` із фіксованим типом. Спільні стани: `empty | initializing | ready | error`; події: `ready`, `error`, `view-change`. Спільні методи: `resetView()`, `fitToView()`, `capture(options?)`. `camera-change` належить 3D. Події не змінюють `asset`.

```ts
type ViewerRegistration = {
  typeUri: string
  component: unknown // Vue component type in UI package
  capabilities: {
    orbit?: boolean; pan?: boolean; zoom?: boolean; edit?: boolean
    capture?: readonly ('png' | 'svg')[]
    sequences?: boolean
  }
}
type ViewerRegistry = ReadonlyMap<string, ViewerRegistration>
```

Реєстр передається явно або формується локально з вбудованих реєстрацій; не є глобальним змінним станом. Підтримка послідовностей декларується можливістю, але схему кроків і API навігації визначимо окремо.

## Налаштування й міграція

`settings` не є частиною `KnotAsset`; для 3D міститиме ракурс/камеру й параметри рендерингу, для мозаїки — панорамування, масштаб та оформлення. Змістовні кроки, стани та послідовності залишаються в активі. Перш ніж видаляти `views`, `defaultView`, `preferredView`, узгодити відображення старих полів на нові settings і типові значення. Тимчасова сумісність не є вимогою.

## Перевірки

Тести: повний і частковий актив; явний ID; відсутній та неоднозначний вибір; розгортання префіксів; невідомий тип; відсутні ресурси; незмінність входів; незалежність двох компонентів; підтримка процедур без змішування кроку й ракурсу.
