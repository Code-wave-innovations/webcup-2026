varying vec3 vPos; varying vec3 vN; varying float vG; varying float vH;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN);
  // greens of the terraces, a few amber crowns; darker towards the base (self shade)
  vec3 alb=mix(vec3(0.06,0.14,0.05),vec3(0.10,0.19,0.07),fract(vG*13.0));
  alb=mix(alb,vec3(0.16,0.09,0.03),step(0.86,fract(vG*5.7)));
  alb*=0.55+0.6*vH;
  float haut=smoothstep(uOmbreY-3.0,uOmbreY+3.0,vPos.y);
  float ndl=max(dot(N,uSoleil)*0.75+0.25,0.0);
  vec3 col=alb*(cielBase(normalize(vec3(N.x,abs(N.y)+0.3,N.z)))*0.65+ndl*haut*couleurSoleil()*2.4+clairAstre(N)*2.2);
  // bioluminescent tips at night
  col+=vec3(0.30,1.0,0.78)*step(0.82,bruit(vec3(vPos*4.0+vG*11.0)))*uNuit*0.35*vH;
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
