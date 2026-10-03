varying float vA;
void main(){
  float r=length(gl_PointCoord-0.5)*2.0;
  float a=smoothstep(1.0,0.0,r); a*=a;
  gl_FragColor=vec4(vec3(1.0,0.74,0.42)*a*vA,1.0); }
