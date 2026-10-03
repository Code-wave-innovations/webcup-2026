// Shared by every surface material: sun, time of day, alert, haze. Needs valueNoise.glsl before it.
uniform vec3 uSoleil; uniform vec3 uAstre; uniform float uHeure; uniform float uNuit; uniform float uTemps; uniform float uAlerte; uniform float uBrume; uniform float uCoupe; uniform float uOmbreY;
vec3 clairAstre(vec3 N){ return vec3(0.060,0.085,0.170)*uNuit*(0.25+0.75*max(dot(N,uAstre),0.0)); }
float fbm4(vec3 p){ float a=0.5; float s=0.0; for(int i=0;i<4;i++){ s+=a*bruit(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
// sun colour: it reddens and fades as it sets
vec3 couleurSoleil(){ float e=smoothstep(-0.035,0.13,uSoleil.y); return mix(vec3(1.0,0.26,0.08),vec3(1.0,0.60,0.32),e)*e*0.7; }
// sky gradient: warm towards the sun, cold opposite, dark at the zenith
vec3 cielBase(vec3 rd){
  float y=clamp(rd.y,0.0,1.0); float s=max(dot(rd,uSoleil),0.0);
  float az=max(dot(normalize(rd.xz+vec2(1e-5)),normalize(uSoleil.xz)),0.0);
  vec3 zen=mix(vec3(0.050,0.095,0.270),vec3(0.006,0.010,0.030),uHeure);
  vec3 mil=mix(vec3(0.33,0.225,0.34),vec3(0.030,0.032,0.090),uHeure);
  vec3 chaud=mix(vec3(1.02,0.47,0.19),vec3(0.36,0.13,0.09),uHeure);
  vec3 froid=mix(vec3(0.36,0.26,0.34),vec3(0.028,0.032,0.085),uHeure);
  vec3 hor=mix(froid,chaud,pow(az,2.4));
  vec3 col=mix(hor,mil,smoothstep(0.0,0.20,y));
  col=mix(col,zen,smoothstep(0.09,0.62,y));
  float lueur=1.0-0.78*uHeure;
  col+=vec3(1.5,0.58,0.20)*pow(s,10.0)*0.17*lueur;
  col+=vec3(1.8,1.0,0.5)*pow(s,110.0)*0.5*lueur*smoothstep(-0.07,0.02,uSoleil.y);
  return col; }
// height fog: dense in the valleys, tinted by the sky in the viewing direction
vec3 brume(vec3 col,vec3 ro,vec3 p){
  vec3 d=p-ro; float L=length(d); vec3 rd=d/L; float k=0.035; float a=rd.y*k;
  float integ=abs(a)<1e-4?L:(1.0-exp(-a*L))/a;
  float od=uBrume*exp(-max(ro.y,0.0)*k)*integ;
  vec3 fc=cielBase(normalize(vec3(rd.x,0.035,rd.z)))*0.82;
  return mix(col,fc,clamp(1.0-exp(-od),0.0,1.0)); }
