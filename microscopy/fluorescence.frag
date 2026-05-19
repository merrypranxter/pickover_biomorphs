// Post-processing: Epifluorescence microscopy simulation
// Apply as final pass over any biomorph shader output
//
// Epifluorescence inverts the visual logic of transmitted microscopy:
// the background is dark, the specimen glows. The specimen's color depends on
// which fluorescent label it carries, not on its absorbance.
//
// This shader simulates a three-channel fluorescence acquisition:
//   CH1 (green):  GFP-like emission (488/510 nm) — structural label
//   CH2 (red):    RFP-like emission (561/620 nm) — membrane or nuclear label
//   CH3 (blue):   DAPI-like emission (405/460 nm) — DNA / nucleoid label
//
// Each channel is independently thresholded and colorized, then merged.
// The merger produces the characteristic false-color overlays of published
// fluorescence micrographs — cyan/magenta/yellow composite where labels overlap.
//
// Artifacts simulated:
//   - Fluorescence bleed-through between channels (spectral overlap)
//   - Halo from spherical aberration at high-NA objectives
//   - Detector saturation: bright regions clip to channel maximum
//   - Photobleaching time-decay: intensity decreases with exposure duration

precision highp float;

uniform sampler2D u_biomorph;   // Raw organism render
uniform vec2 u_resolution;
uniform float u_time;

// ── Utility ───────────────────────────────────────────────────────────────────

float luminance(vec3 col) {
    return dot(col, vec3(0.299, 0.587, 0.114));
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(17.3421, 63.7843))) * 23871.4512);
}

// ── Channel extraction ────────────────────────────────────────────────────────
// Map biomorph color channels to simulated fluorescence channels.
// The biomorph's R/G/B channels encode different biological features
// (density, wander, convergence) — we treat them as proxy fluorescence signals.

// CH1 (GFP/green): structural signal — uses green channel + partial blue
float ch1_signal(vec3 specimen) {
    return clamp(specimen.g * 1.2 + specimen.b * 0.3, 0.0, 1.0);
}

// CH2 (RFP/red-orange): membrane signal — uses red channel
float ch2_signal(vec3 specimen) {
    return clamp(specimen.r * 1.3, 0.0, 1.0);
}

// CH3 (DAPI/blue): nucleoid signal — uses blue channel + green
float ch3_signal(vec3 specimen) {
    return clamp(specimen.b * 1.4 + specimen.g * 0.15, 0.0, 1.0);
}

// ── Fluorescence emission colors ──────────────────────────────────────────────
const vec3 GFP_EMISSION  = vec3(0.25, 1.00, 0.35);   // 510 nm — green
const vec3 RFP_EMISSION  = vec3(1.00, 0.28, 0.10);   // 620 nm — red-orange
const vec3 DAPI_EMISSION = vec3(0.30, 0.45, 1.00);   // 460 nm — blue-indigo

// ── Bleed-through ─────────────────────────────────────────────────────────────
// In real fluorescence: each detector captures a range of wavelengths.
// Some RFP emission leaks into the GFP detector (red bleed into green).
// Fraction of bleed depends on spectral overlap — typically 5-15%.
const float BLEED_RFP_INTO_GFP = 0.08;   // RFP bleed into GFP channel
const float BLEED_GFP_INTO_DAPI = 0.05;  // GFP bleed into DAPI channel

// ── Spherical aberration halo ─────────────────────────────────────────────────
// High-NA objectives introduce a diffraction ring around bright point sources.
// Simulated as a faint Gaussian halo around high-intensity regions.
vec3 spherical_halo(sampler2D tex, vec2 uv, vec2 texel) {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    // 9-tap Gaussian blur (approximation)
    for (int dx = -2; dx <= 2; dx++) {
        for (int dy = -2; dy <= 2; dy++) {
            vec2 offset = vec2(float(dx), float(dy)) * texel * 3.0;
            float w = exp(-float(dx*dx + dy*dy) * 0.4);
            sum += texture2D(tex, uv + offset).rgb * w;
            total += w;
        }
    }
    return sum / total;
}

// ── Photobleaching ────────────────────────────────────────────────────────────
// Intensity decays over illumination time (exponential bleach)
// Simulated with a slow time-dependent attenuation
float photobleach_factor(float time) {
    return mix(1.0, 0.65, 1.0 - exp(-time * 0.015));
}

// ── Detector saturation ───────────────────────────────────────────────────────
// CCD/sCMOS detectors saturate at high photon counts.
// Bright regions clip; the knee is soft (anti-blooming).
float detector_response(float signal) {
    return signal / (signal + 0.5) * 1.5;   // smooth saturation curve
}

// ── Full fluorescence pass ────────────────────────────────────────────────────
void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 texel = 1.0 / u_resolution;

    vec3 specimen = texture2D(u_biomorph, uv).rgb;

    // Spherical aberration halo (blurred source)
    vec3 blurred = spherical_halo(u_biomorph, uv, texel);

    // Mix: sharp signal + blurred halo (halo is 20% of total)
    vec3 src = specimen * 0.82 + blurred * 0.18;

    // Extract per-channel fluorescence signals
    float s1 = ch1_signal(src);
    float s2 = ch2_signal(src);
    float s3 = ch3_signal(src);

    // Apply bleed-through
    s1 += s2 * BLEED_RFP_INTO_GFP;
    s3 += s1 * BLEED_GFP_INTO_DAPI;

    // Apply detector response (smooth saturation)
    s1 = detector_response(s1);
    s2 = detector_response(s2);
    s3 = detector_response(s3);

    // Photobleaching attenuation
    float bleach = photobleach_factor(u_time);
    s1 *= bleach;
    s2 *= bleach * 0.92;   // RFP bleaches faster than GFP
    s3 *= bleach * 1.05;   // DAPI is relatively stable

    // False-color composite: channels add onto black background
    vec3 col = vec3(0.0);
    col += GFP_EMISSION  * s1;
    col += RFP_EMISSION  * s2;
    col += DAPI_EMISSION * s3;

    // CCD shot noise: Poisson noise at low photon counts
    float frame = floor(u_time * 12.0);
    float noise = hash(uv * 512.0 + vec2(frame * 47.3, frame * 23.1)) * 0.025;
    col += vec3(noise);

    // Dark current: faint thermal glow from the detector — blue-weighted
    col += vec3(0.003, 0.004, 0.007);

    // Vignette: field stop + illumination fall-off at edges
    float vig = exp(-pow(length(uv - 0.5) * 2.4, 2.0));
    col *= 0.6 + 0.4 * vig;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
