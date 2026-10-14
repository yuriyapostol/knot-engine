# Public core functions

Import from `knot-engine/core` to use data operations without Vue, Three.js or browser globals. The root entry also exports them. This is the implemented API, not the proposed namespace/resource resolver.

| Function | Input | Result |
| --- | --- | --- |
| validateKnotAsset | unknown, optional `{strict?: boolean}` | `{valid: true, asset, warnings}` or `{valid: false, issues}` |
| validateGridDiagram | unknown, optional `{strict?: boolean}` | `{valid: true, diagram, warnings}` or `{valid: false, issues}` |
| resolveKnotAsset | unknown, optional `{representationId?, snapshotId?}` | RenderableModel; throws ViewerError on invalid or unsupported selection |
| selectKnotAsset | unknown, `{representations?: string[], diagrams?: string[]}` | Validated, cloned reduced asset with dependencies |
| composeKnotAsset | readonly unknown[] | Validated merged asset; rejects empty input and identity, unit or record conflicts |

Strict validation rejects unknown fields. Issues have path, code and message. Validation does not prove knot equivalence. See the [asset contract](knot-asset.md) and [schema](schema/knot-asset.schema.json).

The resolver chooses a 3D representation and snapshot, defaulting to the first available choices. Unsupported 2D rendering, missing selections and empty geometry are errors. It returns copied curves and optional camera/warnings, not a Three.js scene. Selection and composition operate in memory without fetching references.

Legacy validateKnotModelV1 and resolveKnotModelV1 remain exported until the planned full migration; see their [input contract](model-format.md). TypeScript types, limits and ViewerError are also public exports. This API does not imply an HTTP server.
