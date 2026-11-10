# Image representation

Use the built-in `image` representation for a raster or vector file, without treating pixels as knot topology:

```json
{"mimeType":"image/svg+xml","src":"./images/trefoil.svg"}
```

`src` accepts HTTPS, relative paths or `data:` URLs with matching MIME types. The browser loads the resource; cross-origin restrictions can prevent PNG capture. `KnotImageViewer` is the image renderer; `KnotViewer` delegates to it.

The data schema is [image.schema.json](../schema/image.schema.json). See [viewer components](components.md) for controls and capture.
