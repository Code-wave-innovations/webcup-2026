// Golden dust around the camera: particles drift in a box that wraps around the viewer (always near, never
// running out), glinting when backlit by the low sun.
attribute float aGraine; uniform float uTemps; uniform vec3 uSoleil; uniform float uNuit; uniform float uEchelle;
varying float vA;
const vec3 BOITE=vec3(30.0,14.0,30.0);
void main(){
  vec3 p=position*BOITE+vec3(sin(uTemps*0.11+aGraine*21.0)*1.6+uTemps*0.18,sin(uTemps*0.07+aGraine*9.0)*1.0+uTemps*0.05,uTemps*0.32);
  vec3 rel=mod(p-cameraPosition+BOITE*0.5,BOITE)-BOITE*0.5;
  vec4 mv=viewMatrix*vec4(cameraPosition+rel,1.0);
  float d=max(-mv.z,0.01);
  float contre=pow(max(dot(normalize(rel),normalize(uSoleil+vec3(0.0,0.05,0.0))),0.0),4.0);
  float scintille=0.6+0.4*sin(uTemps*(1.5+aGraine*3.0)+aGraine*50.0);
  vA=(0.18+2.2*contre)*scintille*(1.0-0.8*uNuit)*smoothstep(0.8,3.0,d)*(1.0-smoothstep(9.0,14.0,length(rel)));
  gl_PointSize=uEchelle*(0.022+0.02*fract(aGraine*7.0))/d;
  gl_Position=projectionMatrix*mv; }
