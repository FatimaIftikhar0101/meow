# Mascot clip sources

The animated WebP files in `assets/kitten/` are generated, not authored. They are built
from ProRes 4444 masters that live **outside this repo**:

    H:\Maam fatima\SAM\<state>\combined_transparent.mov

One folder per state: `waiting`, `playing`, `traveling_on_cardboard_plane`,
`happy_delivered`, `sorry_failed`.

The masters are ~50MB each and are deliberately not committed. If they move, update this
file — it is the only record of where they are.

## Regenerating

```
node scripts/key-clip.js "<path>/combined_transparent.mov" assets/kitten/<state>.webp
```

| asset | source folder |
|---|---|
| `waiting.webp` | `waiting` |
| `play.webp` | `playing` |
| `travel.webp` | `traveling_on_cardboard_plane` |
| `delivered.webp` | `happy_delivered` |
| `sorry.webp` | `sorry_failed` |

`idle` has no artwork of its own — it reuses `waiting.webp`, since both are the kitten
sitting still with its toy untouched, and a second near-identical loop would cost a
megabyte to say the same thing.

## Use the `.mov`, not the `.webm`

Each export folder also contains `combined_transparent.webm`, `combined_on_black.mp4` and
`matte.mp4`. **Only the `.mov` carries a real alpha channel** (`yuva444p12le`). Despite its
name the `.webm` is `vp9 / yuv420p` — that export flattened the transparency onto black, and
the file has no alpha plane at all.

This mattered once already. The first clip handed over was the `.webm`, so the matte had to
be reconstructed by keying out the black. `key-clip.js` still contains that path and falls
back to it automatically when a source has no alpha, but it is strictly the worse input: it
has to pick a threshold, work around dark parts of the subject being indistinguishable from
the background, and undo the premultiplication against black. With the `.mov` there is
nothing to infer — the matte is copied through exactly as authored.
