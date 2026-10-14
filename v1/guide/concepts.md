# Data, contracts and resources

A specification defines the meaning of data and implementation behavior. A JSON Schema checks the structural part of that contract. An example demonstrates it; a resource is an actual reusable record conforming to a contract.

## What is implemented

The [KnotAsset specification](../spec/knot-asset.md), its [schema](../spec/schema/knot-asset.schema.json), and the [component contract](../spec/components.md) describe the current package. The [legacy model contract](../spec/model-format.md) documents the currently supported older input.

## What is proposed

The [KnotAsset redesign](../../design/knot-asset-draft.md) proposes unified representations and standalone shared resources. The [resource design](../../design/shared-resources.md) describes catalogs, representation types, views, constructions and namespace rules. These drafts are not accepted by the current validator merely because the documents exist.

A catalog defines a system of identifiers, such as a catalog name and its record notation. A registry of representation types contains concrete type definitions. A view stores camera settings. These are different kinds of resources, so `resources/catalogs/` is not an umbrella name for them all.

## Programmatic contracts

The package API consists of imports, functions, component props, events, methods and types. It does not imply an HTTP server. Data contracts describe what a knot record means; component contracts describe how an application displays it. Both are specifications, organized by their subject.

## Language and identity

English and Ukrainian pages describe the same contracts and share machine-readable schemas and example data. Switching the documentation language does not rename fields or resource identifiers. A JSON record may itself contain names in several languages.
