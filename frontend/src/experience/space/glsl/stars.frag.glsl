// A star: a sharp core with a soft airy glow; colour from its temperature (red dwarfs to blue giants, mostly white-yellow)
varying float vT; varying float vB;
void main(){ float d=length(gl_PointCoord-0.5); float coeur=smoothstep(0.22,0.0,d); float halo=smoothstep(0.5,0.0,d)*0.25;
  vec3 c=vT<0.12?vec3(1.0,0.62,0.42):vT<0.40?vec3(1.0,0.86,0.70):vT<0.80?vec3(1.0,0.97,0.93):vec3(0.72,0.84,1.0);
  gl_FragColor=vec4(c*(coeur+halo)*(0.45+1.4*vB),1.0); }
