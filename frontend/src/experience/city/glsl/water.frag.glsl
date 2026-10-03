uniform sampler2D tReflet; uniform vec2 uResol; varying vec3 vPos;
float rides(vec2 p,float t){ return bruit(vec3(p*0.55+vec2(t,t*0.6),1.0))+0.5*bruit(vec3(p*1.7-vec2(t*1.3,t),5.0)); }
void main(){
  vec3 V=normalize(cameraPosition-vPos); float dist=length(cameraPosition-vPos);
  vec2 p=vPos.xz; float t=uTemps*0.35; float e=0.35;
  float n0=rides(p,t); vec2 g=vec2(rides(p+vec2(e,0.0),t)-n0,rides(p+vec2(0.0,e),t)-n0)/e;
  float att=1.0/(1.0+dist*0.010);
  vec3 N=normalize(vec3(-g.x*0.42*att,1.0,-g.y*0.42*att));
  float fres=0.03+0.97*pow(1.0-max(dot(N,V),0.0),5.0);
  vec2 suv=gl_FragCoord.xy/uResol;
  vec3 refl=texture2D(tReflet,vec2(suv.x,1.0-suv.y)+N.xz*vec2(0.05,0.14)).rgb;
  vec3 col=mix(vec3(0.010,0.018,0.026),refl,fres);
  vec3 R=reflect(-V,N);
  col+=couleurSoleil()*pow(max(dot(R,uSoleil),0.0),380.0)*7.0;
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
