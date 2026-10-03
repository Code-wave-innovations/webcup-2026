// Planet seen from space: bump-lit land, seas with the sun's glint, cloud shadows, city lights on the night side,
// and the atmosphere scattering light over the disc (blue haze towards the limb, a warm band at the terminator)
uniform sampler2D tSol; uniform sampler2D tRelief; uniform vec3 uSoleilE; uniform float uTemps; uniform float uAlerte;
varying vec2 vUv; varying vec3 vN; varying vec3 vE; varying vec3 vNo; varying vec3 vPosW;
const float MER=0.37;
const float DERIVE_NUAGES=0.00035;
void main(){ vec4 sol=texture2D(tSol,vUv); vec4 rel=texture2D(tRelief,vUv);
  vec3 N=normalize(vN); vec3 E=normalize(vE); vec3 No=normalize(vNo); vec3 L=uSoleilE;
  vec3 V=normalize(cameraPosition-vPosW);
  float H=sol.a;
  float mer=1.0-smoothstep(MER-0.006,MER+0.004,H);
  float fond=smoothstep(MER-0.01,MER-0.16,H);
  vec2 g=(rel.rg-0.5)*14.0*(1.0-mer);
  vec3 Nb=normalize(N-0.075*(g.x*E+g.y*No));
  float ndl0=dot(N,L); float ndl=dot(Nb,L);
  float jour=smoothstep(-0.10,0.20,ndl0);
  // clouds drift over the ground: their shadow is the cloud layer seen from the sun
  vec2 versSoleil=vec2(dot(L,E)*0.5,dot(L,No))*(0.0045/max(ndl0,0.25));
  float ombre=smoothstep(0.44,0.60,texture2D(tRelief,vUv+vec2(uTemps*DERIVE_NUAGES,0.0)+versSoleil).a);
  float nuages=smoothstep(0.44,0.60,texture2D(tRelief,vUv+vec2(uTemps*DERIVE_NUAGES,0.0)).a);
  vec3 terre=mix(sol.rgb,vec3(0.40,0.38,0.40),rel.b*0.35);
  vec3 eau=mix(vec3(0.030,0.115,0.165),vec3(0.005,0.020,0.052),fond);
  vec3 alb=mix(terre,eau,mer);
  float soleil=max(ndl,0.0)*jour*(1.0-0.6*ombre);
  vec3 col=alb*soleil*2.3+alb*0.004;
  // the sun's reflection on the seas (GGX, rough water seen from far away)
  vec3 Hv=normalize(L+V); float nh=max(dot(N,Hv),0.0); float a2=0.012;
  float D=a2/(3.14159*pow(nh*nh*(a2-1.0)+1.0,2.0));
  float F=0.02+0.98*pow(1.0-max(dot(Hv,V),0.0),5.0);
  col+=mer*vec3(1.0,0.86,0.70)*D*F*max(ndl0,0.0)*0.55*(1.0-ombre);
  // warm light grazing the terminator
  col+=alb*vec3(1.0,0.42,0.18)*0.45*smoothstep(-0.04,0.16,ndl0)*(1.0-smoothstep(0.16,0.45,ndl0))*(1.0-0.5*ombre);
  // city lights on the night side, dimmed under the clouds
  float nuit=1.0-smoothstep(-0.14,0.04,ndl0);
  vec3 cVille=mix(vec3(1.0,0.64,0.32),vec3(1.0,0.26,0.20),uAlerte);
  col+=cVille*rel.b*rel.b*nuit*1.15*(1.0-0.75*nuages);
  // in-scattering: the air between the ground and the eye, thicker towards the limb
  float mu=max(dot(N,V),0.0); float epais=pow(1.0-mu,2.6);
  vec3 ciel=mix(vec3(1.0,0.48,0.22),vec3(0.20,0.44,1.0),smoothstep(-0.02,0.40,ndl0));
  float eclaire=smoothstep(-0.22,0.35,ndl0);
  col=col*(1.0-0.55*epais*eclaire)+ciel*(epais*1.15+0.035)*eclaire;
  gl_FragColor=vec4(col,1.0); }
