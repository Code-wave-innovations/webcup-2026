vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
float fbm(vec3 p){ float a=0.5; float s=0.0; for(int i=0;i<6;i++){ s+=a*bruit(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float fbm3(vec3 p){ float a=0.5; float s=0.0; for(int i=0;i<3;i++){ s+=a*bruit(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
