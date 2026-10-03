varying vec3 vPos;
void main(){ vec4 w=modelMatrix*vec4(position,1.0); vPos=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }
