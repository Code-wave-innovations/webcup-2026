// Cloud deck crossed during the descent: three sheets of fbm cloud rushing up past the camera (it falls through
// them), growing as they come close, lit warm from above by the low sun. Needs valueNoise.glsl before it.
uniform float uProgress; uniform float uOpacity; uniform float uAspect; uniform vec3 uLit; uniform vec3 uShade;
varying vec2 vUv;

float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*bruit(p); p*=2.03; a*=0.5; } return s; }

void main(){
  vec2 q=(vUv-0.5)*vec2(uAspect,1.0);
  float alpha=0.0; vec3 col=vec3(0.0);
  for(int k=0;k<3;k++){
    float fk=float(k);
    // each sheet passes at its own moment: it arrives from below the frame, grows, and leaves through the top
    float local=clamp(uProgress*1.5-fk*0.25,0.0,1.0);
    float zoom=mix(1.6,0.35,local);
    vec2 p=q*zoom*2.4+vec2(fk*7.3,-local*3.2+fk*1.7);
    float d=fbm(vec3(p,fk*3.1+uProgress*0.6));
    float cover=smoothstep(0.42,0.72,d)*sin(local*3.14159);
    // tops lit by the sun, undersides in shade
    float light=clamp(0.5+(fbm(vec3(p+vec2(0.0,0.12),fk*3.1))-d)*4.0+q.y*0.6,0.0,1.0);
    vec3 c=mix(uShade,uLit,light);
    col=mix(col,c,cover*(1.0-alpha*0.5));
    alpha=alpha+cover*(1.0-alpha);
  }
  gl_FragColor=vec4(col,alpha*uOpacity);
}
