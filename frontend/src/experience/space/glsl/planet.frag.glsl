// Planet seen from space: bump-lit ground, terminator glow, city lights on the night side, rim atmosphere
uniform sampler2D tSol; uniform sampler2D tRelief; uniform vec3 uSoleilE; uniform float uTemps; uniform float uAlerte;
varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vPosW;
void main(){ vec4 sol=texture2D(tSol,vUv); vec4 rel=texture2D(tRelief,vUv);
  vec3 N=normalize(vN); vec2 g=(rel.rg-0.5)*14.0;
  vec3 Nb=normalize(N-0.075*(g.x*normalize(vE)+g.y*normalize(vNo)));
  vec3 V=normalize(cameraPosition-vPosW);
  float ndl0=dot(N,uSoleilE); float ndl=dot(Nb,uSoleilE);
  float jour=smoothstep(-0.10,0.24,ndl0);
  vec3 alb=mix(sol.rgb,vec3(0.36,0.35,0.39),rel.b*0.5);
  vec3 col=alb*(max(ndl,0.0)*2.4*jour+0.006);
  col+=alb*vec3(1.0,0.42,0.18)*0.5*smoothstep(-0.02,0.20,ndl0)*(1.0-smoothstep(0.20,0.55,ndl0));
  float nuit=1.0-smoothstep(-0.16,0.06,ndl0);
  col+=alb*vec3(0.10,0.15,0.34)*0.05*nuit;
  float scint=0.82+0.18*sin(uTemps*2.3+vUv.x*900.0+vUv.y*700.0);
  vec3 cVille=mix(vec3(1.0,0.74,0.44),vec3(1.0,0.26,0.20),uAlerte);
  col+=cVille*rel.b*nuit*3.2*scint;
  float fres=pow(1.0-max(dot(N,V),0.0),3.0);
  vec3 cAtm=mix(vec3(0.30,0.46,1.0),vec3(1.0,0.60,0.34),smoothstep(-0.1,0.5,ndl0));
  col+=cAtm*fres*(0.10+1.5*smoothstep(-0.25,0.45,ndl0));
  gl_FragColor=vec4(col,1.0); }
