# Підготовлена об'єктна модель

Серіалізований документ має тип `RawAsset` (`schema: "Asset"`), а основна модель під час виконання — `Asset`. Підготовлені сутності: `Representation`, `Procedure`, `Step`, `Subject`. Для серіалізованих варіантів використовується префікс `Raw`. JSON Schema описує тільки сирі дані.

```ts
import { Asset, configureLocalization, STANDARD_RESOURCES } from '@yuriyapostol/knot-engine/core'
configureLocalization({ locale: 'uk', fallbackLocale: 'en' })
const asset = Asset.from(raw, { registries: [STANDARD_RESOURCES] })
const rep = asset.getRepresentation('view-3d')
console.log(rep?.getName(), rep?.getTypeDefinition()?.getName())
const saved = asset.toRaw()
const independent = asset.clone()
```

Підготовлені сутності використовують спільний ресурсний контекст. Повторне звернення за ID повертає той самий об'єкт у межах документа. Стандартні назви ресурсів доступні для відображення без неявного додавання ресурсів до залежностей валідації. Відсутні зовнішні ресурси не перешкоджають підготовці структурно правильного, але семантично неповного документа.

`LocalizedTexts.get(locale?)` вибирає мовний варіант із урахуванням глобальної локалі та резервної мови. Бібліотека не змінює `Array.prototype`. `configureLocalization` налаштовує локаль, резервну мову та перевизначення назв ресурсів. Тексти інтерфейсу переглядачів залишаються окремими.

Структурні зміни виконуються методами `addRepresentation` та `removeRepresentation`; масив представлень заморожено. `toRaw()` повертає JSON-сумісні дані, а `clone()` створює незалежну підготовлену модель. Не використовуйте `structuredClone()` для підготовлених об'єктів. Наявні функції для сирих даних збережено; де передбачено, вони також приймають підготовлені документи.

Це несумісна зміна контракту v1: дискримінатор JSON — `Asset`, URI схеми закінчується на `asset.schema.json`, а публічні назви функцій — `validateAsset`, `selectAsset`, `composeAsset`, `resolveAsset`.
