// light beam (report signal, alert spotlights): bright core, soft silhouette edges, fades with height
uniform vec3 uCouleur; uniform float uForce; varying vec2 vUv; varying vec3 vPos; varying vec3 vN;
void main(){ vec3 V=normalize(cameraPosition-vPos); float bord=pow(abs(dot(normalize(vN),V)),1.6); gl_FragColor=vec4(uCouleur*uForce*bord*pow(1.0-vUv.y,1.4),1.0); }
