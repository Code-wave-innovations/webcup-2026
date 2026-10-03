uniform float uTint; uniform float uEmis; varying vec3 vPos; varying vec3 vN;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN);
  // base colour from tint hue (0=green/grass, 0.12=sand, 0.6=warm wood, 0.33=stone)
  vec3 base;
  if(uTint<0.05) base=vec3(0.10,0.32,0.08); // grass green
  else if(uTint<0.15) base=vec3(0.40,0.32,0.18); // sand
  else if(uTint<0.35) base=vec3(0.22,0.24,0.28); // stone/concrete
  else if(uTint<0.55) base=vec3(0.36,0.22,0.12); // warm wood
  else if(uTint<0.75) base=vec3(0.55,0.15,0.10); // terracotta
  else base=vec3(0.12,0.14,0.18); // dark metal
  float ndl=max(dot(N,uSoleil),0.0);
  vec3 amb=cielBase(normalize(vec3(N.x*0.6,abs(N.y)+0.25,N.z*0.6)))*0.22+vec3(0.01,0.012,0.02);
  vec3 col=base*(ndl*couleurSoleil()*2.8+amb);
  // emissive for floodlights/flags at night
  vec3 ice=mix(vec3(0.50,0.90,1.0),vec3(1.0,0.2,0.1),uAlerte);
  col+=ice*uEmis*uNuit*1.8;
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0);
}
