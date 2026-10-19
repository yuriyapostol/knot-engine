# Knot Engine

Render and inspect knots, rope constructions and their representations using the package's Vue components and validation functions.

This is the first contract generation, including package versions before 1.0. The current format and the proposed redesign are documented separately. Data and JavaScript APIs may change during initial development; the [public CSS contract](spec/components.md#css-compatibility-and-styling) remains compatible throughout v1, including 0.x and later 1.x.

- [Start using the package](guide/getting-started.md).
- [Understand the data and resources](guide/concepts.md).
- [Read the implemented `KnotAsset` contract](spec/knot-asset.md).
- [Explore proposed changes](../design/knot-asset-draft.md).

## Try it

Select a fixture, edit its JSON, and inspect the result. This example uses the package's `KnotViewer` and validators. Invalid edits keep the last valid view and display an error. The JSON editor does not execute JavaScript.

<!-- interactive-example -->
