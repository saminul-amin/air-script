# AirScript — visual redesign plan

Design plan for Goal 2, approved and implemented in `client/src` (tokens in
`index.css`, motion presets in `motion.ts`, components under `components/`).

## Concept: paper and ink

Today the app is a dark "glass" dashboard where the canvas is one panel among
many. The redesign makes the drawing surface a sheet of warm paper sitting on a
near-black desk, with strokes in dark ink. The recognised text is typeset in a
large display serif directly under the paper, so the product reads as
*your handwriting becoming print*. Everything else (tools, camera preview,
suggestions, status) is small, grey, and quiet.

## Palette (CSS custom properties)

Dark-first, one look, one accent. The accent is reserved for the recognition
moment and the active control, nothing else.

```css
:root {
  /* desk (page) */
  --desk-0: #0b0d12;          /* page background */
  --desk-1: #12151c;          /* panels, rails */
  --desk-2: #1a1e27;          /* raised controls, hover */
  --line:   rgba(255,255,255,0.08);
  --line-strong: rgba(255,255,255,0.16);

  /* paper (the canvas) */
  --paper:      #f7f4ee;
  --paper-edge: #e6e1d7;
  --ink:        #1c1f27;      /* stroke colour on paper */

  /* text on the desk */
  --text-0: #f3f4f6;
  --text-1: #a3a9b5;
  --text-2: #6b7280;

  /* the one accent: signal orange */
  --accent:      #ff6a3d;
  --accent-ink:  #ffd9cc;     /* accent-tinted text on dark */
  --accent-soft: rgba(255,106,61,0.14);

  /* semantic, used sparingly */
  --ok:     #3ddc97;
  --warn:   #f5b72f;
  --danger: #ff5c5c;

  /* motion */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --dur-fast: 140ms;
  --dur-base: 200ms;
  --dur-slow: 260ms;
}
```

Drawing mode keeps its colour swatches for the *stroke* only; the UI chrome
never changes colour with the mode. Mode is communicated by the paper
(writing: ruled baseline hint; drawing: plain sheet) and the segmented control.

## Type pairing

| Role | Face | Use |
|------|------|-----|
| Display | **Fraunces** (variable, optical size 72–144) | The recognised sentence under the canvas; the resolved glyph that pops when a character lands. |
| UI | **Inter** (already loaded) | Everything else. 12–14 px body, 11 px uppercase tracked labels, 600 weight only for buttons and titles. |
| Mono | **JetBrains Mono** | Raw character strip, confidence percentages, keyboard hints, sample names. |

Both new faces come from Google Fonts with real fallback stacks
(`Georgia, serif` and `ui-monospace, Menlo, monospace`).

## Layout (one paragraph)

A single centred composition, no floating pills. A slim top bar holds the
wordmark, the Write/Draw segmented control, the input-source switch
(Mouse/touch · Hand), and a small status dot with the service state. Below it
the paper canvas takes about 62% of the width at a 4:3 ratio and is the only
light element on the page. Directly under the paper, full width, sits the
"typeset line": the corrected text in Fraunces at 40–56 px, with the raw
character strip in mono underneath it in grey. A 56 px icon rail on the left
carries the tools (labels appear on hover and in the shortcuts sheet). A 280 px
column on the right holds the last-character card (glyph, confidence bar,
alternatives) and the suggestions; the whole column collapses to nothing until
there is content, so a first-time visitor sees paper, a "Replay a sample" row,
and the privacy line, and not an empty dashboard. Connection state is a one-line
strip between the top bar and the paper that only exists while the service is
waking, degraded or offline.

## Motion (all 120–260 ms, `--ease-out`, all gated by `prefers-reduced-motion`)

| Moment | Treatment | Reduced motion |
|--------|-----------|----------------|
| Strokes | Variable-width ink: width eases with pointer speed (thinner when fast), round caps, slight opacity build at stroke start. Pure canvas, no framer. | Constant width, no opacity build. |
| Character resolves | Stroke fades on the paper (200 ms) while the glyph appears in the last-character card with a 6 px rise and the confidence bar filling (260 ms). | Instant swap; bar renders at final width. |
| Correction | Changed words in the typeset line get the accent underline for one beat; the old word cross-fades out, the new one in (200 ms). Raw→corrected shown, not swapped silently. | Colour highlight only, no cross-fade. |
| Suggestions | Chips enter with a 4 px rise + fade, staggered 30 ms; reorder uses layout animation. | Fade only, no stagger, no layout animation. |
| Gesture state | The GestureIndicator becomes a large outlined glyph in the paper's corner (✋ ☝ ✊ 👍) with the label; the active one is filled with the accent. Switching is a 140 ms cross-fade. | Instant. |
| Mode switch | Segmented control thumb slides (200 ms); the paper's ruled baseline fades in/out. | Thumb jumps; baseline toggles. |
| Connection / warm-up | Status dot pulses only while waking; the strip's elapsed-seconds counter is text, not an animated bar. | No pulse. |

Implementation notes: a single `useReducedMotion()` from Framer Motion plus a
`@media (prefers-reduced-motion: reduce)` block in `index.css` that zeroes CSS
transitions; every `motion.*` gets its `transition` from one shared
`motionPresets.ts` so durations stay in range.
