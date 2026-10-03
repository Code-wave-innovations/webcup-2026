uniform float uLongueur; varying vec3 vPos; varying vec3 vN; varying vec2 vUv;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN); float s=vUv.x*uLongueur;
  vec3 col=vec3(0.035,0.04,0.055)*(cielBase(normalize(vec3(N.x,abs(N.y)+0.3,N.z)))*0.6+max(dot(N,uSoleil),0.0)*couleurSoleil()*2.0);
  float dessus=smoothstep(0.35,0.8,N.y);
  float net=clamp(1.0-fwidth(s)*0.5,0.0,1.0);
  float balises=step(0.82,fract(s/2.4))*net;
  vec3 cb=mix(vec3(0.50,0.90,1.0),vec3(1.0,0.2,0.1),uAlerte);
  col+=cb*balises*(1.0-dessus)*smoothstep(-0.6,0.2,N.y)*(0.5+1.6*uNuit);
  // traffic: white headlights one way, red tail lights the other
  float voie=step(0.0,dot(N.xz,vec2(1.0,0.37)));
  float sens=voie*2.0-1.0;
  float c=fract(s/11.0-sens*uTemps*0.22+voie*0.37);
  float voiture=smoothstep(0.06,0.0,abs(c-0.5))*step(0.35,hash(vec3(floor(s/11.0-sens*uTemps*0.22+voie*0.37),voie,3.0)));
  col+=mix(vec3(1.0,0.16,0.08),vec3(1.0,0.92,0.80),voie)*voiture*dessus*net*(1.2+2.2*uNuit);
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
