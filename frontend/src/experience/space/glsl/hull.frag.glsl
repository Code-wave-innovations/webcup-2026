// Cockpit metal: dark brushed steel catching the sun, the planet, the screens and the entry plasma
uniform vec3 uSoleilVue; uniform vec3 uPlaneteVue; uniform float uEcrans; uniform vec3 uBase; uniform float uPlasma; uniform float uBrillant;
varying vec3 vN; varying vec3 vV; varying vec3 vO;
void main(){ vec3 N=normalize(vN); vec3 V=normalize(-vV); if(dot(N,V)<0.0) N=-N; vec3 R=reflect(-V,N);
  float gr=bruit(vO*vec3(46.0,46.0,9.0))*0.6+bruit(vO*150.0)*0.4; float rug=0.5+0.5*gr;
  vec3 env=vec3(0.003,0.005,0.010);
  env+=vec3(1.0,0.68,0.42)*pow(max(dot(R,uSoleilVue),0.0),mix(26.0,140.0,rug))*2.6*(0.25+0.75*rug)*uBrillant;
  env+=vec3(0.62,0.27,0.15)*smoothstep(0.55,1.0,dot(R,uPlaneteVue))*0.16;
  env+=vec3(0.10,0.52,0.72)*smoothstep(0.1,1.0,-R.y)*0.07*uEcrans;
  env+=vec3(1.0,0.42,0.14)*uPlasma*smoothstep(-0.2,1.0,-R.z)*1.6;
  float fres=0.10+0.90*pow(1.0-max(dot(N,V),0.0),3.0);
  float dif=max(dot(N,uSoleilVue),0.0);
  vec3 col=uBase*(0.04+dif*vec3(1.0,0.72,0.5)*1.2+vec3(0.05,0.26,0.36)*max(-N.y,0.0)*0.25*uEcrans+vec3(1.0,0.4,0.15)*uPlasma*0.5)+env*fres;
  gl_FragColor=vec4(col,1.0); }
