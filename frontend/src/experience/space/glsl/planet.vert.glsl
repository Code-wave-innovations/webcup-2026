varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vPosW;
void main(){ vUv=uv; vec3 n=normalize(position); vec3 e=normalize(vec3(n.z,0.0,-n.x)+vec3(1e-5,0.0,0.0)); mat3 m=mat3(modelMatrix);
  vN=normalize(m*n); vE=normalize(m*e); vNo=normalize(m*cross(n,e)); vec4 w=modelMatrix*vec4(position,1.0); vPosW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }
