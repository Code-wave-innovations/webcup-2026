// Stylized silhouettes of the city: cars with night headlights, walkers in mixed clothes, animals in warm coats.
uniform float uKind;
varying vec3 vPos; varying vec3 vN; varying vec3 vLocal; varying float vGraine;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 V=normalize(cameraPosition-vPos);
  vec3 N=normalize(vN);
  if(dot(N,V)<0.0) N=-N;
  float g=vGraine;
  vec3 alb;
  vec3 emit=vec3(0.0);
  if(uKind<0.5){
    // vehicle: dark body, ice-glass cabin, headlights at the nose when night falls
    alb=mix(vec3(0.07,0.08,0.10),vec3(0.16,0.18,0.22),step(0.38,vLocal.y));
    alb=mix(alb,vec3(0.22,0.38,0.48),smoothstep(0.36,0.48,vLocal.y)*step(vLocal.z,-0.05));
    float nez=smoothstep(0.72,1.05,vLocal.z)*smoothstep(0.34,0.18,vLocal.y);
    float queue=smoothstep(-0.85,-1.05,vLocal.z);
    emit+=vec3(1.0,0.86,0.55)*nez*uNuit*2.4;
    emit+=vec3(0.95,0.12,0.08)*queue*uNuit*1.4;
  }else if(uKind<1.5){
    float teint=fract(g*17.3);
    vec3 peau=mix(vec3(0.36,0.22,0.16),vec3(0.82,0.62,0.48),teint);
    vec3 habit=mix(vec3(0.12,0.18,0.28),vec3(0.55,0.22,0.18),fract(g*9.1));
    habit=mix(habit,vec3(0.18,0.34,0.32),fract(g*4.7));
    alb=mix(habit,peau,smoothstep(1.05,1.22,vLocal.y));
    emit+=habit*uNuit*0.22;
  }else{
    alb=mix(vec3(0.28,0.18,0.10),vec3(0.55,0.38,0.20),fract(g*11.0));
  }
  float soleil=smoothstep(uOmbreY-3.0,uOmbreY+3.0,vPos.y);
  float ndl=max(dot(N,uSoleil),0.0);
  vec3 ciel=cielBase(normalize(vec3(N.x,abs(N.y)+0.25,N.z)))*(0.42+0.28*N.y);
  vec3 col=alb*(ciel+ndl*soleil*couleurSoleil()*2.1+clairAstre(N)*2.2)+emit;
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0);
}
