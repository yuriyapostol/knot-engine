# Data, contracts and resources

A specification defines the meaning of data and implementation behavior. A JSON Schema checks the structural part of that contract. An example demonstrates it; a resource is an actual reusable record conforming to a contract.

## What is implemented

The [`Knot` specification](../specifications/knot.md), its [schema](../schema/knot.schema.json), and the [component contract](../specifications/components.md) describe the current package.

## Further design

The [open design questions](../../design/knot-draft.md) cover additional formats, assertions and sequence behavior. They introduce no accepted fields beyond the specifications.

A catalog defines a system of identifiers, such as a catalog name and its record notation. A registry of representation types contains concrete type definitions. An application-owned view stores camera settings separately from knot data. These are different kinds of resources, so `resources/catalogs/` is not an umbrella name for them all.

## Programmatic contracts

The package API consists of imports, functions, component props, events, methods and types. It does not imply an HTTP server. Data contracts describe what a knot record means; component contracts describe how an application displays it. Both are specifications, organized by their subject.

## Language and identity

English and Ukrainian pages describe the same contracts and share machine-readable schemas and example data. Switching the documentation language does not rename fields or resource identifiers. A JSON record may itself contain names in several languages.

## Sources and contributions

A catalog defines an identifier system; a source records data origin; a contribution records work done by a person or team. These roles are distinct. All metadata is optional; the license is global to the Knot. See the [contract](../specifications/sources.md).
