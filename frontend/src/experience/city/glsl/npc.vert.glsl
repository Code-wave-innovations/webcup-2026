// City life, instanced: a local mesh (car / person / animal) planted at iPos, facing iDir, with a walk bob.
attribute vec4 iPos; attribute vec4 iDir; attribute vec4 iAnim;
varying vec3 vPos; varying vec3 vN; varying vec3 vLocal; varying float vGraine;
void main(){
  vec3 fw=normalize(iDir.xyz+vec3(0.0,0.0,1e-5));
  vec3 X=normalize(cross(vec3(0.0,1.0,0.0),fw));
  vec3 Y=cross(fw,X);
  float bob=sin(iAnim.x)*iAnim.y;
  vec3 p=position;
  p.y+=bob;
  vec3 w=iPos.xyz+(X*p.x+Y*p.y+fw*p.z)*iPos.w;
  vPos=w; vN=normalize(X*normal.x+Y*normal.y+fw*normal.z); vLocal=p; vGraine=iAnim.z;
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0);
}
