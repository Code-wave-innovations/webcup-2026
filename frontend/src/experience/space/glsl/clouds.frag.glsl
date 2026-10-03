uniform sampler2D tRelief; uniform vec3 uSoleilE; varying vec2 vUv; varying vec3 vN;
void main(){ float n=texture2D(tRelief,vUv).a; float a=smoothstep(0.50,0.80,n); float jour=smoothstep(-0.10,0.30,dot(normalize(vN),uSoleilE));
  gl_FragColor=vec4(vec3(0.98,0.88,0.78)*(0.04+1.2*jour),a*(0.10+0.34*jour)); }
