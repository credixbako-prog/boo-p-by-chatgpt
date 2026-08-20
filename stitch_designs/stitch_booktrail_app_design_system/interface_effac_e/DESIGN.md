---
name: Interface Effacée
colors:
  surface: '#fef9ef'
  surface-dim: '#dedad0'
  surface-bright: '#fef9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e9'
  surface-container: '#f2ede3'
  surface-container-high: '#ede8de'
  surface-container-highest: '#e7e2d8'
  on-surface: '#1d1c16'
  on-surface-variant: '#44474c'
  inverse-surface: '#32302a'
  inverse-on-surface: '#f5f0e6'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#535f74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#101c2e'
  on-primary-container: '#79849b'
  inverse-primary: '#bbc7df'
  secondary: '#456552'
  on-secondary: '#ffffff'
  secondary-container: '#c4e8d0'
  on-secondary-container: '#496a56'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2c1600'
  on-tertiary-container: '#b77528'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e3fc'
  primary-fixed-dim: '#bbc7df'
  on-primary-fixed: '#101c2e'
  on-primary-fixed-variant: '#3c475b'
  secondary-fixed: '#c7ebd3'
  secondary-fixed-dim: '#abcfb8'
  on-secondary-fixed: '#002112'
  on-secondary-fixed-variant: '#2d4d3b'
  tertiary-fixed: '#ffdcbe'
  tertiary-fixed-dim: '#ffb870'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#693c00'
  background: '#fef9ef'
  on-background: '#1d1c16'
  surface-variant: '#e7e2d8'
  bleu-nuit: '#0F1B2D'
  vert-sauge: '#6D8F7A'
  ocre-terracotta: '#D28B3D'
  creme-parchment: '#F2EDE3'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Poppins
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 24px
  margin-desktop: 64px
  gutter: 16px
  section-gap: 40px
---

## Brand & Style

The design system is rooted in the philosophy of "Interface Effacée" (Erased Interface). It prioritizes the act of reading and reflection over digital noise, positioning the product as a premium "intellectual companion" rather than a mere utility. The aesthetic draws from high-end physical journals, modern architectural libraries, and heritage editorial design.

The style is a sophisticated blend of **Minimalism** and **Tactile/Skeuomorphic** elements. While the layouts remain clean with significant whitespace and a restricted palette, the interactions (rotary dials, 3D card flips) and surfaces (diffuse shadows, parchment-like backgrounds) provide a sensory, physical connection to the digital experience. It evokes a sense of calm, depth, and introspection.

**Key Visual Principles:**
- **Editorial Hierarchy:** Use typography to signal importance, mimicking the layout of a literary magazine.
- **Physical Metaphors:** Digital elements should behave like physical paper or mechanical tools (resistance, weight, and depth).
- **Silent UI:** Remove unnecessary decorative elements; every line must serve a narrative or functional purpose.

## Colors

The palette is inspired by natural, archival materials: aged paper, deep ink, dried herbs, and clay.

- **Creme Parchment (#F2EDE3):** The foundational background. It provides visual comfort and reduces eye strain compared to pure white, mimicking the grain of high-quality book paper.
- **Bleu Nuit (#0F1B2D):** The ink. Used for all primary typography, structural borders, and deep-contrast UI elements. It conveys authority and intellectual depth.
- **Vert Sauge (#6D8F7A):** The "Trace" color. Dedicated to growth and progression. Used for reading paths, footprints, and progress indicators.
- **Ocre Terracotta (#D28B3D):** The "Human" color. Used for warmth, community interactions (Kudos), bookmarks, and primary calls to action. It stands out against the cool Sage and deep Blue without being aggressive.

## Typography

The system uses a pairing of a humanist sans-serif and a high-contrast serif to create an editorial feel.

- **Playfair Display (Serif):** Reserved for "literary" moments—personal greetings, book titles, and philosophical reflections. It adds a premium, historical weight to the interface.
- **Poppins (Sans-serif):** Used for functional UI elements, navigation, and body text. Its geometric clarity ensures legibility and a modern touch.

**Usage Rules:**
- Use **Playfair Display** for headers and pull-quotes to break the digital monotony.
- **Poppins** should be the workhorse for all interactive labels and long-form data reading.
- Maintain generous line-heights (1.5x for body) to preserve the "breathable" feel of a well-set book.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous safe areas to maintain the minimalist aesthetic.

- **Mobile:** 4-column grid with 24px side margins. Focus on a single vertical flow to encourage focus.
- **Desktop/Tablet:** 12-column grid with a maximum content width of 1100px. Content should be centered with wide "white-space" gutters to mimic the margins of a printed page.
- **The "Sentier" (Path):** A central vertical axis in the library view around which content is anchored. This non-traditional layout breaks the standard grid to visualize a journey.
- **Rhythm:** Spacing follows an 8px base unit. Larger gaps (40px+) are encouraged between sections to prevent the UI from feeling "crowded."

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** and **Ambient Shadows** rather than traditional elevation.

- **Surfaces:** Use subtle shifts in the parchment background or low-opacity Sage/Ocre tints to distinguish containers.
- **Shadows:** Shadows must be extremely soft and diffused (Blur > 20, Opacity < 0.08). They should feel like a soft glow or a natural lift from the paper, never like a heavy digital drop-shadow.
- **Translucency:** Use backdrop blurs sparingly for overlays (like the "Session Active" mode) to maintain a sense of focus while keeping the context visible.
- **3D Transitions:** The "Passport" view uses a 180-degree Y-axis flip. This movement provides a sense of physical back-and-front to digital cards.

## Shapes

The shape language is highly organic and approachable.

- **Main Cards:** 20px (rounded-xl) for large content blocks and book covers.
- **Small Components:** 12px (rounded-lg) for buttons, input fields, and secondary cards.
- **Interactive Elements:** Circular forms for progress rings and the rotary dial to emphasize the cyclical nature of reading habits.
- **Icons:** 1.5pt stroke weight, monochrome only. Icons should be fine-lined and elegant. Specifically, footprints, clapping hands, and bookmarks must adhere to this weight to feel cohesive.

## Components

### Buttons & Actions
Primary buttons use a solid **Ocre Terracotta** fill with Bleu Nuit text. Secondary actions use the **Bleu Nuit** stroke (1.5pt) with no fill. All buttons use 12px corner radius.

### The Rotary Dial
A tactile slider for page input. It should feature a "mechanical" resistance feel via haptic feedback. Visually, it is a minimalist arc or wheel with fine tick marks (1.5pt) and the current value in Playfair Display.

### Progress Rings
Minimalist circles using **Vert Sauge**. The stroke represents the percentage complete. For the "Daily Objective," the ring should be thin (2pt stroke) to remain unobtrusive on the dashboard.

### Cards & Passports
Cards use a 20px radius and soft shadows. The "Passport" view is a double-sided card; the front shows the book identity, and the back (revealed via flip) shows captured "Traces" (notes/metadata).

### Input Fields & Search
Styled as simple 1.5pt Bleu Nuit bottom-borders or 12px rounded boxes with a faint parchment-tinted fill. Focus states are indicated by a slight darkening of the border—never a glow.

### The Path (Sentier)
A vertical line (1pt, Vert Sauge) with intermittent footprint icons. Book cards are staggered to the left and right of this line to create a chronological "trail."