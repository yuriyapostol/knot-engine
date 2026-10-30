import { readFileSync, writeFileSync } from 'node:fs'
const contracts=JSON.parse(readFileSync('src/core/contracts.json','utf8'))
const entries={'source':'sourceDefinition','contribution':'contribution','license':'license','knot': 'knot','mosaic-diagram':'mosaic','dt-code':'dt','pd-code':'pd','grid-diagram':'grid','2d':'geometry2d','3d':'geometry3d','representation':'representation','construction':'construction','view':'view','catalog':'catalog','representation-type':'representationType','object-type':'objectType','rope-object':'rope','equipment-object':'equipment','resource':'resourceDocument','resource-registry':'registry','representation-document':'representationDocument'}
for(const [name,key] of Object.entries(entries)) {
  const defs={}
  function include(k) {
    if(Object.hasOwn(defs,k))return
    defs[k]=contracts.$defs[k]
    function visit(v){if(!v || typeof v!=='object')return; if(v.$ref?.startsWith('#/$defs/'))include(v.$ref.slice(8));for(const item of Object.values(v))visit(item)}
    visit(defs[k])
  }
  include(key)
  writeFileSync(`v1/schema/${name}.schema.json`,JSON.stringify({$schema:contracts.$schema,$id:`https://yuriyapostol.github.io/knot-engine/v1/schema/${name}.schema.json`,$ref:`#/$defs/${key}`,$defs:defs},null,2)+'\n')
}
