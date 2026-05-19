// Post-processing: Brightfield (Köhler illumination) microscopy simulation
// Apply as final pass over any biomorph shader output
//
// Brightfield is the default mode of the optical microscope — and the most demanding
// to render convincingly. The specimen is sandwiched between transmitted white light
// (from below, through the condenser) and the objective above. Regions that absorb or
// scatter light appear dark against the bright white background field.
//
// Key optical properties of Köhler illumination:
//   - Uniform background field: the condenser focuses the light source at the
//     objective back focal plane, producing an even, glare-free background
//   - Specimen contrast: depends entirely on absorption (natural pigments, stains)
//     or scattering (thick walls, inclusions). Transparent specimens have low contrast.
//   - Chromatic effects: glass optics have residual lateral and axial CA at field edges
//   - Depth of focus: limited — out-of-focus regions appear blurred (simulated here
//     with a very slight luminance-gradient-based blur at low-contrast zones)
//
// Also contains:
//   giemsa_stain()    — blood smear / protozoan stain (azure-eosin palette)
//   wright_stain()    — Wright-Giemsa variant, common for hematology
//   crystal_violet()  — gram stain positive (deep violet)
//
// Best suited for: _diatom, _spore, _radiolarian (brightfield mode)

precision highp float;

uniform sampler2D u_biomorph;   // Raw organism render
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_magnification;  // Magnification factor (default 1.0)

// ── Utility ───────────────────────────────────────────────────────────────────

float luminance(vec3 col) {
    return dot(col, vec3(0.299, 0.587, 0.114));
}

// Estimate local absorbance as inverse of luminance
// (a thick absorbing specimen is darker → higher "absorbance proxy")
float absorbance(vec3 col) {
    return 1.0 - luminance(col);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// ── Köhler background field ───────────────────────────────────────────────────
// The background should be uniform warm white, with very slight:
//   - Lateral chromatic aberration (color fringing) near field edges
//   - Illumination fall-off due to condenser aperture (smooth, gentle)
//   - Thermal fluctuation in the arc lamp (< 0.5% intensity flicker)
vec3 kohler_background(vec2 uv) {
    // Even illumination field — warm white (tungsten-halogen lamp with daylight filter)
    vec3 field = vec3(0.960, 0.955, 0.940);

    // Lamp flicker: very slow sinusoidal < 0.3% amplitude
    float flicker = 1.0 + 0.003 * sin(u_time * 7.3);
    field *= flicker;

    // Illumination fall-off: gentle cosine^4 roll-off at field edges
    float r = length(uv - 0.5);
    float illum = pow(max(0.0, cos(r * 1.57)), 4.0);
    field *= mix(0.88, 1.0, illum);

    // Lateral chromatic aberration (residual in real apochromatic objectives too)
    float mag = (u_magnification > 0.0) ? u_magnification : 1.0;
    float ca_strength = 0.006 / mag;
    field.r += (r - 0.3) * ca_strength;
    field.b -= (r - 0.3) * ca_strength * 0.6;

    return field;
}

// ── Specimen integration ──────────────────────────────────────────────────────
// In brightfield, the specimen SUBTRACTS from the background:
// bright regions of the biomorph render correspond to dense/stained areas that
// absorb transmitted light — they should appear dark in the final composite.
vec3 brightfield_composite(vec3 specimen, vec3 background) {
    // Absorbance: how much light the specimen removes
    float abs_val = absorbance(specimen);

    // Beer-Lambert: transmitted intensity = I₀ * exp(-ε * c * l)
    // Approximate here as a power curve
    float transmission = exp(-abs_val * 2.2);

    // The field is dimmed where the specimen absorbs
    vec3 col = background * transmission;

    // Residual specimen color: some stains transmit colored light (e.g., eosin = pink)
    // Mix a fraction of the specimen's intrinsic color back in
    col = mix(col, specimen * background, abs_val * 0.35);

    return col;
}

// ── Stain utilities ───────────────────────────────────────────────────────────

// Giemsa stain: azure (blue) for nuclear material, eosin (pink-red) for cytoplasm
// Used for blood smears, malaria, protozoa, thin tissue sections
vec3 giemsa_stain(vec3 specimen, float amount) {
    vec3 azure  = vec3(0.25, 0.40, 0.75);   // methylene azure — nuclear material
    vec3 eosin  = vec3(0.95, 0.45, 0.50);   // eosin Y — cytoplasmic/eosinophilic

    float lum = luminance(specimen);

    // Nuclear (dark) → azure; cytoplasmic (mid-bright) → eosin
    float nuclear  = 1.0 - smoothstep(0.0, 0.4, lum);
    float cytoplasm = smoothstep(0.2, 0.6, lum) * (1.0 - smoothstep(0.6, 0.9, lum));

    vec3 stained = mix(specimen, azure, nuclear * amount);
    stained = mix(stained, eosin, cytoplasm * amount * 0.7);

    return stained;
}

// Wright-Giemsa: slightly warmer than standard Giemsa — more common in clinical labs
vec3 wright_stain(vec3 specimen, float amount) {
    vec3 stained = giemsa_stain(specimen, amount);
    // Warmer shift: tungsten lamp accentuates the eosin pink
    return mix(stained, stained * vec3(1.05, 0.97, 0.93), amount * 0.4);
}

// Crystal violet: gram stain step 1 — all bacteria stain deep violet
vec3 crystal_violet(vec3 specimen, float amount) {
    vec3 violet = vec3(0.38, 0.12, 0.65);
    float density = luminance(specimen);
    return mix(specimen, violet, density * amount);
}

// ── Depth-of-field softening ──────────────────────────────────────────────────
// In brightfield, out-of-focus regions appear blurred.
// We estimate "out-of-focus-ness" as regions with low local contrast.
vec3 dof_soften(sampler2D tex, vec2 uv, vec2 texel) {
    // Center sample
    vec3 center = texture2D(tex, uv).rgb;

    // Local contrast estimate (range in 3×3 neighborhood)
    float lum_max = luminance(center);
    float lum_min = luminance(center);
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            float l = luminance(texture2D(tex, uv + vec2(float(dx), float(dy)) * texel).rgb);
            lum_max = max(lum_max, l);
            lum_min = min(lum_min, l);
        }
    }
    float local_contrast = lum_max - lum_min;

    // Low-contrast zones → slight softening
    float blur_amount = 1.0 - smoothstep(0.02, 0.15, local_contrast);

    // Simple 5-tap blur for the soft regions
    vec3 blurred = center;
    blurred += texture2D(tex, uv + texel * vec2( 1.5,  0.0)).rgb;
    blurred += texture2D(tex, uv + texel * vec2(-1.5,  0.0)).rgb;
    blurred += texture2D(tex, uv + texel * vec2( 0.0,  1.5)).rgb;
    blurred += texture2D(tex, uv + texel * vec2( 0.0, -1.5)).rgb;
    blurred /= 5.0;

    return mix(center, blurred, blur_amount * 0.35);
}

// ── Main pass ─────────────────────────────────────────────────────────────────
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 texel = 1.0 / u_resolution;

    // Depth-of-field softening on raw biomorph
    vec3 specimen = dof_soften(u_biomorph, uv, texel);

    // Köhler background field
    vec3 background = kohler_background(uv);

    // Brightfield composite: specimen absorbs from background
    vec3 col = brightfield_composite(specimen, background);

    // Default stain: Giemsa (uncomment others to switch)
    col = giemsa_stain(col, 0.55);
    // col = wright_stain(col, 0.55);
    // col = crystal_violet(col, 0.6);

    // Very slight field curvature artifact: edges curved upward in luminance
    float field_curve = smoothstep(0.4, 0.52, length(uv - 0.5)) * 0.04;
    col += vec3(field_curve * 0.8, field_curve * 0.9, field_curve);

    // Emulsion / sensor grain (CCD brightfield has less grain than film)
    float grain = hash(uv * 1024.0 + vec2(floor(u_time * 30.0)));
    col *= 0.98 + 0.02 * grain;

    // Hard vignette at field stop
    float vig = smoothstep(0.52, 0.46, length(uv - 0.5));
    col *= vig;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
