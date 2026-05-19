# Color as Anatomy

Biomorphs have no intrinsic color. The iteration algorithm produces numbers — iteration counts, orbit wander, final angles — and color is a **mapping** from these numbers to the visible spectrum. This mapping is not arbitrary: the best biomorph colorings simulate actual biological staining and microscopy protocols.

---

## The Three Coloring Variables

Every pixel in a biomorph shader is characterized by three primary derived values:

### 1. `iter_ratio` — survival depth
```
iter_ratio = float(iter) / float(MAX_ITER)
```
How long the orbit survived before escaping or converging, normalized to [0,1]. This is the classic "escape time" coloring variable, reframed biologically:

- **iter_ratio ≈ 0**: converged immediately — deep core, nucleus, central organelle
- **iter_ratio ≈ 0.5**: survived to mid-range — intermediate structures, cytoplasm
- **iter_ratio ≈ 1.0**: survived almost to the end — boundary structures, outer membrane, cuticle
- **iter_ratio = MAX_ITER/MAX_ITER**: never escaped — most stable interior

### 2. `wander` — orbit complexity
```
wander = (Σ |length(z_n) - length(z_{n-1})|) / MAX_ITER
```
Total radial path length of the orbit, normalized. High wander means the orbit is actively moving; low wander means it has settled.

- **wander ≈ 0**: escaped immediately (no accumulation) OR converged to a fixed point
- **wander = moderate**: the living boundary — membranes, cell walls, filaments
- **wander = high**: complex, active orbits — most biological-looking zones

### 3. `final_arg` — angular identity
```
final_arg = atan(z_final.y, z_final.x)  ∈ [-π, π]
```
The angular direction of the final orbit position. This encodes **angular periodicity** — features that repeat around the organism. It is used for:
- Segmentation in insects (exoskeletal segments)
- Striae in diatoms (periodic ribs)
- Radial spines in radiolarians
- Comb-plate banding in ctenophores

---

## Biological Staining Palettes

Real microscopy uses chemical stains to create contrast in transparent specimens. Each stain has a characteristic color signature. The GLSL `stain()` functions simulate these.

### Gram Stain (bacteria)

The most important clinical stain. The result depends on cell wall structure:

| Cell type | Primary stain (crystal violet) | Counterstain (safranin) | Result |
|-----------|-------------------------------|------------------------|--------|
| Gram-positive | Retained — thick peptidoglycan | Not visible | Deep purple-violet |
| Gram-negative | Washed out — thin wall, outer membrane | Takes up safranin | Pink to red |

In the shaders:
```glsl
vec3 crystal_violet = vec3(0.38, 0.12, 0.65);  // Gram-positive
vec3 safranin       = vec3(0.85, 0.25, 0.28);  // Gram-negative
```

The `_spirochete` shader uses gram-negative coloring; crystal violet appears in `microscopy/brightfield.frag`.

### Hematoxylin & Eosin (H&E)

The universal histology stain. Used for tissue sections in pathology.

| Component | Stains | Color |
|-----------|--------|-------|
| Hematoxylin | Nuclei, DNA, nuclear ribosomes | Blue-violet (basophilic) |
| Eosin | Cytoplasm, collagen, most proteins | Pink-red (eosinophilic) |

H&E creates the most recognizable histological images: blue nuclei surrounded by pink cytoplasm on a white background.

### Giemsa / Wright-Giemsa

Used for blood smears, bone marrow, protozoan parasites (Plasmodium, Leishmania).

| Component | Color |
|-----------|-------|
| Azure A/B (methylene blue series) | Blue-purple — nuclear chromatin |
| Eosin | Pink-orange — cytoplasm, red blood cells |
| Both together | Granules appear as metachromatic colors (purple, lilac) |

### PAS (Periodic Acid-Schiff)

Stains polysaccharides: glycogen, mucin, fungal cell walls, spore coats.

| Component | Color |
|-----------|-------|
| PAS-positive material | Magenta-red |
| Background | Counterstained blue (haematoxylin) or pale |

Used in `_spore.frag` to color the polysaccharide-rich dormancy wall.

### Oil Red O / Sudan stains

Stains neutral lipids: fat droplets, yolk granules, lipid bilayers.

| Component | Color |
|-----------|-------|
| Lipid droplets | Orange-red |
| Aqueous regions | Counterstain (blue, green) |

Approximated in `_embryonic.frag` with the yolk palette:
```glsl
vec3 yolk = vec3(0.95, 0.78, 0.25);  // lipid-rich yolk granules
```

---

## Microscopy Imaging Palettes

Beyond chemical stains, the imaging modality itself dictates the color palette.

### Darkfield

Light is scattered by the specimen against an absolutely black background. Scattered light is blue-shifted (Rayleigh scattering preferentially scatters short wavelengths).

```
Background:  #000000 — absolute black
Specimen:    warm white to orange-amber (self-scattered light)
Halo:        faint blue-white around bright structures
```

The darkfield look: specimens appear as if lit from within against void. Every biomorph has an appropriate darkfield palette — the stain functions return colors that are designed to glow against black.

### Phase Contrast

Converts optical path differences (phase shifts) into amplitude differences. The result:

```
Background:  bright grey-white (85-90% field brightness)
Specimen:    darker than background (phase objects appear as shadows)
Boundary:    bright halo (constructive interference at sharp phase transitions)
Interior:    uniform dark shadow (destructive interference in thick regions)
```

Phase contrast is ideal for transparent specimens (embryos, living cells) because it generates contrast without staining.

### Brightfield (Köhler)

```
Background:  warm white (tungsten-halogen, 3200K) to daylight-balanced white (5500K)
Specimen:    absorbs specific wavelengths — stain-dependent colors
Field:       uniform, Gaussian fall-off at edges (Köhler illumination)
```

### Epifluorescence

```
Background:  near-black (< 2% of saturation)
Specimen:    glows in emission color — emission wavelength determines hue
Multiple channels: independent pseudo-colors, typically green/red/blue
Composite:   CMY or RGB overlay of channels
```

The `microscopy/fluorescence.frag` shader implements a three-channel composite with:
- CH1 (488/510 nm): GFP-like — green
- CH2 (561/620 nm): RFP-like — red-orange  
- CH3 (405/460 nm): DAPI-like — blue

---

## Color Math

### smoothstep as an anatomical knife

```glsl
float zone = smoothstep(low, high, iter_ratio);
```

This creates a smooth transition between anatomical zones based on survival depth. It is the primary tool for placing anatomical boundaries at specific iteration depths.

### The final_arg modulation

Periodic features (segments, ribs, spines) are generated by:

```glsl
float segment = sin(final_arg * N) * 0.5 + 0.5;
col *= 0.8 + 0.2 * segment;
```

Where N is the number of repeated features around the organism. This is the most direct translation of angular periodicity into visual structure.

### Orbit trap coloring

An alternative (not used in the base shaders, but extensible) is orbit trapping: during iteration, detect when the orbit comes close to a specific geometric figure (a point, line, or circle) and record that distance. Use the minimum distance as a coloring variable.

For biological rendering:
- Trap to a circle → concentric rings, suggesting cell cross-sections
- Trap to the real axis → bilateral symmetry emphasis
- Trap to a lattice of points → pore-field coloring for diatoms or radiolarians

---

## The Palette Design Process

### Step 1: Identify the organism's anatomical zones

Every real organism has distinct structural regions with different optical properties. List them:
- `_radiolarian`: silicate shell → cytoplasm core → spine → pore
- `_embryonic`: membrane → cytoplasm → yolk → nucleus

### Step 2: Map zones to coloring variables

Match each zone to a coloring variable or combination:
- Deep converged core → low `iter_ratio`, low `wander`
- Outer wall → high `iter_ratio`, low `wander`
- Filamentous extensions → high `wander`, mid `iter_ratio`
- Angular repeats → `final_arg` modulation

### Step 3: Choose biologically accurate colors

Research the actual appearance of the structure under microscopy:
- Look at published histology plates and electron micrographs
- Note the specific stain used (H&E, PAS, Gram, Giemsa...)
- Extract representative RGB values from reference images
- Adjust for monitor gamma (typical specimen images are sRGB, typically gamma ≈ 2.2)

### Step 4: Mix with smoothstep and mix()

```glsl
vec3 col = mix(cytoplasm, membrane, smoothstep(0.3, 0.7, iter_ratio));
col = mix(col, nucleus, (1.0 - iter_ratio) * 0.7);
```

The key is that `mix()` in GLSL is linear — it does not account for perceptual linearity. For very dark-to-bright transitions, consider using a gamma correction:

```glsl
col = pow(col, vec3(1.0 / 2.2));  // linear → sRGB
```

### Step 5: Add the microscopy modality as a filter

Apply the darkfield, phase contrast, or fluorescence post-processing shader as the final step. These are in `microscopy/` and are designed to be composited as second render passes.

---

## False Color vs. Natural Color

Biomorphs do not exist. There is no "correct" color. The entire point of the color mapping is to produce an *impression* of biological reality — the feeling that you are looking at a real organism through a real microscope.

Two approaches:

**Naturalistic**: colors match a specific real organism under a specific real stain. The result looks like an actual micrograph. This creates the strongest biological illusion.

**Expressive**: colors are chosen for visual impact, biological plausibility, or aesthetic effect. Bioluminescent organisms (`_hybrid_mutation`, `_ctenophore`) use expressive palettes because their natural appearance is extraordinary.

The taxonomy documents for each species specify which approach is used and what real organisms serve as reference.
