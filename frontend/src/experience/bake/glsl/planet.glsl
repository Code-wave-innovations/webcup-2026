// Terrain of Terra Nova seen from space: domain-warped fbm, ridges and craters on the unit sphere
float cretes(vec3 p){ float a=0.5; float s=0.0; for(int i=0;i<5;i++){ float n=1.0-abs(bruit(p)*2.0-1.0); s+=a*n*n; p=p*2.1+vec3(4.1,2.3,7.7); a*=0.5; } return s; }
float crateres(vec3 p,float k){ vec3 x=p*k; vec3 i=floor(x); vec3 f=fract(x); vec3 s=step(0.5,f)-1.0; float res=0.0;
  for(int a=0;a<2;a++){ for(int b=0;b<2;b++){ for(int c=0;c<2;c++){
    vec3 g=s+vec3(float(a),float(b),float(c)); vec3 o=hash3(i+g);
    float present=step(0.58,fract(o.x*7.3+o.y*3.1)); float rad=mix(0.16,0.38,o.z);
    float d=length(g+o-f)/rad;
    float bol=-(1.0-smoothstep(0.0,0.92,d))*0.60; float bord=smoothstep(0.70,1.0,d)*(1.0-smoothstep(1.0,1.30,d))*0.42;
    res+=present*(bol+bord); }}}
  return res; }
float hauteur(vec3 p){
  vec3 q=p+0.32*vec3(fbm3(p*1.4+2.0),fbm3(p*1.4+11.0),fbm3(p*1.4+23.0));
  return fbm(q*2.1)*0.60+cretes(q*3.2+5.0)*0.34+crateres(p,7.0)*0.060+crateres(p,15.0)*0.030; }
vec3 direction(vec2 uv){ float phi=uv.x*6.28318530718; float th=(1.0-uv.y)*3.14159265359; return vec3(-cos(phi)*sin(th),cos(th),sin(phi)*sin(th)); }
