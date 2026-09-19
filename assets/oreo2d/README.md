# Oreo 2D component study

Draft generated components for the approved right-facing Jorunna funebris concept. Not connected to gameplay yet. Source images are neutral white with shading, without baked markings or eyes.

- `body-white-v1.png`: continuous body/head/foot; no appendages, eyes or markings.
- `rhinophore-white-v1.png`: one reusable stalk; create two independently transformed instances.
- `gill-white-v1.png`: one reusable branching frond; compose the posterior crown from separate instances. DRAFT ONLY: visible external halo remains after a generation cleanup attempt; do not integrate until a clean alpha cutout is obtained.
- Eyes: reuse the existing engine eye asset as an independent layer.
- Markings: proposed deterministic procedural broken-ring/patch overlay clipped to body alpha. Not yet implemented; do not bake it into the white body.

## Proposed gene mapping (not a change to existing species)

Current engine has 11 genes, despite the older nine-gene README.

| Gene | Existing behavior | Proposed Oreo behavior |
| --- | --- | --- |
| mainC | Palette 0–400; 200 is white | Same palette; recolor body and rhinophore bases, keep eyes and markings separate. Start at 200. |
| accC | Gill palette 0–400; 200 is white | Same palette for gill fronds. Keep rhinophore dark tips as a species mask unless explicitly choosing to couple them to this gene. |
| bodyDepth | Body shading gamma, 0–100 | Shade/relief contrast only; must not change number or opacity of rings. |
| gillDepth | Gill shading gamma, 0–100 | Frond relief contrast, preserving white highlights. |
| len | Horizontal body scale 0.72–1.28 | Same baseline; transform attachments and markings in body-local coordinates. |
| girth | Uniform whole-body size 0.72–1.28 | Preserve existing meaning, not a new width-only parameter. Scale assembled character consistently. |
| gillLen | Frond scale 0.62–1.38 | Scale each frond around its attached base, never the image center. |
| tentLen | Rhinophore scale 0.62–1.38 | Scale each stalk around its base; eyes remain attached to head. |
| vigor | Aura/shine and gameplay personality | Preserve gameplay effects; restrained cached visual highlights for Oreo. |
| gillN | Ladder [2,3,5,6,8,9], based on distance from 50 | Initially retain count semantics, with species-specific posterior layouts for every count. 50 means TWO fronds, not a full crown. Suggested reference preset 20 gives six. |
| spotN | 0–100 changes count AND circle/triangle/square | Proposal: Oreo-specific monotonic count 0–8, adding large rings before small ones; deterministic broken rings and patches, no geometric squares/triangles. Must update labels/count helpers for this species. |

Suggested white-body Oreo reference preset: mainC=200, accC=0 (dark gills), bodyDepth=45, gillDepth=45, len=50, girth=50, gillLen=50, tentLen=50, vigor=50, gillN=20, spotN=70. This is a proposal, not an applied default. All-white appendages use accC=200; raw source assets remain white regardless of phenotype.

## Assembly and implementation requirements

Measure alpha bounds before defining normalized base pivots and body attachment coordinates; do not treat image canvas dimensions as visible-part dimensions. Draw far appendages first, then body with clipped markings, then visible near appendages and eyes. Validate rear crown overlap against the approved reference.

Use species identity in all derived-data and sprite cache keys. Existing `slugPartsOf` does not distinguish species. Route species-specific count helpers and layouts without modifying the old species. Cache static recoloring and markings per visual gene signature, avoid per-frame texture generation, and release obsolete cache entries. Verify every gill-count step, scale extremes, facing flips, and all four tank rotations before integration. White draft PNGs still require alpha-edge and small-scale assembly QA.

The previously reported missing gills in all tanks is a separate unresolved renderer issue; generating these components does not fix it.
