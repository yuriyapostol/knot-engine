# Prepared object model

The serialized document is `RawKnot` (`schema: "Knot"`); the primary runtime object is `Knot`. Other runtime entities include `Representation`, `Procedure`, `Step`, and `Subject`. The serialized variants use the `Raw` prefix. JSON schemas describe only raw data.

```ts
import { Knot, configureLocalization, STANDARD_RESOURCES } from 'knot-engine/core'
configureLocalization({ locale: 'uk', fallbackLocale: 'en' })
const knot = Knot.from(raw, { registries: [STANDARD_RESOURCES] })
const rep = knot.getRepresentation('view-3d')
console.log(rep?.getName(), rep?.getTypeDefinition()?.getName())
const saved = knot.toRaw()
const independent = knot.clone()
```

Prepared entities share a resource context; repeated lookup by ID returns the same object within one knot. Standard resource labels are available for presentation without silently changing validation dependencies. Missing external resources do not prevent preparation of a structurally valid but semantically incomplete document.

`LocalizedTexts.get(locale?)` selects a localized value using the current global locale and fallback. The library does not change `Array.prototype`. Use `configureLocalization` for global locale, fallback and resource-label overrides. Viewer UI strings are separate.

Structural edits use methods such as `addRepresentation` and `removeRepresentation`; representation arrays are frozen. `toRaw()` returns JSON-compatible data; `clone()` creates an independent prepared graph. Do not use `structuredClone()` on prepared objects. Existing raw-data functions remain available and accept prepared knots where supported.

This is a breaking v1 contract change: JSON uses `schema: "Knot"` and `knot.schema.json`. Public document operations are methods of `Knot`, not standalone functions.

Per-knot localization is configured with `Knot.from(raw, { locale, fallbackLocale, overrides })`. These settings apply only to that instance and survive `clone()` and `select()`. Local overrides take precedence over global overrides. Language is resolved when calling `getName()` or `getDescription()`, so a global locale change does not require re-preparing the document.

Controlled editing covers representations (`knot.addRepresentation()`, `knot.removeRepresentation()`), procedures (`knot.addProcedure()`, `knot.removeProcedure()`) and steps (`procedure.addStep()`, `procedure.removeStep()`). `getRepresentation()`, `getProcedure()` and `getStep()` return stable instances until the item is removed. Their collection arrays are frozen so structural changes go through the methods.

Inline catalogs and type definitions support `knot.addResourceDefinition(kind, definition)` and `knot.removeResourceDefinition(kind, id)`, where `kind` is `catalogs`, `representationTypes`, or `objectTypes`. External registries are never mutated. Removing a representation type that is still referenced by a representation is blocked. Removing an inline override restores the attached registry definition, if any.

In reactive Vue interfaces, use `useLocalizedText(() => representation.getName())` from the package root. The composable observes `configureLocalization()` changes and unsubscribes when its Vue scope ends. Outside Vue, `subscribeLocalization(listener)` returns an unsubscribe function. Per-`Knot` localization settings still take precedence over global settings.

Attached resource definitions are shared without deep copies. `getResource()` provides a stable per-knot view with localized methods; external registry objects remain unchanged.

Constructions support controlled `knot.getConstruction(id)`, `knot.addConstruction(definition)`, and `knot.removeConstruction(id)` operations. Removing a construction is blocked while it is targeted by a representation (including state and object targets) or referenced by a procedure. The construction collection array is protected from direct structural mutation.

### Editing construction states and objects

`knot.removeConstructionState(constructionId, stateId)` and `knot.removeConstructionObject(constructionId, objectId)` return `false` when the target element does not exist. State removal is blocked when a representation targets that state. Object removal is blocked when a representation targets that object or references it in `data.curves[].object` of a spatial-curve representation within the same construction. When referenced, the operation throws without changing the construction.

These editing guards enforce reference integrity but do not replace `knot.validate()`, which also checks representation data, schemas, and other document constraints.

Localization of `Subject`, `Procedure`, and `Step` also follows their owning `Knot`'s `locale` and `fallbackLocale`, rather than relying solely on global settings. This includes steps created with `Procedure.addStep()`. Raw text values remain unchanged.

For `Subject`, `Procedure`, and `Step`, `overrides` also apply to `names` and `descriptions` by entity ID without changing raw JSON. Step `instructions` use localized values and fallback language; instruction overrides are not part of this contract.

### Adding construction states and objects

`knot.addConstructionState(constructionId, state)` and `knot.addConstructionObject(constructionId, object)` edit an existing **local** construction without replacing its prepared instance. They clone their inputs, return the added value, and reject duplicate IDs within the corresponding collection or unknown construction IDs. These methods do not validate arbitrary input data; use `knot.validate()` to check the resulting document. Existing removal guards remain in effect.

Local construction references use `{ id: constructionId }`; external registry references use `{ ref: uri }`. Controlled removal checks only local `id` references. An external `ref` does not prevent removal of an inline construction, even if the strings coincide. Registry reference validity is checked separately by `validate()`.

Likewise, `removeRepresentation(id)` is blocked only by step references of the form `{ id }`. A `{ ref }` addresses an external representation and does not create a dependency on a local representation with the same identifier.

When removing an inline resource definition, fallback lookup is restricted to the **same resource kind**. A catalog, object type, or representation type with an identical URI does not substitute for a definition of another kind or bypass dependency guards.

Resource identity combines resource kind and URI. Use `knot.getResource(id, kind)` when the kind is known; `representation.getTypeDefinition()` always selects a representation-type definition even if a different resource kind shares the URI. The one-argument `getResource(id)` is retained for convenient lookups where the URI is unambiguous.
