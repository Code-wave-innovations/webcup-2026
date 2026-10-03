// Atmosphere rim: Rayleigh blue on the day side, red-orange where the sunlight crosses the terminator,
// and a forward-scattering glow when the sun is behind the limb
uniform vec3 uSoleilE; varying vec3 vN; varying vec3 vPosW;
void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vPosW); float d=dot(-N,V);
  float g=pow(smoothstep(0.0,0.34,d),3.4); float s=dot(N,uSoleilE);
  float lit=smoothstep(-0.32,0.30,s);
  vec3 c=mix(vec3(1.0,0.42,0.16),vec3(0.20,0.45,1.0),smoothstep(-0.06,0.38,s));
  float mie=pow(max(dot(-V,uSoleilE),0.0),10.0);
  gl_FragColor=vec4((c*(0.03+1.7*lit*lit)+vec3(1.0,0.78,0.56)*mie*1.2*lit)*g,1.0); }
