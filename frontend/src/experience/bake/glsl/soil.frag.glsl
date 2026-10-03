// Pass 1: ground colour (rgb) and altitude (alpha)
varying vec2 vUv;
void main(){ vec3 p=direction(vUv); float H=hauteur(p); float n=smoothstep(0.24,0.64,H); float d=fbm(p*8.0+3.0);
  vec3 col=mix(vec3(0.15,0.085,0.075),vec3(0.58,0.24,0.115),smoothstep(0.12,0.50,n));
  col=mix(col,vec3(0.79,0.48,0.25),smoothstep(0.46,0.76,n));
  col=mix(col,vec3(0.93,0.73,0.53),smoothstep(0.74,0.98,n)*0.8);
  col*=mix(0.70,1.08,smoothstep(0.25,0.75,fbm(p*1.15-3.1)));
  col*=0.84+0.32*d;
  float cal=smoothstep(0.82,0.91,abs(p.y)+(d-0.5)*0.16);
  col=mix(col,vec3(0.93,0.91,0.90),cal);
  gl_FragColor=vec4(col,clamp(H,0.0,1.0)); }
