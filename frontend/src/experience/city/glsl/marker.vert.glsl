// District marker: a billboard turning to the camera around the vertical (its thread hangs straight down),
// keeping a readable size whatever the distance.
uniform vec3 uCentre; uniform float uActif; varying vec2 vUv;
void main(){
  vUv=uv;
  vec3 droite=normalize(vec3(viewMatrix[0][0],0.0,viewMatrix[2][0]));
  float d=distance(cameraPosition,uCentre);
  float s=clamp(d*0.045,1.1,6.5)*(1.0+0.3*uActif);
  vec3 w=uCentre+droite*position.x*s+vec3(0.0,position.y*s,0.0);
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0); }
