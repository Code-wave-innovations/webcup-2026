// point lights: tower beacons (blinking, aPhase >= 0) and shuttles (steady, aPhase < 0)
attribute float aTaille; attribute float aPhase; attribute vec3 aCouleur; uniform float uTemps; uniform float uEchelle; uniform float uNuit; varying vec3 vC; varying float vA;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
  float cl=aPhase<0.0?1.0:smoothstep(0.55,1.0,sin(uTemps*2.2+aPhase*6.2832));
  gl_PointSize=clamp(aTaille*uEchelle/max(-mv.z,1.0),1.5,64.0); vC=aCouleur; vA=cl*(0.45+0.55*uNuit); }
