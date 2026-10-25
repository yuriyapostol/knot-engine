# Підготовлена об'єктна модель

Серіалізований документ має тип `RawKnot` (`schema: "Knot"`), а основна модель під час виконання — `Knot`. Підготовлені сутності: `Representation`, `Procedure`, `Step`, `Subject`. Для серіалізованих варіантів використовується префікс `Raw`. JSON Schema описує тільки сирі дані.

```ts
import { Knot, configureLocalization, STANDARD_RESOURCES } from 'knot-engine/core'
configureLocalization({ locale: 'uk', fallbackLocale: 'en' })
const knot = Knot.from(raw, { registries: [STANDARD_RESOURCES] })
const rep = knot.getRepresentation('view-3d')
console.log(rep?.getName(), rep?.getTypeDefinition()?.getName())
const saved = knot.toRaw()
const independent = knot.clone()
```

Підготовлені сутності використовують спільний ресурсний контекст. Повторне звернення за ID повертає той самий об'єкт у межах документа. Стандартні назви ресурсів доступні для відображення без неявного додавання ресурсів до залежностей валідації. Відсутні зовнішні ресурси не перешкоджають підготовці структурно правильного, але семантично неповного документа.

`LocalizedTexts.get(locale?)` вибирає мовний варіант із урахуванням глобальної локалі та резервної мови. Бібліотека не змінює `Array.prototype`. `configureLocalization` налаштовує локаль, резервну мову та перевизначення назв ресурсів. Тексти інтерфейсу переглядачів залишаються окремими.

Структурні зміни виконуються методами `addRepresentation` та `removeRepresentation`; масив представлень заморожено. `toRaw()` повертає JSON-сумісні дані, а `clone()` створює незалежну підготовлену модель. Не використовуйте `structuredClone()` для підготовлених об'єктів. Наявні функції для сирих даних збережено; де передбачено, вони також приймають підготовлені документи.

Це несумісна зміна контракту v1: дискримінатор JSON — `Knot`, URI схеми закінчується на `knot.schema.json`, а публічні назви функцій — `validateKnot`, `selectKnot`, `composeKnot`, `resolveKnot`.
