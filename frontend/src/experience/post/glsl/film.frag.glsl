// Film development: radial speed blur, lens fringing, halo, entry plasma, ACES-fit tone map, cold/warm grade,
// vignette, fade veil, display gamma and grain; rack focus (uMap) blurs all but a disc around uNet. Needs valueNoise.glsl before it.
uniform sampler2D tH1; uniform sampler2D tH2; uniform sampler2D tTrait;
uniform float uTemps; uniform float uExpo; uniform float uHalo; uniform float uVitesse; uniform float uPlasma; uniform float uVoile; uniform vec3 uVoileC; uniform float uGrain; uniform vec2 uCentre; uniform float uLdr; uniform float uMap; uniform vec3 uNet; uniform float uRayons; uniform vec2 uSoleilUv;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 d=uv-0.5; float r2=dot(d,d);
  vec3 c;
  if(uVitesse>0.002){ vec2 dv=(uv-uCentre)*uVitesse*0.16; c=vec3(0.0); for(int i=0;i<8;i++){ c+=texture2D(inputBuffer,uv-dv*float(i)/7.0).rgb; } c/=8.0; }
  else { c.r=texture2D(inputBuffer,uv-d*r2*0.010).r; c.g=inputColor.g; c.b=texture2D(inputBuffer,uv+d*r2*0.010).b; }
  if(uMap>0.002){
    // depth of field faked in screen space: the further from the subject, the wider the 12-tap disc
    vec2 q=(uv-uNet.xy)*vec2(resolution.x/resolution.y,1.0);
    float flou=uMap*smoothstep(uNet.z,uNet.z*2.4,length(q))*7.0;
    if(flou>0.05){ vec3 s=vec3(0.0);
      for(int i=0;i<12;i++){ float a=float(i)*2.39996; float rr=sqrt((float(i)+0.5)/12.0)*flou; s+=texture2D(inputBuffer,uv+vec2(cos(a),sin(a))*rr*texelSize).rgb; }
      c=mix(c,s/12.0,smoothstep(0.05,1.0,flou)); }
  }
  vec3 halo=texture2D(tH1,uv).rgb*0.36+texture2D(tH2,uv).rgb*0.52+texture2D(tTrait,uv).rgb*vec3(0.55,0.80,1.0)*0.34;
  c+=halo*uHalo;
  if(uRayons>0.002){
    // crepuscular rays: the blurred highlights smeared towards the sun (gaps in the mountains, between towers)
    // (dithered start: no visible steps)
    vec2 pas=(uSoleilUv-uv)/14.0; vec2 p=uv+pas*hash(vec3(gl_FragCoord.xy,uTemps)); float dec=1.0; vec3 acc=vec3(0.0);
    for(int i=0;i<14;i++){ p+=pas; acc+=texture2D(tH2,clamp(p,0.0,1.0)).rgb*dec; dec*=0.86; }
    c+=acc*(uRayons*0.035)*vec3(1.0,0.74,0.46);
  }
  if(uPlasma>0.002){ float a=atan(d.y,d.x); float r=length(d)*1.6;
    // noise around the circle (cos, sin), not on the angle itself: atan jumps from pi to -pi on the left ray
    vec2 ca=vec2(cos(a),sin(a));
    float st=bruit(vec3(ca*5.0,r*2.5-uTemps*7.0+uTemps*0.3))*0.6+bruit(vec3(ca*13.0+3.0,r*6.0-uTemps*13.0))*0.4;
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
