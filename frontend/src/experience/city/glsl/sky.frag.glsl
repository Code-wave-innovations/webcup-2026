uniform sampler2D tSol; uniform sampler2D tTexte; uniform vec3 uPlaneteDir; uniform float uPlaneteRayon; uniform vec3 uLuneDir; uniform vec4 uTexte; uniform float uTexteForce;
varying vec3 vDir;
float etoiles(vec3 rd){ vec3 p=rd*190.0; vec3 i=floor(p); vec3 f=fract(p)-0.5; float h=hash(i);
  vec3 o=(vec3(hash(i+1.3),hash(i+2.7),hash(i+5.1))-0.5)*0.6; float d=length(f-o);
  return step(0.975,h)*smoothstep(0.11,0.0,d)*(0.35+0.65*fract(h*91.0)); }
// a body in the sky: returns its normal (xyz) and its mask (w)
vec4 disque(vec3 rd,vec3 dir,float rayon){
  if(dot(rd,dir)<cos(rayon)) return vec4(0.0);
  vec3 ex=normalize(cross(vec3(0.0,1.0,0.0),dir)); vec3 ey=cross(dir,ex);
  vec2 q=vec2(dot(rd,ex),dot(rd,ey))/sin(rayon); float r2=dot(q,q); if(r2>=1.0) return vec4(0.0);
  return vec4(normalize(q.x*ex+q.y*ey-sqrt(1.0-r2)*dir),smoothstep(1.0,0.94,r2)); }
void main(){ vec3 rd=normalize(vDir);
  if(rd.y<0.0){ gl_FragColor=vec4(cielBase(normalize(vec3(rd.x,0.0,rd.z))),1.0); return; }
  vec3 col=cielBase(rd);
  float sombre=smoothstep(0.30,0.95,uHeure); float libre=1.0;
  // giant planet: the same relief as the planet seen from space, veiled by the evening air
  vec4 pl=disque(rd,uPlaneteDir,uPlaneteRayon);
  float a=0.9+uTemps*0.002; vec3 nt=vec3(pl.x*cos(a)-pl.z*sin(a),pl.y,pl.x*sin(a)+pl.z*cos(a));
  vec2 puv=vec2(atan(nt.z,-nt.x)/6.28318530718+0.5,1.0-acos(clamp(nt.y,-1.0,1.0))/3.14159265359);
  vec3 alb=texture2D(tSol,puv).rgb*vec3(1.0,0.72,0.66);
  float ndl=dot(pl.xyz,uSoleil); float jp=smoothstep(-0.10,0.28,ndl);
  vec3 pc=alb*max(ndl,0.0)*vec3(2.3,1.42,1.08)*jp;
  float limbe=pow(1.0-max(-dot(pl.xyz,uPlaneteDir),0.0),3.0);
  pc+=vec3(1.0,0.50,0.36)*limbe*0.30*jp;
  col=mix(col,col*mix(0.52,0.30,sombre)+alb*vec3(0.035,0.03,0.05)+pc*mix(0.80,1.0,sombre),pl.w); libre*=1.0-pl.w;
  vec4 lu=disque(rd,uLuneDir,0.026);
  float gl=bruit(lu.xyz*6.0)*0.6+bruit(lu.xyz*17.0)*0.4;
  col=mix(col,col*mix(0.92,0.5,sombre)+vec3(0.86,0.78,0.74)*(0.55+0.6*gl)*max(dot(lu.xyz,uSoleil)+0.10,0.0)*(0.9+0.5*sombre),lu.w); libre*=1.0-lu.w;
  col+=vec3(0.86,0.90,1.0)*etoiles(rd)*sombre*libre*smoothstep(0.03,0.30,rd.y)*1.6;
  // the city's name: giant letters far behind the towers, backlit at dusk, glowing at night
  vec2 tuv=vec2((atan(rd.x,-rd.z)-uTexte.x)/uTexte.z+0.5,(asin(rd.y)-uTexte.y)/uTexte.w+0.5);
  float ta=texture2D(tTexte,clamp(tuv,0.0,1.0)).a*step(0.0,tuv.x)*step(tuv.x,1.0)*step(0.0,tuv.y)*step(tuv.y,1.0)*uTexteForce;
  vec3 lettres=col*0.50+vec3(0.030,0.022,0.035)+vec3(0.26,0.52,0.74)*(0.45+0.55*tuv.y)*(0.86+0.14*sin(tuv.y*520.0))*uNuit;
  col=mix(col,lettres,ta*mix(0.86,0.70,uNuit));
  // high-altitude veils, lit from below on the sun side
  vec2 pq=rd.xz/(rd.y+0.11);
  float nu=fbm4(vec3(pq*0.85+vec2(uTemps*0.004,0.0),4.0)+fbm4(vec3(pq*2.1,9.0))*0.5);
  float dens=smoothstep(0.62,1.05,nu)*smoothstep(0.015,0.14,rd.y)*smoothstep(0.85,0.30,rd.y);
  float vs=pow(max(dot(normalize(rd.xz),normalize(uSoleil.xz)),0.0),1.6);
  vec3 cn=mix(vec3(0.20,0.15,0.24),vec3(1.5,0.60,0.30),vs)*(1.0-0.88*uHeure)+vec3(0.02,0.022,0.045);
  col=mix(col,cn,dens*0.72);
  col+=vec3(9.0,4.8,1.9)*smoothstep(0.99990,0.99996,dot(rd,uSoleil));
  gl_FragColor=vec4(col,1.0); }
