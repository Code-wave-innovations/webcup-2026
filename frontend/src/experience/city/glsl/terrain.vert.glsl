attribute float aHorizon; varying vec3 vPos; varying vec3 vN; varying float vHor;
void main(){ vec4 w=modelMatrix*vec4(position,1.0); vPos=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vHor=aHorizon; gl_Position=projectionMatrix*viewMatrix*w; }
