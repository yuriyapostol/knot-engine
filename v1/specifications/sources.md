# Sources, contributions and licensing

Implemented optional metadata shared by all representation types. These fields describe attribution and declared usage terms; they do not alter the knot data or establish authorship, mathematical truth or license compatibility.

## Placement

| Owner | Optional fields |
| --- | --- |
| Knot | `sources`, `contributions`, `license` |
| Representation | `sources`, `contributions` |
| RawRepresentationDocument | `sources` definitions for references used by its representation |

There is no `provenance` wrapper and no representation-level `license`. Metadata belongs to the representation envelope, not its type-specific `data`. Omitting all metadata preserves existing validity and completeness. A declared source reference still needs resolution for completeness.

## Sources

A source describes material used to obtain data. An inline source has at least `title` or `url` and these optional fields:

| Field | Meaning |
| --- | --- |
| `title` | Nonblank source name |
| `url` | Absolute HTTP(S) URL; never fetched by validation |
| `authors` | Nonempty array of flat records `{name,email?,url?}` describing the original authors |
| `version` | Edition, revision or commit identifier |
| `license` | Declared source license `{name,url?}` |
| `locator` | Page, table field, catalog record or file row |
| `accessed` | Valid calendar date `YYYY-MM-DD` |
| `note` | Source description or explanation of its use |

Sources need not be published: a title can describe an original drawing, private measurements or a printed book. An author's identity is not automatically a contribution to the current Knot.

Root `Knot.sources` contains reusable definitions with an additional required `id`, local or global under ordinary URI rules. Representation `sources` entries are either:

* A complete inline source without an `id`.
* A reference `{id:...}` to a root definition, or `{ref:...}` to an explicitly supplied global source resource. Reference entries may also include `locator`, `accessed` and `note` for this use. They cannot also redefine the source's title, URL, authors, version or license.

An inline definition and a reference are mutually exclusive. The source-level note remains part of the definition; a reference-level note describes this use and does not overwrite it. The same applies to default locator/access date versus use-specific values. Root definitions are a shared pool; they are not implicitly applied to every representation. Selection retains only definitions actually referenced by retained representations.

External definitions use the ordinary `kind:"source"` resource contract, registry, explicit dependencies and namespace expansion. A missing local `id` is invalid. A missing global `ref` is reported as a `source` missing dependency and makes validation incomplete; a wrong resource kind is invalid. Source, author and license URLs are ordinary URLs, never compact identifiers or hidden dependencies. A source resource document must use a global ID.

A standalone representation document may embed root-like `sources` definitions to resolve local references. No registry is consulted implicitly and no URL is fetched. See [the complete example](../examples/knots/sources-contributions.json).

## Contributions

`contributions` is an array of flat records; no nested person/agent object or contributor registry is required.

| Field | Meaning |
| --- | --- |
| `name` | Required nonblank name of a person, team or organization |
| `email`, `url` | Optional contact email and absolute HTTP(S) profile URL |
| `roles` | Optional nonempty list of distinct role codes |
| `date` | Optional valid calendar date `YYYY-MM-DD` |
| `note` | Optional explanation of the work |

Supported roles: `creation` (created data), `import` (copied from a source), `conversion` (changed format/conventions), `editing` (modified/corrected data), `validation` (checked data). A name and note alone are sufficient. Email is contact information, not an identity key. Contacts and roles are declarations, not verified credentials.

Root contributions concern work on the Knot as a whole. Representation contributions concern that representation only. Neither list is implicitly copied to the other level. Repeated work by one person can have separate entries; this is attribution, not an immutable revision log or a reversible edit history.

## License

`Knot.license` is `{name,url?}` with a required nonblank name and optional absolute HTTP(S) URL. It states the declared license of the assembled Knot. `source.license` describes the original material. Neither automatically overrides or supplies the other. Absence means no license stated, not unrestricted use. Compatibility and permission to relicense are not inferred or checked. A license may be identified by a name/code; there is no built-in license catalog or imposed vocabulary.

## Preservation and validation

Selection retains root contributions and license, representation metadata and required source definitions. Global source references are made self-contained by embedding their definitions in the selected Knot's `sources`, with global IDs retained. Unused definitions are omitted. Metadata is cloned; input objects, order and source URLs are not rewritten. Only source identity fields use normal namespace expansion.

Composition keeps ordinary identity/conflict rules for source definitions and representations. Root contribution lists are merged in input order, deduplicating only exactly equal records (object key order ignored). Name/email equality does not merge different contributions. Differing representation metadata under the same representation ID is a conflict. If only one fragment has a license, retain it; two differing license objects are a conflict. There is no automatic legal equivalence check or relicense operation.

Schemas are closed and reject unsupported fields, mixed inline/reference entries, blank required text and unknown/duplicate contribution roles. Structural date patterns are supplemented by runtime calendar checks. HTTP(S) URLs are checked syntactically, without network access; email uses a basic nonwhitespace local-part/domain pattern, not delivery verification.

Implementation limits: up to 256 source definitions per root, 256 source uses per representation, 128 authors per source and 1,024 contributions per owner; at most five distinct roles per contribution. Empty optional collections are allowed, except a present `authors` or `roles` list must not be empty. General bounded-JSON budgets still apply. Independent schemas are published for [source definitions](../schema/source.schema.json), [contributions](../schema/contribution.schema.json) and [licenses](../schema/license.schema.json); their metadata definitions are also included in the appropriate envelope schemas.

## Contract rationale and examples

Source collections and representation-level references preserve shared provenance without an additional wrapper. Flat contributions cover creation and editing without an identity graph. A global license matches the publication unit; source licenses remain separate attribution to external material.

These are project decisions, not claims that external knot databases expose the same metadata shape. Numeric conventions and dataset examples remain documented in the corresponding representation specifications. Documentation should explain consequential contract choices, cite relevant definitions/implementations, distinguish adopted conventions from local decisions and include checked examples. Absence of an external source must not be disguised as external standardization.

```json
{
  "sources": [{"title":"Own measurements","note":"Recorded from the physical sample."}],
  "contributions": [{"name":"Example editor","roles":["editing","validation"],"note":"Corrected and checked coordinates."}]
}
```

The fragment above is representation metadata, not a complete representation. Acceptance cases cover every supported data type, inline/local/global sources, missing references, calendar dates and contacts, both contribution levels, source extraction, composition conflicts and optional metadata absence.
