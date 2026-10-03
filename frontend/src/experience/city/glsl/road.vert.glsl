varying vec3 vPos; varying vec3 vN; varying vec2 vUv;
void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vPos=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }
