uniform float uChaleur; varying vec3 vPos; varying vec3 vN; varying vec3 vL; varying float vG;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vPos); vec3 R=reflect(-V,N);
  vec3 l=normalize(vL); float u=atan(l.z,l.x)/6.28318530718; float v=acos(clamp(l.y,-1.0,1.0))/3.14159265359;
  vec2 g=vec2(u*30.0,v*18.0);
  float a1=abs(fract(g.y)-0.5); float a2=abs(fract(g.x+g.y*0.5)-0.5); float a3=abs(fract(g.x-g.y*0.5)-0.5);
  float w=0.445-fwidth(g.y)*0.9;
  float treillis=max(max(smoothstep(w,0.5,a1),smoothstep(w,0.5,a2)),smoothstep(w,0.5,a3));
  treillis*=clamp(1.0-fwidth(g.y)*2.2,0.0,1.0);
  float fres=0.06+0.94*pow(1.0-max(dot(N,V),0.0),3.5);
  vec3 refl=cielBase(normalize(vec3(R.x,abs(R.y)+0.02,R.z)));
  float haut=smoothstep(uOmbreY-3.0,uOmbreY+3.0,vPos.y);
  // the inside: a warm glow and district lights
  vec2 ci=floor(vec2(u*46.0,v*46.0)); float hi=hash(vec3(ci,vG*17.0));
  float interieur=smoothstep(0.20,0.50,v)*(0.35+0.65*step(0.55,hi));
  vec3 cInt=mix(vec3(1.0,0.74,0.44),vec3(0.55,1.0,0.75),uChaleur);
  cInt=mix(cInt,vec3(1.0,0.15,0.08),uAlerte);
  vec3 col=cInt*interieur*(0.20+1.15*uNuit)*(1.0-fres);
  col+=refl*fres*0.9;
  col+=couleurSoleil()*haut*pow(max(dot(R,uSoleil),0.0),240.0)*16.0;
  col=mix(col,vec3(0.03,0.035,0.05)+refl*0.25+couleurSoleil()*haut*max(dot(N,uSoleil),0.0)*0.5,treillis*0.85);
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
