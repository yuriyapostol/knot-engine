# Knot: open design questions

This document covers extensions beyond the [implemented data contract](../v1/specifications/knot.md). It proposes no additional accepted fields. Current [architecture](architecture.md), [resource rules](shared-resources.md) and [viewer contracts](../v1/specifications/viewer-contracts.md) describe implemented behavior; version and release policy lives in [publication](publication.md).

## Domain boundaries

A practical knot, mathematical object and physical specimen need explicit correspondence rules. Geometric closure alone does not establish a mathematical knot identity. A construction describes concrete objects; a state describes a meaningful condition; a representation depicts a subject, construction, state or object; a procedure orders actions. Camera orientation is a presentation setting.

A property asserts something about an entity; a relation connects entities; a classification assigns a vocabulary term. These concepts must remain distinct from identifier catalogs, source attribution and structural representation types. Matching names, catalog labels or local IDs do not prove equivalence.

## Assertions and extraction

Properties, relations and classifications still need typed contracts. The working direction uses shared assertion collections with explicit scoped targets. A property needs a defined value type; a relation needs participant kinds and direction; a classification needs an identified vocabulary. Exact values, estimates, bounds, unknowns and physical measurements must remain distinguishable. Methods, conditions and sources belong with assertions when they affect meaning.

References to construction objects/states and procedure steps must carry their scopes. Extraction must define what happens when an assertion refers outside the selected fragment: include the dependency, declare it external or omit the assertion under an explicit policy. It must avoid pulling in an entire graph unintentionally or leaving dangling internal references. Property matches can be queried without materializing every pair as a relation.

## Physical context and sequences

Material, environmental conditions, object roles, constraints and end accessibility need contracts distinguishing enduring object properties from state and procedure conditions. An inaccessible rope end retains its identity. Material position along a rope differs from a curve parameter; resampling needs an explicit correspondence before promising a stable material coordinate.

Procedures already support reusable states and multiple illustrations through representation references. Sequence representations, interpolation, timing and navigation remain separate work. They must not require equal point counts or one illustration per step for ordinary procedures. Representation selection, tying-state selection and camera selection remain independent.

## Additional representations and import

Image containers, editable planar diagrams, braid words and conversions need their own conventions, dependency rules and validation. [Source-format research](representation-formats.md) records available data and candidate adaptations. Existing spatial, grid, mosaic, PD and knot/link DT contracts are defined in the specifications.

Imports must preserve coordinates, closure, components, crossings, orientation, parameterization and provenance. Generated layouts must be distinguishable from source images. Mathematical equivalence, chirality and minimum-size claims require separate evidence.

## Identity and revision

Current composition combines fragments of the same document. Merging independently authored documents requires rules for revisions, provenance, subject correspondence and conflicting assertions. Global identities must remain distinct from file locations and release numbers. Real catalog integrations need verified designation semantics, including orientation, mirror forms and editions.

## Scenarios for the next contracts

- A practical knot with two tying procedures and shared illustrations.
- A construction whose rope-end accessibility changes between states.
- A decorative composition with several materials and object roles.
- A mathematical subject with grid/PD representations and sourced properties.
- Export of one procedure or representation with its required assertions and dependencies.

These scenarios should determine the smallest useful contracts and their tests before new fields are added.
