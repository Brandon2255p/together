import { NOISE } from "@/components/ui/orb-scene";

// The smooth ball: a Together's bubble (screen 17) and the balls standing in for them while they load.
// Unlike the hero orb it never changes shape: the outline stays a perfect circle, lit from the top left with a soft
// gloss, and only the colour drifts slowly across the surface. Opaque, so overlapping bubbles don't blend.

export const ballVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObjNormal;
void main(){
  vObjNormal = normal;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

export const ballFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObjNormal;
${NOISE}
void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  // the light sits up and to the left, in view space, so the gloss stays put as the cluster turns
  vec3 l = normalize(vec3(-0.5, 0.65, 0.6));
  float wrap = dot(n, l) * 0.5 + 0.5;
  // low-frequency colour drift across the surface: the ball looks alive without changing shape
  float drift = snoise(vObjNormal * 0.9 + vec3(uTime * 0.11, uTime * 0.07, uTime * 0.05)) * 0.5 + 0.5;

  // base tone in the shade, lighter tone toward the light, highlight tone on the lit cap
  vec3 col = mix(uA, uB, smoothstep(0.2, 1.0, wrap * 0.75 + drift * 0.35));
  col = mix(col, uC, smoothstep(0.62, 1.0, wrap) * 0.6);
  // a little depth on the far side
  col *= mix(0.84, 1.0, smoothstep(0.0, 0.55, wrap));

  // soft sheen and a small gloss spot
  vec3 h = normalize(l + v);
  float nh = max(dot(n, h), 0.0);
  col += vec3(1.0) * (pow(nh, 7.0) * 0.12 + pow(nh, 60.0) * 0.45);
  // light rim, like the glow round the edge in the design
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  col = mix(col, uC, rim * 0.4);

  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
  #include <colorspace_fragment>
}`;
