// Hexagon outline with a pulsing core over a thread of light down to the landmark; brighter when its section is read.
uniform float uActif; uniform float uTemps; uniform float uNuit; uniform float uAlerte; varying vec2 vUv;
float hexa(vec2 p,float r){ p=abs(p); return max(p.x*0.8660254+p.y*0.5,p.y)-r; }
void main(){
  float y=vUv.y*2.0-1.5;
  vec3 c=mix(vec3(0.50,0.92,1.0),vec3(1.0,0.22,0.12),uAlerte);
  float a=0.0;
  if(y>-0.5){
    vec2 p=vec2(vUv.x-0.5,y);
    float contour=smoothstep(0.035,0.0,abs(hexa(p,0.34)));
    float coeur=(1.0-smoothstep(-0.02,0.0,hexa(p,0.16)))*(0.45+0.35*sin(uTemps*3.0));
    float onde=fract(uTemps*0.55);
    float vague=smoothstep(0.03,0.0,abs(hexa(p,0.34+onde*0.14)))*(1.0-onde)*uActif;
    a=contour*(0.55+0.45*uActif)+coeur*(0.3+0.7*uActif)+vague;
  } else {
    float fil=smoothstep(0.022,0.0,abs(vUv.x-0.5))*smoothstep(-1.5,-0.6,y);
    a=fil*(0.25+0.6*uActif);
  }
  gl_FragColor=vec4(c*a*(0.55+0.6*uNuit)*(0.4+0.9*uActif),1.0); }
