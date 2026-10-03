// Road decks swept from deckProfile: uv.x along the deck (× uLongueur = metres), uv.y tells the surfaces apart:
// 0..1 carriageway, < 0 or 1..1.5 sidewalks and parapets, 1.5..2.6 fascia (the light strip), > 2.6 girder underside.
uniform float uLongueur; varying vec3 vPos; varying vec3 vN; varying vec2 vUv;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN); float s=vUv.x*uLongueur; float v=vUv.y;
  float net=clamp(1.0-fwidth(s)*0.5,0.0,1.0);
  float chaussee=step(0.0,v)*step(v,1.0);
  float trottoir=step(v,0.0)+step(1.0,v)*step(v,1.5);
  float flanc=step(1.5,v)*step(v,2.6);
  float dessous=step(2.6,v);
  // materials: worn asphalt with a lighter wheel track, sidewalk slabs, pale concrete fascia, darker girder
  float grain=bruit(vec3(s*1.7,v*9.0,0.0))*0.5+bruit(vec3(s*0.21,v*2.0,4.0))*0.5;
  vec3 asphalte=vec3(0.030,0.033,0.042)*(0.8+0.4*grain);
  float traces=smoothstep(0.08,0.0,abs(fract(v*2.0)-0.3))+smoothstep(0.08,0.0,abs(fract(v*2.0)-0.7));
  asphalte*=1.0+0.25*traces*chaussee;
  float dalles=smoothstep(0.03,0.0,abs(fract(s/1.8)-0.5)-0.47)*net;
  vec3 beton=vec3(0.115,0.112,0.108)*(0.85+0.3*grain);
  vec3 alb=asphalte*chaussee+beton*(1.0-0.35*dalles)*trottoir+beton*1.25*flanc+beton*0.62*dessous;
  vec3 col=alb*(cielBase(normalize(vec3(N.x,abs(N.y)+0.3,N.z)))*0.62+max(dot(N,uSoleil),0.0)*couleurSoleil()*2.4+clairAstre(N)*1.4);
  // lane markings: a dashed centre line, solid edge lines
  float dashed=step(0.6,fract(s/4.5))*net;
  float marquage=smoothstep(0.012,0.004,abs(v-0.5))*dashed+smoothstep(0.012,0.004,abs(v-0.06))+smoothstep(0.012,0.004,abs(v-0.94));
  col+=vec3(0.80,0.80,0.74)*marquage*chaussee*net*(0.35+0.4*max(dot(N,uSoleil),0.0)+0.25*uNuit);
  // the light strip along the fascia: a thin continuous line of ice LEDs (red under alert), brighter at night
  vec3 led=mix(vec3(0.45,0.88,1.0),vec3(1.0,0.2,0.1),uAlerte);
  float bande=smoothstep(0.035,0.0,abs(v-2.12))*flanc;
  float points=0.65+0.35*step(0.5,fract(s/0.9));
  col+=led*bande*points*net*(0.25+2.2*uNuit);
  // the strip's glow washing the fascia below it
  col+=led*smoothstep(0.45,0.0,v-2.12)*step(2.12,v)*flanc*uNuit*0.18;
  // traffic seen from afar: white headlights one way, red tail lights the other
  float voie=step(0.5,v);
  float sens=voie*2.0-1.0;
  float c=fract(s/11.0-sens*uTemps*0.22+voie*0.37);
  float voiture=smoothstep(0.05,0.0,abs(c-0.5))*step(0.35,hash(vec3(floor(s/11.0-sens*uTemps*0.22+voie*0.37),voie,3.0)));
  col+=mix(vec3(1.0,0.16,0.08),vec3(1.0,0.92,0.80),voie)*voiture*chaussee*net*smoothstep(0.1,0.4,abs(v-0.5))*(0.4+1.8*uNuit);
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
