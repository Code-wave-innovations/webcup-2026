// Canopy glass: dust and streaks that only show when looking towards the sun
uniform vec3 uSoleilVue; uniform float uEcrans; uniform float uPlasma; uniform float uTemps; varying vec2 vUv; varying vec3 vV;
void main(){ vec3 D=normalize(vV); float vers=pow(max(dot(D,uSoleilVue),0.0),40.0);
  vec2 c=floor(vUv*vec2(900.0,420.0)); float grain=step(0.988,hash(vec3(c,1.0)));
  vec3 col=vec3(1.0,0.82,0.62)*grain*vers*0.5;
  col+=vec3(1.0,0.75,0.5)*vers*0.03;
  col+=vec3(0.10,0.50,0.70)*smoothstep(0.30,0.0,vUv.y)*0.035*uEcrans;
  gl_FragColor=vec4(col,1.0); }
