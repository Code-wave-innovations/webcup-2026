varying vec3 vN; varying vec3 vV; varying vec3 vO;
void main(){ vO=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vV=mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }
