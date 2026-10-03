uniform vec3 uSoleilE; varying vec3 vN; varying vec3 vPosW;
void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vPosW); float d=dot(-N,V);
  float g=pow(smoothstep(0.0,0.36,d),3.2); float s=smoothstep(-0.30,0.60,dot(N,uSoleilE));
  vec3 c=mix(vec3(0.22,0.40,1.0),vec3(1.0,0.56,0.30),s);
  gl_FragColor=vec4(c*g*(0.05+1.5*s*s),1.0); }
