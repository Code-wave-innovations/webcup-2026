// Cloud layer: drifts slowly, lit white by day, warm at the terminator, a silver lining towards the sun, dark at night
uniform sampler2D tRelief; uniform vec3 uSoleilE; uniform float uTemps; varying vec2 vUv; varying vec3 vN; varying vec3 vPosW;
const float DERIVE_NUAGES=0.00035;
void main(){ float n=texture2D(tRelief,vUv+vec2(uTemps*DERIVE_NUAGES,0.0)).a; float a=smoothstep(0.44,0.60,n);
  vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vPosW); float ndl=dot(N,uSoleilE);
  float jour=smoothstep(-0.12,0.22,ndl);
  vec3 c=mix(vec3(1.0,0.56,0.34),vec3(1.0,0.98,0.96),smoothstep(0.02,0.35,ndl));
  float avant=pow(max(dot(-V,uSoleilE),0.0),6.0);
  float lum=0.015+1.75*max(ndl,0.0)*jour+avant*0.6*jour;
  float bord=0.75+0.4*(1.0-max(dot(N,V),0.0));
  gl_FragColor=vec4(c*lum,clamp(a*bord*(0.38+0.52*jour),0.0,0.92)); }
