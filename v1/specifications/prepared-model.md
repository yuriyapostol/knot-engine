# Prepared object model

The serialized document is `RawAsset` (`schema: "Asset"`); the primary runtime object is `Asset`. Other runtime entities include `Representation`, `Procedure`, `Step`, and `Subject`. The serialized variants use the `Raw` prefix. JSON schemas describe only raw data.

```ts
import { Asset, configureLocalization, STANDARD_RESOURCES } from '@yuriyapostol/knot-engine/core'
configureLocalization({ locale: 'uk', fallbackLocale: 'en' })
const asset = Asset.from(raw, { registries: [STANDARD_RESOURCES] })
const rep = asset.getRepresentation('view-3d')
console.log(rep?.getName(), rep?.getTypeDefinition()?.getName())
const saved = asset.toRaw()
const independent = asset.clone()
```

Prepared entities share a resource context; repeated lookup by ID returns the same object within one asset. Standard resource labels are available for presentation without silently changing validation dependencies. Missing external resources do not prevent preparation of a structurally valid but semantically incomplete document.

`LocalizedTexts.get(locale?)` selects a localized value using the current global locale and fallback. The library does not change `Array.prototype`. Use `configureLocalization` for global locale, fallback and resource-label overrides. Viewer UI strings are separate.

Structural edits use methods such as `addRepresentation` and `removeRepresentation`; representation arrays are frozen. `toRaw()` returns JSON-compatible data; `clone()` creates an independent prepared graph. Do not use `structuredClone()` on prepared objects. Existing raw-data functions remain available and accept prepared assets where supported.

This is a breaking v1 contract change: the JSON discriminator is `Asset`, the schema URI ends in `asset.schema.json`, and the public names are `validateAsset`, `selectAsset`, `composeAsset`, and `resolveAsset`.
