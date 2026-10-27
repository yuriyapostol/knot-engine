# Prepared object model

`RawKnot` is the serialized document (`schema: "Knot"`); `Knot` is its mutable runtime form. `Subject`, `Representation`, `Procedure` and `Step` add lookup and localization methods to raw entities. JSON schemas describe serialized data.

```ts
import { Knot, configureLocalization, STANDARD_RESOURCES } from 'knot-engine/core'
configureLocalization({ locale: 'en', fallbackLocale: 'en' })
const knot = Knot.from(raw, { registries: [STANDARD_RESOURCES] })
const rep = knot.getRepresentation('view-3d')
console.log(rep?.getName(), rep?.getTypeDefinition()?.getName())
const report = knot.validate()
const saved = knot.toRaw()
const independent = knot.clone()
```

## Preparation and validation

`Knot.from(raw, options?)` clones raw input and prepares entity methods and resource context. Preparation does not establish validity or completeness; use `Knot.validate(raw, options?)` or `knot.validate(options?)` for a report. Missing resources do not prevent preparation when the input shape can be prepared. Passing an existing `Knot` to `Knot.from()` returns that same instance; use `clone()` for an independent copy.

`toRaw()` produces independent JSON-compatible data; `clone()` prepares an independent graph with the attached registries and per-knot localization settings. Do not use `structuredClone()` on prepared objects. `knot.select({representations?, procedures?})` extracts a self-contained prepared fragment. `Knot.compose(parts, options?)` combines fragments of the same document and rejects conflicts. Both validate their resulting data.

## Editing

Properties and collection arrays are mutable. Helper methods prepare added entities, reject duplicate IDs and provide convenient lookup/removal; they do not form transactions or enforce all dependencies. Removal is allowed even when references remain. Call `knot.validate()` after edits when document validity is required. For Vue viewers, replace the input object to trigger updates.

| Entity | Methods |
| --- | --- |
| Representations | `getRepresentation(id)`, `addRepresentation(raw)`, `removeRepresentation(id)` |
| Procedures | `getProcedure(id)`, `addProcedure(raw)`, `removeProcedure(id)` |
| Procedure steps | `procedure.getStep(id)`, `addStep(raw)`, `removeStep(id)` |
| Constructions | `getConstruction(id)`, `addConstruction(raw)`, `removeConstruction(id)` |
| Construction states | `addConstructionState(constructionId, raw)`, `removeConstructionState(constructionId, stateId)` |
| Construction objects | `addConstructionObject(constructionId, raw)`, `removeConstructionObject(constructionId, objectId)` |
| Inline definitions | `addResourceDefinition(kind, raw)`, `removeResourceDefinition(kind, id)` |

Definition-editing `kind` is `catalogs`, `representationTypes` or `objectTypes`. External registries are not changed. Lookup helpers return existing entity instances; removal returns `false` when the requested item is absent. Methods that add data copy raw input. Use helpers to ensure added entities receive their runtime methods and context.

## Resource context

`getResource(id, kind?)` returns a stable per-knot wrapper. Resource identity includes both kind and expanded URI; pass the kind for unambiguous lookup. Registry definitions are shared without copying or prototype changes. Inline-definition helpers update the resource lookup context; removing one restores the applicable registry definition when available.

Standard resource labels are available for presentation without implicitly satisfying validation dependencies. Validation uses explicitly attached registries; supplying `STANDARD_RESOURCES` remains an application decision.

## Localization

`LocalizedTexts` is an array of `{language,value}` records with `getExact(locale?)` and `get(locale?)`. Exact lookup tries the full language tag and its base; `get()` additionally tries the configured fallback and English. The library does not modify `Array.prototype`. Write English first in authored multilingual arrays; array order does not determine lookup or validity.

`configureLocalization({locale, fallbackLocale, overrides})` sets global defaults. `Knot.from(raw, {locale, fallbackLocale, overrides})` sets per-knot options that survive `clone()` and `select()`. Local overrides take precedence over global overrides; settings are evaluated when localized methods run. Changing the global locale does not require preparation again.

Subject, representation, procedure and step methods use the owning knot's context. Name/description overrides are keyed by entity or resource ID. Steps expose `getInstructions()` with localized fallback, without instruction overrides. Viewer UI strings are configured separately.

Vue applications can import `useLocalizedText(() => representation.getName())` from the root entry. It subscribes to global configuration changes and unsubscribes when its Vue scope ends. Headless consumers can use `subscribeLocalization(listener)`, which returns an unsubscribe function.
