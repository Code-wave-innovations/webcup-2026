attribute float taille; attribute float phase; uniform float uDpr; varying float vT; varying float vB;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=taille*uDpr; vT=phase; vB=clamp((taille-0.9)/2.5,0.0,1.0); }
