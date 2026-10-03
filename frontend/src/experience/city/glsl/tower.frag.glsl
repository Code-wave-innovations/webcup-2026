varying vec3 vPos; varying vec3 vN; varying vec3 vL; varying float vG;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vPos); vec3 R=reflect(-V,N);
  float rad=max(length(vL.xz),0.2); float tour=atan(vL.z,vL.x)/6.28318530718+0.5;
  float nCol=floor(6.28318530718*rad/0.30)+5.0;
  vec2 gc=vec2(tour*nCol,vL.y/0.44); vec2 cel=floor(gc); vec2 f=fract(gc);
  float h=hash(vec3(cel,vG*91.7));
  float etage=hash(vec3(cel.y,vG*13.1,2.0));   // whole floors lit or dark
  float allume=step(0.64-0.13*uNuit,h*0.65+etage*0.35);
  float fen=smoothstep(0.16,0.26,f.x)*smoothstep(0.84,0.74,f.x)*smoothstep(0.22,0.36,f.y)*smoothstep(0.78,0.64,f.y);
  vec3 cf=mix(vec3(1.0,0.66,0.36),vec3(0.62,0.86,1.0),step(0.86,fract(h*7.3)));
  cf=mix(cf,vec3(1.0,0.16,0.10),uAlerte*(0.6+0.4*sin(uTemps*6.0+vG*20.0)));
  float puls=0.88+0.12*sin(uTemps*(0.5+h*1.6)+h*40.0);
  float net=1.0-smoothstep(0.16,0.42,max(fwidth(gc.x),fwidth(gc.y)));
  // far away, windows become blocks of light, then a glow: no shimmering
  vec2 gg=gc/vec2(3.0,4.0); vec2 fg=fract(gg); float hg=hash(vec3(floor(gg),vG*37.0));
  float pave=step(0.66-0.16*uNuit,hg)*smoothstep(0.08,0.2,fg.x)*smoothstep(0.92,0.8,fg.x)*smoothstep(0.10,0.24,fg.y)*smoothstep(0.90,0.76,fg.y)*(0.35+0.4*fract(hg*5.0));
  float net2=1.0-smoothstep(0.14,0.40,max(fwidth(gg.x),fwidth(gg.y)));
  float lum=mix(mix(0.035,pave,net2),fen*allume,net);
  vec3 emis=cf*lum*(0.50+1.35*uNuit)*puls;
  float corniche=step(0.94,fract(vL.y/6.4+vG*3.0));
  emis+=mix(vec3(0.50,0.88,1.0),vec3(1.0,0.2,0.12),uAlerte)*corniche*net*(0.35+0.9*uNuit);
  float fres=0.05+0.95*pow(1.0-max(dot(N,V),0.0),4.0);
  vec3 refl=cielBase(normalize(vec3(R.x,abs(R.y)+0.02,R.z)));
  float haut=smoothstep(uOmbreY-4.0,uOmbreY+4.0,vPos.y);
  float ndl=max(dot(N,uSoleil),0.0);
  vec3 base=vec3(0.040,0.050,0.072)*(1.0-0.5*step(0.94,fract(vL.y/6.4+vG*3.0+0.06)));
  vec3 col=base*(cielBase(normalize(vec3(N.x,abs(N.y)+0.3,N.z)))*0.55+ndl*haut*couleurSoleil()*2.6+clairAstre(N)*2.0);
  col+=refl*fres*0.42;
  col+=couleurSoleil()*haut*pow(max(dot(R,uSoleil),0.0),70.0)*3.0;
  col+=emis;
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
