# Getting started

The package provides `KnotViewer`, public data types, validators and resolvers. The website's interactive editor is a host application using those exports, not another renderer.

## Run the project

```sh
npm ci
npm run dev
```

Open the address printed by the command, normally `http://localhost:5173/`. The complete bilingual site is rebuilt and reloaded when source materials, components or examples change. To inspect a production build, use `npm run preview:site` at `http://localhost:5174/`.

## Use a component

After installing the package from a local tarball or a published version, import the component and its stylesheet:

```vue
<script setup lang="ts">
import { KnotViewer } from 'knot-engine'
import 'knot-engine/styles.css'
import asset from './open-rope.json'
</script>

<template>
  <KnotViewer :asset="asset" locale="en" label="Rope" />
</template>
```

Use the [open-rope asset](../examples/assets/open-rope.json) as `open-rope.json`. Read the [component contract](../specifications/components.md) for selection parameters, events and capture methods. The package uses only the current `Asset` contract. Select a static representation with `representation-id`.

## Edit the data

<!-- interactive-example -->

The same fixture files are used by the documentation and interactive example. Changes here remain in the browser unless you save the JSON file. No source file is overwritten.
