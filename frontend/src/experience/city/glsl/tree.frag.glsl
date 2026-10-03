varying vec3 vPos; varying vec3 vN; varying float vG; varying float vH; varying float vBois; varying float vOcc;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN);
  // leaves: several greens, a few olive and amber crowns; clustered leaf noise; bark below
  vec3 feuille=mix(vec3(0.045,0.105,0.035),vec3(0.085,0.165,0.05),fract(vG*13.0));
  feuille=mix(feuille,vec3(0.12,0.14,0.045),step(0.78,fract(vG*7.3)));
  feuille=mix(feuille,vec3(0.17,0.085,0.025),step(0.93,fract(vG*5.7)));
  float amas=bruit(vPos*5.5+vG*31.0)*0.6+bruit(vPos*13.0)*0.4;
  feuille*=0.7+0.6*amas;
  vec3 ecorce=vec3(0.075,0.052,0.036)*(0.75+0.5*bruit(vec3(vPos.x*20.0,vPos.y*3.0,vPos.z*20.0)));
  vec3 alb=mix(feuille,ecorce,vBois);
  float occ=vOcc*(0.6+0.4*amas);
  // the city's long shadow at sunset (below uOmbreY the sun is behind the mountains)
  float haut=smoothstep(uOmbreY-3.0,uOmbreY+3.0,vPos.y);
  float ndl=max(dot(N,uSoleil)*0.7+0.3,0.0);
  // sunlight through the leaves, seen against the sun
  vec3 V=normalize(cameraPosition-vPos);
  float trans=pow(max(dot(-V,uSoleil),0.0),3.0)*(1.0-vBois)*(0.4+0.6*(1.0-occ));
  vec3 col=alb*(cielBase(normalize(vec3(N.x,abs(N.y)+0.3,N.z)))*0.6*occ+ndl*haut*couleurSoleil()*2.4*(0.35+0.65*occ)+clairAstre(N)*2.0*occ);
  col+=vec3(0.32,0.42,0.06)*couleurSoleil()*trans*haut*0.9;
  // bioluminescent tips at night
  col+=vec3(0.30,1.0,0.78)*step(0.84,bruit(vec3(vPos*4.0+vG*11.0)))*uNuit*0.3*vH*(1.0-vBois);
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
