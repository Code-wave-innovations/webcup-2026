attribute float aGraine; varying vec3 vPos; varying vec3 vN; varying vec3 vL; varying float vG;
void main(){
  #ifdef USE_INSTANCING
    mat4 M=modelMatrix*instanceMatrix; float sx=length(instanceMatrix[0].xyz); float sy=length(instanceMatrix[1].xyz);
  #else
    mat4 M=modelMatrix; float sx=length(modelMatrix[0].xyz); float sy=length(modelMatrix[1].xyz);
  #endif
  vec4 w=M*vec4(position,1.0); vPos=w.xyz; vN=normalize(mat3(M)*(normal/vec3(sx,sy,sx)));
  vL=position*vec3(sx,sy,sx); vG=aGraine; gl_Position=projectionMatrix*viewMatrix*w; }
