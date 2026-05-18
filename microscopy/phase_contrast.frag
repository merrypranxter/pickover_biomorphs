// Post-processing: Phase contrast microscopy simulation
// Apply as final pass over any biomorph shader output
//
// Phase contrast converts invisible phase shifts (optical path differences in
// transparent specimens) into visible amplitude (brightness) differences.
// Key signatures: bright halo around specimen edges, dark interior of uniform regions.
// Best suited for: _embryonic, aquatic/translucent organisms, thin membranes.

precision highp float;

uniform sampler2D u_biomorph;   // Raw organism render
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_phase_shift;    // Degree of phase amplification (default 1.0)

// ── Phase contrast core ───────────────────────────────────────────────────────
// In real phase contrast, a phase plate retards the unscattered (background)
// beam by λ/4. Here we simulate the effect on the rendered luminance field.

float luminance(vec3 col) {
    return dot(col, vec3(0.299, 0.587, 0.114));
}

// Estimate local phase from specimen density (luminance proxy)
// Returns gradient magnitude as edge strength
float edgeStrength(sampler2D tex, vec2 uv, vec2 texel) {
    // Sobel-ish on luminance
    float tl = luminance(texture2D(tex, uv + texel * vec2(-1.0,  1.0)).rgb);
    float tc = luminance(texture2D(tex, uv + texel * vec2( 0.0,  1.0)).rgb);
    float tr = luminance(texture2D(tex, uv + texel * vec2( 1.0,  1.0)).rgb);
    float ml = luminance(texture2D(tex, uv + texel * vec2(-1.0,  0.0)).rgb);
    float mr = luminance(texture2D(tex, uv + texel * vec2( 1.0,  0.0)).rgb);
    float bl = luminance(texture2D(tex, uv + texel * vec2(-1.0, -1.0)).rgb);
    float bc = luminance(texture2D(tex, uv + texel * vec2( 0.0, -1.0)).rgb);
    float br = luminance(texture2D(tex, uv + texel * vec2( 1.0, -1.0)).rgb);

    float gx = -tl + tr - 2.0 * ml + 2.0 * mr - bl + br;
    float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
    return sqrt(gx * gx + gy * gy);
}

vec3 phase_contrast(vec3 specimen, float edge, float phase) {
    float lum = luminance(specimen);

    // Halo: bright ring at specimen boundaries (constructive interference)
    float halo = smoothstep(0.03, 0.15, edge) * (1.0 - smoothstep(0.3, 0.6, lum));

    // Shadow: dark interior where phase is uniform (destructive interference)
    float shadow = smoothstep(0.35, 0.55, lum) * (1.0 - edge * 5.0);

    // Phase-shifted specimen — desaturate toward grey background
    float grey_bg = 0.65;  // the bright background field of phase contrast
    vec3 bg = vec3(grey_bg);

    vec3 col = mix(bg, specimen, 0.6);                  // specimen embedded in field
    col += vec3(0.85, 0.90, 0.95) * halo * phase;       // halo ring, slightly cool
    col -= vec3(0.20, 0.18, 0.15) * shadow * phase;     // interior shadow, warm subtract

    return clamp(col, 0.0, 1.0);
}

// ── Annular ring artifact ─────────────────────────────────────────────────────
// Real phase contrast optics produce a faint annular halo around the entire
// field from the phase plate itself. We simulate it as a subtle bright ring.
vec3 annular_artifact(vec3 col, vec2 uv) {
    float r = length(uv - 0.5) * 2.0;  // 0 at center, 1 at field edge
    float ring = exp(-pow((r - 0.72) / 0.06, 2.0));  // Gaussian at r=0.72
    return col + vec3(0.9, 0.92, 0.95) * ring * 0.08;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 texel = 1.0 / u_resolution;

    vec3 specimen = texture2D(u_biomorph, uv).rgb;

    float edge = edgeStrength(u_biomorph, uv, texel);
    float shift = (u_phase_shift > 0.0) ? u_phase_shift : 1.0;

    vec3 col = phase_contrast(specimen, edge, shift);

    // Annular ring from phase plate
    col = annular_artifact(col, uv);

    // Oil immersion: chromatic aberration (subtle, cold axis)
    float dist = length(uv - 0.5);
    col.b += dist * 0.012;
    col.r -= dist * 0.008;

    // Emulsion grain: slightly finer than darkfield (higher-resolution optics)
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(17.3421, 63.7843))) * 23871.4512);
    col *= 0.95 + 0.05 * grain;

    gl_FragColor = vec4(col, 1.0);
}
