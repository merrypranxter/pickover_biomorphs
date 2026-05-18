// Post-processing: Darkfield microscopy simulation
// Apply as final pass over any biomorph shader output

precision highp float;

uniform sampler2D u_biomorph;      // The raw organism render
uniform vec2 u_resolution;
uniform float u_time;

// Darkfield: organism glows against absolute black
// Light is scattered by the specimen, not transmitted through it

vec3 darkfield(vec3 specimen, float intensity) {
    // Specimen scatters light proportional to its density
    float scatter = length(specimen) * intensity;
    
    // Blue-shifted scatter (Rayleigh-ish)
    vec3 scatter_col = vec3(0.4, 0.6, 1.0) * scatter;
    
    // Core remains self-luminous
    vec3 core = specimen * 1.5;
    
    // Combine: core detail + scattered halo
    return core + scatter_col * 0.3;
}

// Phase contrast: converts phase shifts into amplitude differences
// For transparent specimens that barely absorb light.
// NOTE: For a full post-processing pass with edge detection and annular ring
// simulation, use microscopy/phase_contrast.frag instead.
vec3 phase_contrast(vec3 specimen, float shift) {
    // Phase shift derived from specimen "density" (luminance proxy)
    float phase = (specimen.r + specimen.g + specimen.b) / 3.0;
    
    // Halo: bright ring at edges
    float halo = smoothstep(0.1, 0.3, phase) * (1.0 - smoothstep(0.4, 0.6, phase));
    
    // Shade: dark interior where phase is uniform
    float shade = smoothstep(0.3, 0.5, phase);
    
    vec3 pc = specimen;
    pc += vec3(0.7, 0.75, 0.8) * halo * shift;
    pc *= 1.0 - shade * 0.3 * shift;
    
    return pc;
}

// Stain: artificial coloration for contrast
vec3 gram_stain(vec3 specimen, float amount) {
    // Crystal violet / safranin palette
    vec3 crystal_violet = vec3(0.35, 0.15, 0.55);
    vec3 safranin = vec3(0.85, 0.25, 0.20);
    
    // Positive stain: takes up crystal violet
    float pos = smoothstep(0.2, 0.6, length(specimen));
    
    // Negative stain: counterstained with safranin
    float neg = 1.0 - pos;
    
    vec3 stained = mix(safranin, crystal_violet, pos);
    return mix(specimen, stained, amount);
}

// Oil immersion chromatic aberration
vec3 oil_immersion(vec3 col, vec2 uv, float strength) {
    float dist = length(uv - 0.5);
    float ca = dist * strength;
    
    col.r = col.r + ca * 0.5;
    col.b = col.b - ca * 0.3;
    
    return col;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 specimen = texture2D(u_biomorph, uv).rgb;
    
    // Default: darkfield mode
    vec3 col = darkfield(specimen, 1.0);
    
    // Uncomment for phase contrast:
    // col = phase_contrast(specimen, 1.0);
    
    // Uncomment for Gram stain:
    // col = gram_stain(specimen, 0.7);
    
    // Oil immersion aberration (subtle)
    col = oil_immersion(col, uv, 0.02);
    
    // Emulsion grain
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.92 + 0.08 * grain;
    
    gl_FragColor = vec4(col, 1.0);
}
