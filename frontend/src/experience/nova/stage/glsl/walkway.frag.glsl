// Holographic walkway: hexagonal grid, two rails, a glow under Nova, and a hexagonal ring at each footstep
#define STEPS 12
#define STEP_LIFE 0.9

uniform float uTime;
uniform float uOpacity;
uniform float uCenter;
uniform vec2 uHalf;
uniform float uNovaX;
uniform float uActivity;
uniform vec3 uSteps[STEPS];
uniform vec3 uColor;
varying vec2 vFloor;

float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

// position inside the nearest hexagonal cell (cells of unit width)
vec2 hexCell(vec2 p) {
  const vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  return dot(a, a) < dot(b, b) ? a : b;
}

void main() {
  vec2 p = vFloor;
  float fadeX = 1.0 - smoothstep(uHalf.x * 0.55, uHalf.x, abs(p.x - uCenter));
  float fadeZ = 1.0 - smoothstep(uHalf.y * 0.6, uHalf.y, abs(p.y));
  float near = exp(-pow((p.x - uNovaX) / 0.5, 2.0));

  float grid = 1.0 - smoothstep(0.03, 0.075, 0.5 - hexDist(hexCell(p / 0.14)));
  float rail = smoothstep(0.014, 0.0, abs(abs(p.y) - uHalf.y * 0.8));
  float scan = 0.75 + 0.25 * sin((p.x - uTime * 0.7) * 3.5);

  float glow = 0.03 + grid * (0.1 + 0.55 * near * (0.45 + 0.55 * uActivity)) * scan;
  glow += rail * (0.35 + 0.5 * near);
  glow += near * 0.1 * fadeZ;

  for (int i = 0; i < STEPS; i++) {
    vec3 s = uSteps[i];
    float age = uTime - s.z;
    if (age < 0.0 || age > STEP_LIFE) continue;
    float ring = abs(hexDist(p - s.xy) - (0.035 + age * 0.24));
    glow += (1.0 - age / STEP_LIFE) * smoothstep(0.02, 0.0, ring) * 2.4;
  }

  gl_FragColor = vec4(uColor * glow * fadeX * fadeZ * uOpacity, 1.0);
}
