// Environment: Fluorescent medium — aqueous buffer with fluorescent tracer
// Used with: _ctenophore (GFP-tagged), _hybrid_mutation (bioluminescence simulation)
//
// In epifluorescence microscopy, the specimen is excited by a specific wavelength
// and emits at a longer wavelength. The background (medium) contributes:
//   - Autofluorescence from the buffer itself (very low, diffuse)
//   - Out-of-focus fluorescence from tracer molecules (blurred haze)
//   - Photobleaching gradients where illumination was intense
//   - Detector dark current + shot noise (CCD-specific grain pattern)
//
// This shader simulates the DARK background field of epifluorescence,
// not the bright field of transmitted microscopy. The background is near-black;
// specimen emission is the signal, not the background.
//
// Three simulated fluorescence channels (as in typical multi-channel experiments):
//   CH1: GFP-like (488 nm excitation / 510 nm emission) — green
//   CH2: RFP-like (561 nm excitation / 620 nm emission) — red-orange
//   CH3: DAPI-like (405 nm excitation / 460 nm emission) — blue
//
// Render before the specimen shader; overlay specimen emission on this background.

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

// ── Utility ───────────────────────────────────────────────────────────────────

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 47453.5453);
}

float snoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

// ── Fluorescence background generation ───────────────────────────────────────

// Buffer autofluorescence: extremely dim, broad-spectrum green-blue glow
// Peaks in GFP channel from trace organics in PBS/HEPES buffer
float buffer_autofluorescence(vec2 uv) {
    float n = snoise(uv * 4.5 + vec2(u_time * 0.006, u_time * 0.004));
    return n * 0.015;  // very faint
}

// Out-of-focus fluorescent tracer: blurred diffuse haze from molecules above/below focal plane
// More intense at edges where the illumination cone intersects more out-of-focus volume
float oof_haze(vec2 uv) {
    float t = u_time * 0.03;
    float n1 = snoise(uv * 1.5 + vec2(t, -t * 0.7));
    float n2 = snoise(uv * 3.2 + vec2(-t * 0.5, t));
    float haze = n1 * 0.6 + n2 * 0.4;
    // Slightly stronger near illumination axis (center)
    float radial = 1.0 - smoothstep(0.0, 0.6, length(uv - 0.5));
    return haze * radial * 0.025;
}

// Photobleaching gradient: illumination center gets bleached over time
// Creates a dimming zone in the center of the field
float photobleach_gradient(vec2 uv) {
    float r = length(uv - 0.5);
    // Bleaching accumulates at center — simulate as a mild darkening
    float t_norm = mod(u_time * 0.02, 1.0);
    float bleach = exp(-r * 4.0) * t_norm * 0.12;
    return bleach;
}

// Shot noise / dark current: CCD detector noise at low photon counts
// This is temporally varying (each frame is independent noise)
// Unlike film grain (static), CCD noise is purely stochastic per readout
float detector_noise(vec2 uv) {
    // Temporal noise: changes every "frame" (use time-quantized hash)
    float frame = floor(u_time * 15.0);   // 15 fps noise acquisition
    float n = hash2(uv * 800.0 + vec2(frame * 31.7, frame * 17.3));
    // Gaussian-distributed: most noise is near zero, rare bright hot pixels
    float gaussian_approx = pow(n, 3.0);   // approximate Poisson for low counts
    return gaussian_approx * 0.04;
}

// ── Multi-channel fluorescence background ─────────────────────────────────────
vec3 fluorescent_background(vec2 uv) {
    float autofluor = buffer_autofluorescence(uv);
    float haze      = oof_haze(uv);
    float bleach    = photobleach_gradient(uv);
    float noise     = detector_noise(uv);

    // Fluorescence background is DARK — near-black
    // Only trace contributions from autofluorescence and OOF haze
    vec3 base = vec3(0.0);

    // CH3 (DAPI, blue): buffer autofluorescence peaks in blue channel
    base.b += autofluor * 1.2;
    base.g += autofluor * 0.4;

    // CH1 (GFP, green): OOF haze — out-of-focus GFP-labeled molecules
    base.g += haze * 0.9;
    base.b += haze * 0.3;

    // CH2 (RFP, red-orange): minimal autofluorescence in red channel
    base.r += autofluor * 0.3;

    // Photobleaching: dim the illuminated center slightly
    base *= (1.0 - bleach);

    // Detector noise: CCD dark current adds to all channels uniformly
    base += vec3(noise * 0.6, noise * 0.7, noise * 0.8);

    // Illumination gradient: Gaussian beam — brighter at center
    float illum = exp(-pow(length(uv - 0.5) * 2.5, 2.0));
    base *= (0.4 + 0.6 * illum);   // even in dark regions, slight central bias

    // Hard vignette at field stop
    float vig = smoothstep(0.52, 0.46, length(uv - 0.5));
    base *= vig;

    return clamp(base, 0.0, 1.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 col = fluorescent_background(uv);
    gl_FragColor = vec4(col, 1.0);
}
