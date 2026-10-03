// Birds: sunlit backs and paler bellies, dark primaries, and thin feathers glowing when the low sun is behind them.
uniform vec3 uDessus; uniform vec3 uDessous; uniform vec3 uPointes; uniform float uPointesDes; uniform vec3 uTete; uniform vec3 uQueue;
varying vec3 vPos; varying vec3 vN; varying vec3 vPartie; varying float vDos;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 V=normalize(cameraPosition-vPos);
  vec3 N=normalize(vN);
  float aile=1.0-step(0.5,abs(vPartie.x-1.0));
  float queue=1.0-step(0.5,abs(vPartie.x-2.0));
  float tete=step(2.5,vPartie.x);
  float face=dot(N,V);
  // wings and tail show their upper or under side, the body its back or belly
  float dessus=mix(smoothstep(-0.35,0.35,vDos),step(0.0,face),aile+queue);
  vec3 alb=mix(uDessous,uDessus,dessus);
  alb=mix(alb,uPointes,aile*smoothstep(uPointesDes-0.03,uPointesDes+0.03,vPartie.y));
  alb*=1.0-0.3*aile*smoothstep(0.72,1.0,vPartie.z);
  alb=mix(alb,uQueue,queue);
  alb=mix(alb,uTete,tete);
  N*=face<0.0?-1.0:1.0;
  float soleil=smoothstep(uOmbreY-3.0,uOmbreY+3.0,vPos.y);
  float ndl=max(dot(N,uSoleil),0.0);
  vec3 ciel=cielBase(normalize(vec3(N.x,abs(N.y)+0.25,N.z)))*(0.45+0.25*N.y);
  vec3 col=alb*(ciel+ndl*soleil*couleurSoleil()*2.3+clairAstre(N)*2.0);
  float contre=pow(max(dot(-V,uSoleil),0.0),4.0)*(1.0-ndl)*soleil;
  col+=couleurSoleil()*(alb*1.4+vec3(0.06,0.025,0.01))*contre*(aile+queue*0.7+0.1)*1.4;
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
