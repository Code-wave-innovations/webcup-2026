// Trees, instanced, one unit tall at the origin: the crowns sway in the wind, each at its own rhythm, the top more than the base; trunks stay put.
attribute float aGraine; attribute float aBois; attribute float aOcc; uniform float uTemps;
varying vec3 vPos; varying vec3 vN; varying float vG; varying float vH; varying float vBois; varying float vOcc;
void main(){
  mat4 M=modelMatrix*instanceMatrix;
  vec4 w=M*vec4(position,1.0);
  float haut=position.y;
  float souple=(1.0-aBois)*haut*haut+aBois*haut*haut*0.25;
  float taille=length(instanceMatrix[1].xyz);
  float vent=sin(uTemps*1.3+aGraine*40.0+w.x*0.2)*0.035+sin(uTemps*2.9+aGraine*17.0+position.x*9.0)*0.012;
  w.x+=vent*souple*taille; w.z+=vent*0.6*souple*taille;
  vPos=w.xyz; vN=normalize(mat3(M)*normal); vG=aGraine; vH=haut; vBois=aBois; vOcc=aOcc;
  gl_Position=projectionMatrix*viewMatrix*w; }
