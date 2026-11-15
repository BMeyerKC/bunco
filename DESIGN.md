---
name: Bunco Score Keeper
description: A ruled score pad in blue ballpoint by day, the same sheet chalked on a slate board by night.
colors:
  paper: "#fdfcf7"
  card: "#ffffff"
  ink: "#24262b"
  ink-soft: "#4f535c"
  muted: "#6c707a"
  pen: "#1f4aa8"
  pen-contrast: "#ffffff"
  margin: "#d9474c"
  error-text: "#b3262b"
  marker: "#ffe66b"
  rule: "#b4cbe6"
  stroke: "#34373e"
  hairline: "#dcdfe6"
  paper-dark: "#232e29"
  card-dark: "#2b3833"
  ink-dark: "#ecefe8"
  ink-soft-dark: "#c8cfc3"
  muted-dark: "#a3ada5"
  pen-dark: "#a9c8f0"
  pen-contrast-dark: "#1b2420"
  margin-dark: "#f0a8a2"
  marker-dark: "#eee3a8"
typography:
  display:
    fontFamily: "Kalam, 'Segoe Print', cursive"
    fontSize: "clamp(96px, min(30vw, 26vh), 230px)"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Kalam, 'Segoe Print', cursive"
    fontSize: "2.625rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.005em"
  title:
    fontFamily: "Kalam, 'Segoe Print', cursive"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.005em"
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    letterSpacing: "0"
rounded:
  wobble-sm: "125px 10px 115px 10px / 10px 115px 10px 125px"
  wobble-md: "24px 8px 22px 10px / 10px 22px 8px 24px"
  pad: "6px 6px 22px 10px / 6px 6px 10px 24px"
  die: "14px"
  sheet: "10px"
  sticker: "4px"
spacing:
  gutter: "16px"
  stack: "16px"
  tap: "48px"
  topbar: "56px"
  measure: "34rem"
components:
  button-pen:
    backgroundColor: "{colors.pen}"
    textColor: "{colors.pen-contrast}"
    rounded: "{rounded.wobble-sm}"
    padding: "10px 22px"
    height: "{spacing.tap}"
  button-ink:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.wobble-sm}"
    padding: "10px 22px"
    height: "{spacing.tap}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.pen}"
    rounded: "{rounded.wobble-sm}"
    padding: "10px 12px"
    height: "{spacing.tap}"
  button-bunco:
    backgroundColor: "{colors.margin}"
    textColor: "#ffffff"
    rounded: "{rounded.wobble-sm}"
    padding: "8px 16px"
    height: "{spacing.tap}"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.wobble-sm}"
    padding: "10px 14px"
    height: "{spacing.tap}"
  index-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.wobble-md}"
    padding: "18px 20px"
  player-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sticker}"
    padding: "6px 12px"
  code-slot:
    backgroundColor: "{colors.card}"
    textColor: "{colors.pen}"
    rounded: "{rounded.die}"
---

# Design System: Bunco Score Keeper

## Overview

**Creative North Star: "The Score Sheet on the Card Table"**

Every screen is a piece of stationery you would find at a Bunco night. In light mode it is a ruled score pad written in blue ballpoint; in dark mode it is the same sheet chalked on a slate-green board. Headings and scores look handwritten, surfaces are index cards with a drawn ink outline, and the corners wobble as if someone inked them freehand.

The playfulness sits on top of a strict usability floor. The body text is 17px, every control is at least 48px tall, and one main action per screen is inked solid blue. The page is a single narrow column made for a phone held in one hand in a dim room. Motion is feedback only, with one exception: the BUNCO! stamp and confetti, the one orchestrated moment in the product.

**Key Characteristics:**
- Paper and chalkboard are one design in two materials, switched by `data-theme`, never two designs.
- Handwriting for what is written on the sheet (headings, scores, table names); a plain sans for everything people read.
- A drawn 2px ink stroke and wobbly corners instead of shadows and gradients.
- Blue pen does the work; red is saved for the margin line and BUNCO!; yellow highlighter marks the winner.
- Sentence case everywhere. No tracked capitals.

## Colors

A stationery palette: off-white paper, near-black ink, one blue pen, one red pen, one yellow highlighter. Light values are in the frontmatter; each has a `-dark` chalkboard counterpart. Components read only the semantic CSS tokens in `src/styles/base.css` (`--paper`, `--card`, `--ink`, `--pen`, `--margin`, `--marker`, `--rule`, `--stroke`), never a raw palette hex.

### Primary
- **Blue Ballpoint** (`pen`, chalk blue in dark): the main action on a screen, links, score numerals, the game code, focus rings, and "done" states such as a submitted table. Its 9% tint (`--pen-soft`) is the hover and pressed wash for every quiet control.

### Secondary
- **Red Margin** (`margin`, chalk pink in dark): the pad's margin line, the step numbers written in that margin, and the BUNCO! button and stamp. Invalid field borders also use it; error text on paper uses the darker `error-text` for contrast.

### Tertiary
- **Highlighter Yellow** (`marker`, chalk yellow in dark): swiped behind the leader's name and first place, washed over a side that reaches 21, and used for the "round called" pill, the warning toast, and the resume note.

### Neutral
- **Score-Pad Paper** (`paper`): the page. **Index Card** (`card`): every raised surface and field.
- **Ink** (`ink`), **Soft Ink** (`ink-soft`), **Pencil Grey** (`muted`): text, secondary text, helper text. Pencil Grey is the lightest text allowed (4.9:1 on paper).
- **Ink Outline** (`stroke`): the 2px drawn border on cards, buttons, and fields.
- **Ruled-Line Blue** (`rule`): section dividers, the top bar and footer rules, and the pad's lines.
- **Hairline** (`hairline`): quiet 1px borders inside lists and on disabled controls.

### Named Rules
**The One Red Thing Rule.** Red belongs to the margin line and to BUNCO!. Never use it for an ordinary button, link, badge, or decoration, so the big moment owns the color.

**The Token Rule.** New CSS and JS-built markup use the semantic tokens only. The three literal colors in the code are deliberate exceptions: dark ink on highlighter yellow, white text on the red stamp, and a white quiet zone behind the QR code.

## Typography

**Display Font:** Kalam 700 (with Segoe Print, cursive)
**Body Font:** Nunito 400 to 900 (with system-ui, sans-serif)

**Character:** Kalam is the handwriting on the sheet; Nunito is the round, friendly print that people actually read. The pairing reads like a form someone has filled in by hand.

### Hierarchy
- **Display** (Kalam 700, `clamp(96px, min(30vw, 26vh), 230px)`, line-height 1): the two live score numerals, in blue pen with tabular figures.
- **Headline** (Kalam 700, 2.625rem and 2.0625rem, line-height 1.15): page titles (h1, h2).
- **Title** (Kalam 700, 1.625rem and 1.3125rem): card titles, dialog titles, round label, table names (h3, h4).
- **Body** (Nunito 400, 1.0625rem, line-height 1.55): all running text, in a 34rem column. Lead text is 1.3125rem in Soft Ink.
- **Label** (Nunito 700, 0.9375rem, no tracking, sentence case): field labels and helper text. Captions are 0.8125rem.
- **Button text** (Nunito 800, 1.0625rem). The game code is Nunito 900 with wide tracking, not handwriting, so it can be read aloud across a room.

The scale is about 1.25 from a 17px body: 13 / 15 / 17 / 21 / 26 / 33 / 42 / 52.

### Named Rules
**The Written-vs-Read Rule.** Kalam is for things written on the sheet: headings, scores, table names, step numbers. Anything a person must read quickly or tap (body copy, buttons, labels, codes) is Nunito.

**The 17 Rule.** Body text is never below 17px, and nothing a player needs mid-game is below 15px. Small handwriting needs a larger nominal size (1.45rem).

## Layout

One centered column, 34rem wide, with a 16px gutter and 24px top and 48px bottom padding. The body is a flex column so the footer sits at the bottom of short pages. Vertical rhythm is a 16px stack between siblings, with 20 to 28px between sections.

The shared shell is a 56px top bar in normal flow (wordmark or Home link left, theme toggle right) and a slim footer (version and Feedback), each separated from the page by a 2px ruled line. Nothing is fixed over content.

The scoring board is the exception to the column: it fills the viewport as two equal halves split by a dashed rule, each half one large tap target, with its own bar above and action bar below that respects the safe-area inset.

Layout is phone-first. The only width breakpoints are 640px (the home pad gets a wider margin and a larger title) and 420px (the scoring action bar tightens). Internal tool pages (admin, debug, tests) use a plain, dense 960px layout and are not held to the stationery treatment.

## Elevation & Depth

Nearly flat. Depth comes from the drawn ink outline and from Index Card white sitting on Score-Pad Paper, not from shadow. There is one shadow token and one page-wide paper grain.

### Shadow Vocabulary
- **Card lift** (`--shadow`; light: `0 1px 0 rgba(36,38,43,0.06), 0 3px 10px rgba(36,38,43,0.10)`, dark: `0 2px 10px rgba(0,0,0,0.35)`): index cards, the solid blue button, dialogs, toasts, code slots.
- **Focus glow** (`0 0 0 3px var(--pen-soft)`): focused fields and the next empty code slot.
- **Grain**: a fixed fractal-noise overlay at 3.5% opacity on paper, 7% on the chalkboard.

### Named Rules
**The One Shadow Rule.** Use `--shadow` or nothing. No new shadow values, no stacked elevations, no glows.

## Shapes

Corners look hand-drawn. Two asymmetric "wobble" radii do this without images: a pill-like one (`wobble-sm`) for buttons, fields, steppers, and the stamp, and a card-sized one (`wobble-md`) for index cards, dialogs, and toasts. Outlines are a consistent 2px in Ink Outline.

A few objects have their own silhouette because they are real things: the score pad and the code card have a thick 12px top border (the glued binding) and uneven lower corners; code slots and dice are rounded squares (14px, 12px); player chips are square-cornered name-tag stickers (4px) tilted about one degree. Small tilts of 0.6 to 2 degrees are used on stickers, slots, the stamp, and the quick-score card, and straighten once an item is filled or settled.

Dashed lines mean "not really there yet": ghost players, disabled buttons, a claimed Bunco, the divider between sides.

## Components

### Buttons
Three levels, one main action per screen.
- **Shape:** wobble-sm corners, 48px minimum height, 10px 22px padding, Nunito 800.
- **Pen (primary):** solid Blue Ballpoint with contrast text and the card shadow. Hover brightens slightly; press nudges down 1px.
- **Ink (secondary):** Index Card fill, Ink text, 2px Ink Outline. Hover washes in pen-soft.
- **Quiet (tertiary):** text only in Blue Ballpoint, Nunito 700, pen-soft wash on hover.
- **Disabled:** transparent with a dashed Hairline border and Pencil Grey text.
- **Focus:** a 3px Blue Ballpoint outline offset 3px, on every focusable element.

### Chips
- **Player chip:** a name-tag sticker. Index Card fill, 1.5px Ink Outline, 4px corners, alternating slight tilt. Ghost players get a dashed border and Pencil Grey text. New chips slide up over 0.25s.
- **Status badge:** a small Blue Ballpoint outlined pill for "submitted". **Round called pill:** a tilted highlighter label.

### Cards / Containers
- **Index card:** the one surface for grouped content. Index Card fill, 2px Ink Outline, wobble-md corners, card shadow, 18px 20px padding. A Blue Ballpoint border marks the card that is about you (your seat, your next action).
- **Sheet box and table card:** lighter list surfaces with a 1px Hairline border and plain 8 to 10px corners. A table card has a 4px left edge that turns Blue Ballpoint once that table has submitted.
- **Score pad:** the home page hero. Ruled lines every 34px, a 2px red margin line, and the binding along the top.

### Inputs / Fields
- **Style:** Index Card fill, 2px Ink Outline, wobble-sm corners, 48px minimum height (56px for the large variant).
- **Focus:** border turns Blue Ballpoint with the focus glow.
- **Error:** Red Margin border and a bold inline message below the field. Never an alert box.
- **Stepper:** a single outlined control, minus and plus in Blue Ballpoint at 64px wide, the value in handwriting between them.
- **Code slots:** four die-shaped slots mirroring one real, invisible input, so paste and screen readers work normally. Empty slots are tilted and the next one shows a blinking caret.

### Navigation
The top bar holds a die icon with the wordmark on the home page, or a "← Home" link everywhere else, plus a 44px theme toggle that shows the mode you would switch to. There is no menu.

### Dialogs and Toasts
Native `<dialog>`, styled as an index card up to 440px wide over a dimmed scrim, rising 12px as it opens. Toasts drop in from the top center: card for info, solid blue for success, highlighter for warnings, with an optional outlined action such as undo.

### Scoreboard
Each half of the screen is one large button that adds a point. It shows the side label in handwriting, player names, the score numeral in blue pen, tally marks toward 21, and a small outlined minus button at the bottom. A side that reaches 21 is washed in highlighter. A "tap a side to add a point" hint shows until the first tap. Scores pop briefly (0.18s) on change.

### BUNCO! Stamp
The one red thing. The button is solid Red Margin, tilted 1.5 degrees, weight 900. Tapping it and choosing a player triggers a highlighter flash, the word BUNCO! in red handwriting inside a 6px red frame that spins in and settles at a tilt, three dice that slide up and shake, and confetti. Once claimed, the button becomes a dashed red outline.

## Do's and Don'ts

### Do:
- **Do** use the semantic tokens (`var(--pen)`, `var(--card)`, `var(--stroke)`) in all CSS and in any markup built from JS, so both themes work.
- **Do** give every screen exactly one solid blue button, and make everything else Ink or Quiet.
- **Do** keep every tappable control at least 48px tall (44px for icon buttons in the top bar and dialogs).
- **Do** keep body text at 17px or larger and labels in sentence case.
- **Do** use the highlighter to mean "winning" or "pay attention", and dashed lines to mean "not really there yet".
- **Do** show errors inline under the field, and use `<dialog>` and `<details>` for dialogs and disclosure.
- **Do** honor `prefers-reduced-motion`; the global rule in `base.css` already shortens every animation.
- **Do** check any new surface on both paper and chalkboard.

### Don't:
- **Don't** use red for anything except the margin line, margin step numbers, field errors, and BUNCO!.
- **Don't** hardcode palette hex values or reintroduce gradients as fills.
- **Don't** add a second shadow, a glow, or a new radius; reuse `--shadow`, `--wobble-sm`, and `--wobble-md`.
- **Don't** use tracked ALL-CAPS labels.
- **Don't** set body copy, buttons, or codes in Kalam.
- **Don't** fix elements over the content; the shell stays in normal flow.
- **Don't** use `alert()`.
- **Don't** add orchestrated motion beyond the BUNCO! moment; everything else is short feedback.
- **Don't** reintroduce a CSS framework. The old Bootstrap class names and the legacy token aliases (`--accent`, `--surface`, `--bg`) exist only so older markup keeps working; new code uses the current names.
