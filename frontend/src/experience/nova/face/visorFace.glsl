// Nova's face, drawn as light on the visor (in the visor's UV space): two eyes that blink, look around and
// change shape with the emotion, a mouth that animates while speaking, thinking dots, a listening waveform.
uniform float uFaceTime;
uniform float uFaceAspect;
uniform vec3 uFaceColor;
uniform float uFacePower;
uniform vec2 uEyeOpen;
uniform vec2 uEyeLook;
uniform float uEyeScale;
uniform float uHappy;
uniform float uSad;
uniform float uAngry;
uniform float uMouthOpen;
uniform float uSmile;
uniform float uThinking;
uniform float uListening;
uniform float uVoice;

float faceRoundBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
float faceSegment(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a; vec2 ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
// arc of radius r around +y (an upside-down U: the happy "^" eye), half aperture `ang`
float faceArc(vec2 p, float r, float ang){
  float a=atan(p.x,p.y);
  if(abs(a)<ang) return abs(length(p)-r);
  vec2 e=vec2(sin(ang)*sign(p.x),cos(ang))*r;
  return length(p-e);
}
float faceFill(float d, float w){ return 1.0-smoothstep(-w,w,d); }

// side: -1 for the eye on the viewer's left, +1 on the right
float faceEye(vec2 p, float side, float open){
  vec2 q=p-uEyeLook*vec2(0.05,0.035);
  q/=mix(1.0,1.22,uEyeScale);
  // sad: inner corners raised (eyes tilt) and a sloping lid
  float tilt=-uSad*0.3*side;
  q=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*q;
  float h=max(0.092*open,0.008);
  float pill=faceRoundBox(q,vec2(0.046,h),0.046*min(1.0,h/0.046));
  pill=max(pill,q.y-mix(0.5,0.0,uSad));
  float happy=faceArc(q+vec2(0.0,0.03),0.062,1.05)-0.016;
  // "> <": each chevron points towards the middle of the face
  vec2 tip=vec2(-0.045*side,0.0);
  float chevron=min(faceSegment(q,vec2(0.04*side,0.06),tip),faceSegment(q,vec2(0.04*side,-0.06),tip))-0.016;
  float d=mix(pill,happy,uHappy);
  d=mix(d,chevron,uAngry);
  return faceFill(d,0.004);
}

float faceMouth(vec2 p){
  vec2 m=p-vec2(0.0,-0.2);
  // equaliser while speaking
  float bars=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i)-2.0;
    float n=0.45+0.55*sin(uFaceTime*(13.0+fi*3.7)+fi*1.9)*sin(uFaceTime*7.3+fi);
    float hh=0.008+uMouthOpen*0.05*abs(n)*(1.0-abs(fi)*0.18);
    bars=max(bars,faceFill(faceRoundBox(m-vec2(fi*0.034,0.0),vec2(0.011,hh),0.008),0.004));
  }
  bars*=step(0.02,uMouthOpen);
  // smile: a small U
  float smile=faceFill(faceArc(vec2(m.x,-m.y)-vec2(0.0,-0.035),0.05,0.95)-0.009,0.004)*uSmile*(1.0-step(0.02,uMouthOpen));
  // thinking: three dots orbiting
  float dots=0.0;
  for(int i=0;i<3;i++){
    float a=uFaceTime*3.2+float(i)*2.094;
    dots=max(dots,faceFill(length(m-vec2(cos(a)*0.055,sin(a)*0.022))-0.013,0.004));
  }
  dots*=uThinking;
  // listening: a waveform that answers the keystrokes
  float wave=0.0;
  if(uListening>0.01){
    float amp=0.008+uVoice*0.03;
    float y=sin(m.x*70.0+uFaceTime*9.0)*amp*smoothstep(0.13,0.0,abs(m.x));
    wave=faceFill(abs(m.y-y)-0.005,0.003)*step(abs(m.x),0.13)*uListening;
  }
  return max(max(bars,smile),max(dots,wave));
}

vec3 novaFace(vec2 uv){
  vec2 p=(uv-0.5)*vec2(uFaceAspect,1.0);
  float eyes=faceEye(p-vec2(-0.2,0.06),-1.0,uEyeOpen.x)+faceEye(p-vec2(0.2,0.06),1.0,uEyeOpen.y);
  float light=clamp(eyes+faceMouth(p),0.0,1.0);
  float scan=0.82+0.18*sin(uv.y*420.0);
  float glow=exp(-dot(p,p)*3.0)*0.04;
  return uFaceColor*(light*scan+glow)*uFacePower;
}
