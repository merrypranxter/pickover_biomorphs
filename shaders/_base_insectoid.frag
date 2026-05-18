// HABITAT: Darkfield microscopy, glass substrate, transmitted light
// ORGANISM: Base insectoid — a chitinous, segmented creature with radiating appendages
// FUNCTION: z = z^z + c (Pickover's original biomorph generator)
// MUTATION: c = (0.5, 0.1), iter = 80, convergence threshold tuned for limb formation

precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define MAX_ITER 80
#define CONV_THRESH 0.001
#define ESCAPE_THRESH 50.0

// Complex arithmetic
vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cpow(vec2 z, vec2 w) {
    // z^w = exp(w * log(z))
    float r = length(z);
    if (r < 1e-7) return vec2(0.0);   // guard: log(0) is undefined
    float theta = atan(z.y, z.x);
    float log_r = log(r);
    float mag = exp(w.x * log_r - w.y * theta);
    float arg = w.x * theta + w.y * log_r;
    return vec2(mag * cos(arg), mag * sin(arg));
}

vec2 cexp(vec2 z) {
    return exp(z.x) * vec2(cos(z.y), sin(z.y));
}

// The biomorph function: z = z^z + c
vec2 biomorph(vec2 z, vec2 c) {
    return cpow(z, z) + c;
}

// Color mapping based on biological properties
vec3 stain(float wander, float final_arg, float iter_ratio) {
    // wander: how much the orbit wandered (limb density indicator)
    // final_arg: final angle — segment identity
    // iter_ratio: how long it survived — cuticle thickness
    
    vec3 chitin = vec3(0.18, 0.14, 0.08);       // dark amber exoskeleton
    vec3 membrane = vec3(0.92, 0.85, 0.72);       // translucent membrane
    vec3 haemolymph = vec3(0.55, 0.12, 0.08);   // insect blood
    vec3 nucleoplasm = vec3(0.25, 0.35, 0.20);    // nuclear material
    
    // Cuticle: high iteration survival, low wander
    float cuticle = smoothstep(0.3, 0.7, iter_ratio) * (1.0 - wander);
    
    // Tendrils: high wander, mid iteration
    float tendril = wander * smoothstep(0.2, 0.6, iter_ratio) * (1.0 - smoothstep(0.7, 0.9, iter_ratio));
    
    // Core: converged quickly
    float core = (1.0 - iter_ratio) * (1.0 - wander);
    
    vec3 col = mix(membrane, chitin, cuticle);
    col = mix(col, haemolymph, tendril * 0.7);
    col = mix(col, nucleoplasm, core * 0.5);
    
    // Segment banding from final argument
    float segment = sin(final_arg * 6.0) * 0.5 + 0.5;
    col *= 0.8 + 0.2 * segment;
    
    return col;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    // Viewport: microscope stage
    float zoom = 3.0 + 0.5 * sin(u_time * 0.1);
    vec2 offset = vec2(-2.0, -1.5);
    vec2 c = (st + offset) * zoom;
    
    // Mouse interaction: breed new mutations
    vec2 mouse_norm = u_mouse / u_resolution;
    vec2 mutation = vec2(0.5, 0.1);
    mutation += (mouse_norm - 0.5) * vec2(0.4, 0.2);
    
    vec2 z = c;  // Initialize z from pixel coordinate (orbioid mapping)
    
    float wander = 0.0;
    float last_z = length(z);
    bool converged = false;
    int iter = 0;
    
    for (int i = 0; i < MAX_ITER; i++) {
        z = biomorph(z, mutation);
        float len = length(z);
        
        // Check for escape (dead — outside organism)
        if (len > ESCAPE_THRESH) {
            iter = i;
            break;
        }
        
        // Check for convergence (core — organelle)
        float delta = abs(len - last_z);
        if (delta < CONV_THRESH && i > 10) {
            converged = true;
            iter = i;
            break;
        }
        
        // Measure wander: the biological signature
        wander += abs(len - last_z);
        last_z = len;
        iter = i;
    }
    
    wander /= float(MAX_ITER);
    float iter_ratio = float(iter) / float(MAX_ITER);
    float final_arg = atan(z.y, z.x);
    
    vec3 col = stain(wander, final_arg, iter_ratio);
    
    // Darkfield: background is dark, organism glows
    float alive = 1.0 - smoothstep(0.0, 0.05, wander + (converged ? 0.0 : 0.1));
    col *= alive;
    
    // Vignette: microscope field edge
    float vig = 1.0 - smoothstep(0.5, 1.5, length(st - 0.5));
    col *= vig;
    
    // Noise: grain of the emulsion
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col *= 0.95 + 0.05 * grain;
    
    gl_FragColor = vec4(col, 1.0);
}
