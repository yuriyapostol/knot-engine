# Knot Engine

Render and inspect knots, rope constructions and their representations using the package's Vue components and validation functions.

This is the first contract generation, including package versions before 1.0. Specifications describe the implemented format and API; design notes cover architecture, research and open extensions. Initial development does not guarantee backward compatibility.

- [Start using the package](guide/getting-started.md).
- [Understand the data and resources](guide/concepts.md).
- [Read the implemented `Knot` contract](specifications/knot.md).
- [Explore open design questions](../design/knot-draft.md).

## Documentation map

- **Learn:** [getting started](guide/getting-started.md), [PLink import](guide/import-plink.md).
- **Reference:** [Knot data](specifications/knot.md), [image representation](specifications/image.md), [functions](specifications/functions.md), [viewers](specifications/components.md).
- **Background and decisions:** [architecture](../design/architecture.md), [source-format research](../design/representation-formats.md).

## Try it

Select a fixture, edit its JSON, and inspect the result. This example uses the package's `KnotViewer` and validators. Invalid edits keep the last valid view and display an error. The JSON editor does not execute JavaScript.

<!-- interactive-example -->
