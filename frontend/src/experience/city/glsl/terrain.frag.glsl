uniform sampler2D tDetail; uniform sampler2D tSolVille; uniform vec3 uSolVille; varying vec3 vPos; varying vec3 vN; varying float vHor;
void main(){
  if(vPos.y<uCoupe) discard;
  vec3 N=normalize(vN); float dist=length(cameraPosition-vPos);
  float fin=1.0-smoothstep(30.0,240.0,dist);
  vec4 d1=texture2D(tDetail,vPos.xz*0.0105); vec4 d2=texture2D(tDetail,vPos.xz*0.062+0.31); vec4 d3=texture2D(tDetail,vPos.xz*0.33+0.67);
  vec2 g=(d1.rg-0.5)*0.9+(d2.rg-0.5)*1.25+(d3.rg-0.5)*0.9*fin;
  N=normalize(N+vec3(g.x,0.0,g.y)*0.62);
  float pente=1.0-N.y;
  float str=texture2D(tDetail,vec2(vPos.y*0.05+d1.b*0.5,0.37)).a;
  vec3 roche=mix(vec3(0.150,0.052,0.034),vec3(0.34,0.150,0.078),smoothstep(0.30,0.70,str));
  roche=mix(roche,vec3(0.45,0.26,0.15),smoothstep(0.60,0.85,d1.a));
  vec3 sable=mix(vec3(0.24,0.115,0.066),vec3(0.40,0.215,0.12),d2.b);
  vec3 alb=mix(sable,roche,smoothstep(0.07,0.36,pente));
  alb*=0.62+0.75*d2.b;
  alb*=mix(0.40,1.0,smoothstep(0.0,1.0,vPos.y));
  // city floor: dark slab, hexagonal street grid
  vec2 q=vPos.xz-vec2(0.0,-4.0); float dq=length(q);
  float ville=smoothstep(41.0,35.0,dq)*smoothstep(0.3,0.9,vPos.y);
  vec2 hq=q/5.5; float h6=max(abs(hq.x),abs(hq.x)*0.5+abs(hq.y)*0.8660254);
  float anneaux=smoothstep(0.43,0.49,abs(fract(h6)-0.5));
  float ang=atan(q.y,q.x); float a6=abs(mod(ang+0.5235988,1.0471976)-0.5235988);
  float axes=smoothstep(0.60,0.25,dq*sin(a6));
  float rues=clamp(anneaux+axes,0.0,1.0)*ville;
  alb=mix(alb,vec3(0.050,0.055,0.070),ville*0.88);
  alb=mix(alb,vec3(0.11,0.115,0.13),rues*0.7);
  N=normalize(mix(N,normalize(vN),ville));
  float sunTan=uSoleil.y/max(length(uSoleil.xz),1e-3);
  float ombre=smoothstep(vHor-0.012,vHor+0.045,sunTan);
  // the city's own shadows, baked once: contact occlusion (r) and the long shadows of the sunset (g)
  vec2 su=(vPos.xz-uSolVille.xy)/(2.0*uSolVille.z)+0.5;
  vec2 sv=texture2D(tSolVille,clamp(su,0.0,1.0)).rg*step(abs(su.x-0.5),0.5)*step(abs(su.y-0.5),0.5);
  ombre*=1.0-sv.g*0.85;
  float ndl=max(dot(N,uSoleil),0.0);
  vec3 amb=(cielBase(normalize(vec3(N.x*0.6,abs(N.y)+0.25,N.z*0.6)))*0.21+vec3(0.010,0.012,0.022))*(1.0-sv.r*0.62);
  vec3 cl=mix(vec3(1.0,0.66,0.36),vec3(1.0,0.14,0.08),uAlerte);
  vec3 col=alb*(ndl*ombre*couleurSoleil()*2.9+amb+clairAstre(N)+cl*exp(-dq/38.0)*0.9*uNuit*(1.0-sv.r*0.5));
  float lampes=rues*(0.35+0.65*step(0.45,bruit(vec3(q*1.7,3.0))));
  col+=cl*lampes*(0.10+1.9*uNuit);
  col=brume(col,cameraPosition,vPos);
  gl_FragColor=vec4(col,1.0); }
