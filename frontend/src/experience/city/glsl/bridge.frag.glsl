// The cable-stayed bridge's structure (with tower.vert): uMat 0 = pale concrete (pylon, piers), 1 = painted steel
// (railings, lamp posts), 2 = stay cables (steel, with an LED line that lights up at night and pulses upwards).
uniform float uMat; uniform float uHautPylone; varying vec3 vPos; varying vec3 vN; varying vec3 vL; varying float vG;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN);
  vec3 V=normalize(cameraPosition-vPos);
  float grain=bruit(vPos*vec3(2.2,0.6,2.2))*0.6+bruit(vPos*9.0)*0.4;
  vec3 alb; float brillance; float spec;
  if(uMat<0.5){
    // concrete: warm off-white, rain streaks, darker and wet near the water line
    alb=vec3(0.44,0.42,0.39)*(0.82+0.3*grain);
    alb*=0.9+0.1*smoothstep(0.3,0.7,bruit(vec3(vPos.x*3.0,vPos.y*0.25,vPos.z*3.0)));
    alb*=mix(0.45,1.0,smoothstep(-0.2,1.6,vPos.y));
    brillance=12.0; spec=0.06;
  } else if(uMat<1.5){
    alb=vec3(0.16,0.17,0.19)*(0.9+0.2*grain); brillance=40.0; spec=0.35;
  } else {
    alb=vec3(0.10,0.105,0.11); brillance=60.0; spec=0.55;
  }
  float ndl=max(dot(N,uSoleil),0.0);
  vec3 H=normalize(uSoleil+V);
  vec3 amb=cielBase(normalize(vec3(N.x*0.6,abs(N.y)+0.25,N.z*0.6)))*0.42+vec3(0.010,0.012,0.022);
  vec3 col=alb*(ndl*couleurSoleil()*2.7+amb+clairAstre(N)*1.6);
  col+=couleurSoleil()*pow(max(dot(N,H),0.0),brillance)*spec*2.0*step(0.0,uSoleil.y);
  // sky reflection on steel
  col+=cielBase(reflect(-V,N))*spec*0.18*(1.0-step(1.5,uMat)*0.5);
  vec3 led=mix(vec3(0.45,0.88,1.0),vec3(1.0,0.2,0.1),uAlerte);
  if(uMat<0.5){
    // floodlit from its base at night, warm, fading up the pylon; a cool LED crown at the top
    float haut=clamp(vPos.y/max(uHautPylone,1.0),0.0,1.0);
    col+=vec3(1.0,0.78,0.55)*alb*uNuit*(1.05*exp(-haut*2.8)+0.12);
    col+=led*smoothstep(0.985,1.0,haut)*uNuit*1.4*step(vPos.y,uHautPylone*1.02);
  } else if(uMat>1.5){
    // vL.y runs along the cable from its deck anchor
    float pouls=smoothstep(0.82,1.0,fract(vL.y*0.035-uTemps*0.32+vG*3.0));
    col+=led*uNuit*(0.32+1.1*pouls);
  }
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
