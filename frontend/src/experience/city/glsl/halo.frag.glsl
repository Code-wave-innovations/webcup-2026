// Holographic ring of the Observatory: dashes running around it, brighter at night.
uniform float uTemps; uniform float uNuit; uniform float uAlerte; varying vec2 vUv;
void main(){
  float tirets=step(0.45,fract(vUv.x*48.0-uTemps*0.6));
  float bord=smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.65,vUv.y);
  vec3 c=mix(vec3(0.45,0.9,1.0),vec3(1.0,0.2,0.12),uAlerte);
  gl_FragColor=vec4(c*bord*(0.25+0.75*tirets)*(0.5+1.6*uNuit),1.0); }
