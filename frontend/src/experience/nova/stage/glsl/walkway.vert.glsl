// The walkway: a flat strip on Nova's floor, sized in Nova heights by uniforms (the mesh is a unit square)
uniform vec2 uHalf;
uniform float uCenter;
varying vec2 vFloor;

void main() {
  vec3 p = vec3(uCenter + position.x * 2.0 * uHalf.x, 0.0, position.z * 2.0 * uHalf.y);
  vFloor = p.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
