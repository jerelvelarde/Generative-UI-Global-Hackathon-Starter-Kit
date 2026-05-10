export const HEARTH_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const FOREST_CABIN_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uSceneMix;
uniform float uColorTempK;
uniform float uRainIntensity;
uniform float uFogDensity;
uniform float uWindowGlow;
uniform float uTimeOfDay;
uniform float uMotionRate;
uniform float uVignette;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.13, 289.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float windowMask(vec2 uv) {
  vec2 centered = abs(uv - vec2(0.5, 0.52));
  return smoothstep(0.28, 0.24, max(centered.x * 1.5, centered.y));
}

vec3 colorTempTint(float kelvin) {
  float t = clamp((kelvin - 2700.0) / 3800.0, 0.0, 1.0);
  return mix(vec3(1.08, 0.92, 0.8), vec3(0.85, 0.95, 1.06), t);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * (0.15 + uMotionRate * 0.6);

  vec3 forestTop = vec3(0.06, 0.12, 0.2);
  vec3 forestBottom = vec3(0.02, 0.05, 0.08);
  vec3 bedroomTop = vec3(0.22, 0.11, 0.12);
  vec3 bedroomBottom = vec3(0.1, 0.05, 0.09);

  vec3 baseTop = mix(forestTop, bedroomTop, uSceneMix);
  vec3 baseBottom = mix(forestBottom, bedroomBottom, uSceneMix);
  vec3 color = mix(baseBottom, baseTop, pow(uv.y, 0.75));

  float cloud = noise(vec2(uv.x * 2.8 + t * 0.25, uv.y * 2.0 - t * 0.1));
  color += cloud * 0.05;

  float window = windowMask(uv);
  float windowNoise = noise(vec2(uv.x * 12.0 + t * 0.7, uv.y * 9.0 + t * 0.5));
  vec3 windowColor = mix(vec3(0.94, 0.78, 0.44), vec3(0.9, 0.66, 0.38), uSceneMix);
  color += window * windowColor * (0.2 + uWindowGlow * 0.85 + windowNoise * 0.18);

  vec2 rainUv = uv * vec2(18.0, 26.0);
  float rainShift = fract(rainUv.y - t * 4.2);
  float rainMask = step(0.965, hash(vec2(floor(rainUv.x), floor(rainUv.y))));
  float rainStreak = smoothstep(0.08, 0.0, abs(rainShift - 0.5));
  color += vec3(0.36, 0.5, 0.72) * rainMask * rainStreak * uRainIntensity * 0.45;

  float fog = smoothstep(0.2, 1.05, uv.y + noise(uv * 6.0 + t) * 0.2) * uFogDensity;
  color = mix(color, vec3(0.22, 0.26, 0.32), fog * 0.6);

  float dayNight = mix(0.65, 1.0, uTimeOfDay);
  color *= dayNight;
  color *= colorTempTint(uColorTempK);

  float vignette = smoothstep(0.95, 0.3, distance(uv, vec2(0.5)));
  color *= mix(1.0 - uVignette * 0.45, 1.0, vignette);

  gl_FragColor = vec4(color, 1.0);
}
`;

