# Meow — kitten mascot video production brief

Assets for the transfer-tracking journey path. Generate with a video model, extract the
kitten with SAM2, composite into the app as alpha video or sprite sheets.

**Do the pilot in section 7 before generating anything else.**

---

## 1. The character

**A short-haired apricot-ginger tabby kitten with a cream chest and paws, and green eyes.**

Colour is a brand decision, not a taste one. The UI is cool and restrained — white canvas,
Slate Blue Grey `#6B7B84` as the base, Charcoal `#3C3C3C` — with warm accents in Dark Pine
`#2D4530` and Earth Brown `#5E4B3B`, and the gold mark at `#E0B259`.

Ginger is the right coat because:

- **It is the only warm thing on screen.** Warm against a cool field is the strongest focal
  relationship available, and it costs no extra design work — the kitten becomes the eye's
  first stop automatically.
- **It sits in the same hue family as the gold mark.** Mascot and logo read as one brand even
  though one is a photograph and the other is vector.
- **It survives both backgrounds.** The path sits on white, the map sits on a dark slate slab.
  Ginger holds contrast on both. Very little else does.
- **Video models have seen a million ginger shorthairs**, so generation is more reliable.

Keep it a soft apricot/marmalade rather than a saturated red-orange, so it does not fight a
deliberately quiet palette.

**Green eyes**, because green ginger cats are real and common, and it quietly ties the Dark
Pine accent into the character. Coat covers gold and earth brown, eyes cover pine — three of
the five brand colours living in one kitten.

**What I ruled out and why:**

| Coat | Why not |
|---|---|
| Grey / blue British Shorthair | Camouflages into a Slate Blue Grey UI, and low contrast on white. Beautiful cat, invisible mascot. |
| Cream / white | Disappears against the white canvas entirely. |
| Tuxedo or black | Black fur has almost no edge definition — **SAM2's worst case.** Also loses its silhouette anywhere the UI goes dark. |
| Brown tabby | Works, ties to Earth Brown. Genuine second choice, just less punch than ginger. |

**Short-haired is not negotiable.** SAM2 fails hardest on wispy fur; long hair produces a grey
halo that reads as a cheap sticker cutout. A short-haired tabby masks clean. A Persian or
Maine Coon will not.

---

## 2. The yarn ball

Good call from your team lead — it gives the kitten something to *do*, which is what makes
idle animation read as alive rather than as a loop.

**Colour: Slate Blue Grey `#6B7B84`.** The brand's own base colour, and near-complementary to
ginger, so it pops against the fur without introducing a sixth hue to the palette.

**Tightly wound, with no loose trailing thread.** A loose strand is a few pixels wide and SAM2
will shred it — you would get a flickering broken line. Specify a tight ball every time.

**It does not appear in every clip.** A bouncing yarn ball during a failed transfer is tonally
wrong. Assignment:

| Clip | Yarn |
|---|---|
| Idle | Resting still beside the kitten |
| Play A / B / C | Actively played with |
| Travel | Absent — the plane replaces it |
| Delivered | Present, celebratory |
| Waiting / held | Resting still, untouched — a toy left alone reads as patience |
| Sorry | Present but still, rolled slightly away |

**Keep the ball touching or nearly touching the kitten** in every frame. Two separated objects
means masking two subjects and keeping their relative positions in sync. Touching means one
contiguous subject and one mask.

### The thread should be drawn in code, not filmed

Here is the idea worth taking: **the kitten unspools the yarn behind it as it travels, and
that thread is the progress line on the path.**

Do not try to film this. A trailing thread will not survive masking. Draw it in the app as a
stroke that fills in behind the kitten — which is exactly the mechanic the world map already
uses for the flown portion of the corridor arc. It costs nothing, it cannot be mangled by
SAM2, it ties the yarn prop into the core progress mechanic, and it makes the tracking screen
and the map speak the same visual language.

---

## 3. The plane

For travel between stations: **a small kraft-cardboard-and-paper toy aeroplane**, plain and
unbranded, with the kitten sitting in the cockpit and its front paws resting over the edge.

Kraft cardboard is a warm neutral that sits naturally beside Earth Brown, so the prop adds no
new colour. And it is physically plausible — a real kitten in a real cardboard plane is
something a video model can actually render, whereas a kitten balanced on a folded paper dart
will generate as mush.

Two hard rules:

- **No spinning propeller.** Thin blades plus motion blur is SAM2's second-worst case after
  black fur. Either no propeller at all, or a small static one.
- **The plane does not fly anywhere.** It bobs gently in place. The app slides the whole
  kitten-and-plane along the path. A clip with real forward motion cannot be retimed to a
  stage whose duration the app does not know in advance.

---

## 4. How many clips

**8 total.** Six required, two for variety. Unchanged by the yarn and the plane — they change
what happens inside the clips, not how many there are.

| # | Clip | Length | Loops | Fires when |
|---|------|--------|-------|-----------|
| 1 | Idle | 4s | yes | Sitting at a station, waiting for the next stage |
| 2 | Play A — paw swat | 2.5s | no | A stage completes |
| 3 | Travel — plane | 2s | yes | Moving between stations |
| 4 | Delivered | 3s | no | Money lands. The payoff |
| 5 | Waiting / held | 4s | yes | Transfer held for compliance |
| 6 | Sorry | 3s | no | Transfer failed or cancelled |
| 7 | Play B — pounce wiggle | 2.5s | no | variety |
| 8 | Play C — roll | 2.5s | no | variety |

Clips 7–8 exist because there are **five stage-completions in about 25 seconds**. One play
animation firing five times reads as a broken GIF. Three variants cycled reads as a character.

Clips 5 and 6 are not optional. A transfer held for compliance while a kitten gleefully swats
a yarn ball is the single worst thing this feature can do.

**Expect 3–4 takes per clip.** Budget roughly 30 generations for 8 keepers. These models fail
often, and they fail specifically on what matters here — they add camera motion, crop the
tail, or quietly change the cat.

---

## 5. Character consistency — do this first

Video models will not give you the same kitten twice from text alone. Left to itself, clip 1
is apricot and clip 4 is grey.

**Generate reference stills, approve them, then use image-to-video for every clip.** Every
model worth using accepts a first-frame image. This is the only reliable way to hold one
character across eight files.

You need **two** reference stills.

### Reference A — kitten with yarn (used for clips 1, 2, 4, 5, 6, 7, 8)

```
Studio photograph of a single short-haired apricot-ginger tabby kitten, about 10 weeks old,
sitting upright facing the camera in a three-quarter view. Warm soft marmalade-orange coat
with gentle tabby markings, cream chest, cream front paws and cream muzzle, large round green
eyes, small rounded ears, short plush fur. Resting against its front paws is a small, tightly
wound ball of slate blue-grey yarn with no loose trailing thread. Soft even studio lighting
from the front-left with gentle fill, no harsh shadows. Completely plain seamless medium-grey
backdrop, no floor line, no other objects, no texture. Full body and the yarn ball both in
frame with generous margin on all four sides. Sharp focus throughout. Photorealistic, high
detail.
```

### Reference B — kitten in the plane (used for clip 3)

```
Studio photograph of a single short-haired apricot-ginger tabby kitten, about 10 weeks old,
with a warm marmalade-orange coat, cream chest and paws and large round green eyes, sitting
inside a small plain kraft-cardboard toy aeroplane, its front paws resting over the edge of
the cockpit, looking forward at the camera in a three-quarter view. The aeroplane is simple,
unpainted natural cardboard with paper wings, no propeller, no markings, no text. Soft even
studio lighting from the front-left, no harsh shadows. Completely plain seamless medium-grey
backdrop, no floor line, no other objects. The whole aeroplane and the kitten are in frame
with generous margin on all four sides. Sharp focus throughout. Photorealistic, high detail.
```

Approve reference A first and match reference B's kitten to it — same coat, same eyes, same
markings.

---

## 6. Shared style block

Prepend this to **every** clip prompt, then append that clip's action line.

```
Locked-off tripod shot. The camera does not move at all — no pan, no tilt, no zoom, no dolly,
no handheld shake. A single short-haired apricot-ginger tabby kitten, matching the reference
image exactly, in three-quarter view facing the camera. Completely plain seamless medium-grey
backdrop with no floor line, no furniture, no shadow cast on the backdrop, and no objects
other than those described. Soft even studio lighting, constant for the whole clip. The
kitten stays in the same position in the frame throughout, with generous margin — the ears,
tail and all four paws stay well inside the frame at all times. Movements are slow, smooth
and deliberate. No motion blur. Sharp focus throughout. One continuous shot with no cuts.
```

Negative prompt, on every clip:

```
camera movement, zoom, pan, tilt, dolly, handheld, shake, motion blur, fast motion, long fur,
fluffy, Persian, Maine Coon, black cat, grey cat, cropped paws, cropped tail, cropped ears,
out of frame, subject leaving frame, multiple cats, human hands, people, furniture, floor,
visible ground plane, shadow on backdrop, depth of field, bokeh, background blur, loose
thread, unravelling yarn, spinning propeller, text, watermark, logo, subtitles, cut, scene
change, fade, transition
```

Every exclusion is there for a mechanical reason: camera motion changes the kitten's scale
between frames so it cannot sit still on a UI node, motion blur dissolves the edges SAM2
needs, and anything touching the frame edge produces a mask cut off flat.

Note that generic "props" is **not** excluded any more, because the yarn ball and the plane
are props. The specific unwanted objects are listed instead.

---

## 7. The eight clips

Append one of these to the style block.

### 1 — Idle (4s, must loop) · reference A

```
A small tightly wound ball of slate blue-grey yarn rests still on the ground beside the
kitten's front paws, not moving. The kitten sits calmly, breathing gently. It blinks slowly
twice. The very tip of its tail flicks once, softly. One ear rotates slightly and returns. It
ends in exactly the same sitting pose it started in, with the same posture, the same tail
position, and the yarn ball in the same place.
```

The most-used clip in the app — it plays whenever nothing is happening. Keep the amplitude
low; something that fidgets constantly next to a currency amount is exhausting within thirty
seconds. If the first and last frames do not match closely enough to loop, regenerate. This is
the one clip where a visible seam will be noticed.

### 2 — Play A, paw swat (2.5s) · reference A

```
The kitten lifts one front paw and gently swats at the ball of slate blue-grey yarn twice, in
a playful pawing motion, nudging it only slightly. The yarn ball stays close to the kitten and
does not roll away. The kitten then lowers its paw and settles back into a neutral sitting
pose with the yarn resting beside it.
```

This is what "bat" meant — a cat swatting at a toy with its paw. Watch for the ball rolling
out of frame; that is this clip's failure mode.

### 3 — Travel, plane (2s, must loop) · reference B

```
The kitten sits in the small cardboard toy aeroplane, front paws over the edge of the cockpit,
looking ahead happily. The aeroplane bobs gently up and down in place, tilting very slightly
side to side as if gliding, while staying in exactly the same position in the frame. The
kitten's ears flutter slightly in the breeze. It ends mid-bob exactly as it began.
```

The plane hovers **in place** and the app slides it along the path. That is deliberate: real
forward motion cannot be retimed to a stage whose duration the app does not know in advance,
and a side-profile flight would break consistency with every other clip.

### 4 — Delivered (3s) · reference A

```
The kitten rises up happily on its hind legs and stretches both front paws upward in a
celebratory reach, holds for a moment, then drops back down into a proud, contented sitting
pose with its tail curling around its paws. The ball of slate blue-grey yarn stays resting
beside it throughout.
```

### 5 — Waiting / held (4s, must loop) · reference A

```
The ball of slate blue-grey yarn rests untouched on the ground beside the kitten. The kitten
sits very still and patient, tail curled neatly around its front paws, not playing. It blinks
slowly once. One ear turns slightly as if listening, then returns. Calm and settled, alert but
not distressed. It ends in exactly the pose it started in.
```

Calm and patient — **not sad**. A miserable kitten during a routine compliance hold tells the
user something has gone wrong when nothing has. This clip's job is to say "still here, still
fine, just waiting." The untouched toy does that work.

### 6 — Sorry (3s) · reference A

```
The ball of slate blue-grey yarn sits still on the ground, a little way from the kitten,
untouched. The kitten lowers its head slightly and settles its ears back a little. It raises
one front paw toward the camera in a soft, apologetic gesture and holds it there, staying
still.
```

Gentle and apologetic. Not crying, not cowering. Someone's money did not arrive and they are
about to contact support — the mascot should read as sorry, not as manipulative.

### 7 — Play B, pounce wiggle (2.5s) · reference A

```
The kitten crouches down low in front of the ball of slate blue-grey yarn with its rear
slightly raised, wiggles its hindquarters twice in a playful pounce-ready motion, then does
one small hop forward and lands gently with its paws on either side of the yarn ball before
settling back into a sitting pose.
```

### 8 — Play C, roll (2.5s) · reference A

```
The kitten holds the ball of slate blue-grey yarn between its front paws, flops gently onto
its side, rolls softly onto its back with the yarn ball hugged to its chest and its paws in
the air for a moment, then rolls back and rights itself into a neutral sitting pose with the
yarn resting beside it.
```

Watch this one for the tail and paws leaving frame — it is the clip most likely to break the
margin rule. Check every take.

---

## 8. Pilot before you commit

**Generate clip 1 only. Take it all the way through the pipeline and onto a real phone before
generating anything else.**

1. Generate reference A, approve the kitten.
2. Image-to-video for clip 1. Keep the best of 3–4 takes.
3. SAM2 → alpha matte → export with transparency. **Check the yarn ball came through with
   the cat**, as one subject.
4. Composite into the app over the white canvas and over the dark slate slab.
5. **Look at it on a real Android device, not a monitor.**

What you are checking for: a grey or white fringe around the fur, chewed-up ear tips,
flickering mask edges between frames, whether the yarn ball's mask is stable, and file size.
If the edges hold up, the rest of the production is repetition. If they do not, that is the
moment to reconsider — before thirty generations, not after.

---

## 9. Output specs

**From the video model:** 1080×1080 square if offered, otherwise the highest square or 1:1
option available. 24 or 30 fps, constant. Highest quality tier — compression artefacts around
the fur become mask errors.

**After SAM2**, hand over per clip:

- The masked frames as a **PNG sequence with alpha** (lossless, this is the master), plus
- the original unmasked video, kept in case the matte needs redoing.

Do not hand over a pre-encoded transparent video as the only master. Alpha video on Android
means VP9-in-WebM, device support is uneven, and if the encode is wrong the PNG sequence is
the only way back without regenerating. I will decide between alpha video and a compressed
sprite sheet once I can measure both on a device — sprite sheets are more reliable in React
Native and often smaller at these durations, but that call needs real files.

Keep every master at full resolution. Downscaling is cheap later; upscaling is not possible.
