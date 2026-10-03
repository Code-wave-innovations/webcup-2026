attribute float taille; attribute float phase; uniform float uTemps; uniform float uDpr; varying float vA; varying float vT;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; float sc=0.75+0.25*sin(uTemps*(0.5+phase)+phase*40.0); gl_PointSize=taille*uDpr*sc; vA=0.5+0.5*sc; vT=phase; }
