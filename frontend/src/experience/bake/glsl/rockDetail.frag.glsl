// Tiling rock detail for the surface: slope (rg), height (b), veins (alpha)
varying vec2 vUv;
float H(vec2 p){ vec3 q=vec3(p*5.0,1.7); float c=1.0-abs(bruit(q*2.3+3.0)*2.0-1.0); float c2=1.0-abs(bruit(q*5.1+9.0)*2.0-1.0); return fbm(q)*0.60+c*c*0.28+c2*c2*0.12; }
void main(){ float e=1.0/1024.0; float h0=H(vUv); vec2 g=vec2(H(vUv+vec2(e,0.0))-h0,H(vUv+vec2(0.0,e))-h0)/e;
  gl_FragColor=vec4(clamp(0.5+g*0.05,0.0,1.0),h0,fbm(vec3(vUv*3.0,8.1))); }
