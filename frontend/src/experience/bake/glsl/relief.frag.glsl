// Pass 2: relief slope (rg), city lights (b), clouds (alpha)
varying vec2 vUv;
// city lights seen from orbit: a dense core, suburbs in clusters, lit roads as filaments, sparse grain at the edge
float ville(vec3 p,vec3 c,float taille){
  float d=acos(clamp(dot(p,c),-1.0,1.0))/taille; if(d>2.4) return 0.0;
  float dens=exp(-d*d*1.5);
  float amas=smoothstep(0.42,0.78,fbm(p*55.0+c*13.0));
  float routes=(1.0-smoothstep(0.0,0.045,abs(bruit(p*36.0+c*5.0)*2.0-1.0)))*smoothstep(2.2,0.5,d);
  float grains=0.25+0.75*step(0.52,bruit(p*320.0));
  float coeur=exp(-d*d*22.0);
  return clamp((dens*(0.75*amas+0.25)+routes*0.45)*grains*(0.35+0.65*dens)+coeur*0.8,0.0,1.0); }
void main(){ vec3 p=direction(vUv); float phi=vUv.x*6.28318530718;
  vec3 e=vec3(sin(phi),0.0,cos(phi)); vec3 no=cross(p,e); float eps=0.0035;
  float h0=hauteur(p); float he=hauteur(normalize(p+e*eps)); float hn=hauteur(normalize(p+no*eps));
  vec2 g=vec2(he-h0,hn-h0)/eps;
  float v=ville(p,normalize(vec3(0.50,0.20,0.84)),0.13);
  v=max(v,ville(p,normalize(vec3(-0.80,-0.12,0.58)),0.07)*0.8);
  v=max(v,ville(p,normalize(vec3(-0.30,0.45,-0.84)),0.09)*0.9);
  v=max(v,ville(p,normalize(vec3(0.85,-0.30,-0.42)),0.06)*0.8);
  // clouds: swirled fbm in loose latitude bands
  vec3 w=vec3(fbm3(p*3.1+1.3),fbm3(p*3.1+8.7),fbm3(p*3.1+4.1))-0.5;
  float bandes=0.82+0.28*sin(p.y*7.5+fbm3(p*2.2)*4.0);
  float nu=fbm(p*vec3(2.4,3.4,2.4)+w*2.2+7.0)*bandes;
  // finer billows and streaks so the edges read as clouds, not haze
  nu+=(fbm(p*vec3(9.0,13.0,9.0)+w*4.0+2.0)-0.5)*0.42;
  gl_FragColor=vec4(clamp(0.5+g/14.0,0.0,1.0),v,nu); }
