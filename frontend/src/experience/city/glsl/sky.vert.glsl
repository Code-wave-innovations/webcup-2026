varying vec3 vDir;
void main(){ vDir=position; vec4 w=modelMatrix*vec4(position,1.0); gl_Position=projectionMatrix*viewMatrix*w; gl_Position.z=gl_Position.w*0.99999; }
