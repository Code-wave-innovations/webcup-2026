varying float vA; varying float vT;
void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); vec3 c=mix(vec3(1.0,0.88,0.76),vec3(0.78,0.88,1.0),step(0.4,vT)); gl_FragColor=vec4(c*a*a*vA*1.5,1.0); }
