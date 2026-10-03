// Film development: radial speed blur, lens fringing, halo, entry plasma, ACES-fit tone map, cold/warm grade,
// vignette, fade veil, display gamma and grain. Needs valueNoise.glsl before it.
uniform sampler2D tH1; uniform sampler2D tH2; uniform sampler2D tTrait;
uniform float uTemps; uniform float uExpo; uniform float uHalo; uniform float uVitesse; uniform float uPlasma; uniform float uVoile; uniform vec3 uVoileC; uniform float uGrain; uniform vec2 uCentre; uniform float uLdr;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 d=uv-0.5; float r2=dot(d,d);
  vec3 c;
  if(uVitesse>0.002){ vec2 dv=(uv-uCentre)*uVitesse*0.16; c=vec3(0.0); for(int i=0;i<8;i++){ c+=texture2D(inputBuffer,uv-dv*float(i)/7.0).rgb; } c/=8.0; }
  else { c.r=texture2D(inputBuffer,uv-d*r2*0.010).r; c.g=inputColor.g; c.b=texture2D(inputBuffer,uv+d*r2*0.010).b; }
  vec3 halo=texture2D(tH1,uv).rgb*0.36+texture2D(tH2,uv).rgb*0.52+texture2D(tTrait,uv).rgb*vec3(0.55,0.80,1.0)*0.34;
  c+=halo*uHalo;
  if(uPlasma>0.002){ float a=atan(d.y,d.x); float r=length(d)*1.6;
    float st=bruit(vec3(a*5.0,r*2.5-uTemps*7.0,uTemps*1.7))*0.6+bruit(vec3(a*13.0,r*6.0-uTemps*13.0,3.0))*0.4;
    float bord=smoothstep(0.30,1.05,r+st*0.45);
    c+=(vec3(2.6,0.72,0.14)*bord*(0.35+st*st*1.6)+vec3(1.0,0.38,0.12)*0.16)*uPlasma; }
  c*=uExpo;
  c=mix((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),c,uLdr);
  float l=dot(c,vec3(0.299,0.587,0.114));
  c=mix(c,c*vec3(0.90,1.02,1.12),(1.0-l)*0.40);
  c=mix(c,c*vec3(1.07,1.0,0.92),l*0.35);
  c*=1.0-r2*0.85;
  c=mix(c,uVoileC,uVoile);
  c=pow(max(c,0.0),vec3(1.0/2.2));
  c+=(hash(vec3(gl_FragCoord.xy,fract(uTemps)*91.0))-0.5)*uGrain;
  outputColor=vec4(c,1.0);
}
