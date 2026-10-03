// Tree crowns, instanced: they sway in the wind, each at its own rhythm, the top more than the base.
attribute float aGraine; uniform float uTemps; varying vec3 vPos; varying vec3 vN; varying float vG; varying float vH;
void main(){
  mat4 M=modelMatrix*instanceMatrix;
  vec4 w=M*vec4(position,1.0);
  float haut=position.y+0.5;
  float vent=sin(uTemps*1.3+aGraine*40.0+w.x*0.2)*0.07+sin(uTemps*2.9+aGraine*17.0)*0.025;
  w.x+=vent*haut*length(instanceMatrix[1].xyz); w.z+=vent*0.6*haut*length(instanceMatrix[1].xyz);
  vPos=w.xyz; vN=normalize(mat3(M)*normal); vG=aGraine; vH=haut; gl_Position=projectionMatrix*viewMatrix*w; }
