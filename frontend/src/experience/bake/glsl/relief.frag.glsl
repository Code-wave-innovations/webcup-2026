// Pass 2: relief slope (rg), city lights (b), clouds (alpha)
varying vec2 vUv;
float trame(vec3 p,vec3 c,float taille){
  float d=acos(clamp(dot(p,c),-1.0,1.0)); float dn=d/taille; if(dn>1.7) return 0.0;
  vec3 e=normalize(cross(vec3(0.0,1.0,0.0),c)); vec3 n=cross(c,e); vec2 q=vec2(dot(p,e),dot(p,n))/taille;
  float hx=max(abs(q.x),abs(q.x)*0.5+abs(q.y)*0.8660254); float pas=0.17;
  float dh=abs(mod(hx+pas*0.5,pas)-pas*0.5);
  float ang=atan(q.y,q.x); float a6=abs(mod(ang+0.5235988,1.0471976)-0.5235988);
  float rues=smoothstep(0.022,0.007,dh)*smoothstep(1.05,0.3,dn);
  float axes=smoothstep(0.022,0.007,dn*sin(a6))*smoothstep(1.3,0.1,dn);
  float coeur=smoothstep(0.17,0.0,dn);
  float grains=0.30+0.70*step(0.40,bruit(p*380.0));
  float semis=smoothstep(0.72,0.92,bruit(p*150.0))*smoothstep(1.6,0.3,dn)*0.8;
  return clamp(coeur*1.3+(rues*0.85+axes)*grains+semis*grains,0.0,1.0); }
void main(){ vec3 p=direction(vUv); float phi=vUv.x*6.28318530718;
  vec3 e=vec3(sin(phi),0.0,cos(phi)); vec3 no=cross(p,e); float eps=0.0035;
  float h0=hauteur(p); float he=hauteur(normalize(p+e*eps)); float hn=hauteur(normalize(p+no*eps));
  vec2 g=vec2(he-h0,hn-h0)/eps;
  float v=trame(p,normalize(vec3(0.50,0.20,0.84)),0.26);
  v=max(v,trame(p,normalize(vec3(-0.80,-0.12,0.58)),0.11)*0.9);
  v=max(v,trame(p,normalize(vec3(-0.30,0.45,-0.84)),0.15));
  v=max(v,trame(p,normalize(vec3(0.85,-0.30,-0.42)),0.10)*0.9);
  float nu=fbm(p*2.6+fbm3(p*5.0)*0.9+7.0);
  gl_FragColor=vec4(clamp(0.5+g/14.0,0.0,1.0),v,nu); }
