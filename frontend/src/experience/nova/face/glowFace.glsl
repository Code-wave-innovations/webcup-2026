// Faceless helmet: Nova's feelings are told by the light of its armour lines. The lines are found in the
// albedo texture (cyan and magenta strokes); zones come from the `_NOVAZONE` attribute written by the
// rigging script (0 body, 0.5 helmet, 1 chest core).
varying float vNovaZone;
uniform float uGlowTime;
uniform vec4 uHelmetGlow;   // rgb tint, a: tint amount
uniform float uHelmetLevel;
uniform vec4 uBodyGlow;
uniform float uBodyLevel;
uniform vec4 uCoreGlow;
uniform float uCoreLevel;
uniform float uScan;

vec3 novaGlow(vec3 albedo){
  float peak=max(albedo.r,max(albedo.g,albedo.b));
  float cyan=smoothstep(0.04,0.2,(albedo.g+albedo.b)*0.5-albedo.r)*smoothstep(0.1,0.4,peak);
  float magenta=smoothstep(0.03,0.14,(albedo.r+albedo.b)*0.5-albedo.g)*smoothstep(0.06,0.26,peak);
  float lines=max(cyan,magenta*0.75);
  float luma=dot(albedo,vec3(0.2126,0.7152,0.0722));
  float helmet=step(0.25,vNovaZone)*step(vNovaZone,0.75);
  float core=step(0.75,vNovaZone);
  float body=max(0.0,1.0-helmet-core);
  // thinking: a band of light sweeping up the helmet
  float scan=uScan*smoothstep(0.65,1.0,sin(gl_FragCoord.y*0.035-uGlowTime*7.0))*helmet;
  vec3 h=mix(albedo*3.0,uHelmetGlow.rgb*luma*5.0,uHelmetGlow.a)*(uHelmetLevel+scan*2.5);
  vec3 b=mix(albedo*3.0,uBodyGlow.rgb*luma*5.0,uBodyGlow.a)*uBodyLevel;
  vec3 c=mix(albedo*3.0,uCoreGlow.rgb*luma*5.0,uCoreGlow.a)*uCoreLevel;
  return lines*(h*helmet+b*body+c*core);
}
