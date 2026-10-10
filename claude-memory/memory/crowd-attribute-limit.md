---
name: crowd-attribute-limit
description: 3D slug gill meshes vanish if SlugCrowd gains another vertex attribute — WebGL MAX_VERTEX_ATTRIBS=16 is already nearly full
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9d616a3c-f788-4825-97b8-9d5c1a02c812
  modified: 2026-09-18T06:28:10.900Z
---

`js/slug-crowd.js` instanced slug meshes are at the WebGL attribute ceiling (16). Gill meshes carry one more attribute than the body (`gillRelief`) plus `instanceMatrix` (4), `crowdPose`, `crowdMetal`, `aGeneTraits` and the four gene colours.

Adding one more `InstancedBufferAttribute` (this happened 2026-09-18 with a per-instance `crowdGlass` for the shop glass tint) makes the **gill program fail to link, so every slug in the game renders with no gills** while the body still draws. There is no obvious console error — the body just looks bald.

**How to apply:** pass new per-frame shader data as a **uniform** (all slugs in one frame share the same scene), never as another attribute. The shop glass tint now uses `uniform vec4 crowdGlass` mixed after `#include <colorspace_fragment>` at amount 0.32 (matching the 2D glass layer). Related: [[shop-glass-tint]]
