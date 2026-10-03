varying vec3 vPos; varying vec3 vN;
void main(){ if(vPos.y<uCoupe) discard; vec3 N=normalize(vN);
  vec3 col=vec3(0.035,0.04,0.055)*(cielBase(normalize(vec3(N.x,abs(N.y)+0.3,N.z)))*0.6+max(dot(N,uSoleil),0.0)*couleurSoleil()*2.0);
  col=brume(col,cameraPosition,vPos); gl_FragColor=vec4(col,1.0); }
