// 4-tap downsample that keeps only the highlights (feeds the halo and the anamorphic streak)
uniform sampler2D inputBuffer; uniform vec2 uPas; uniform float uSeuil; varying vec2 vUv;
void main(){ vec3 c=texture2D(inputBuffer,vUv+uPas*vec2(-1.0,-1.0)).rgb+texture2D(inputBuffer,vUv+uPas*vec2(1.0,-1.0)).rgb+texture2D(inputBuffer,vUv+uPas*vec2(-1.0,1.0)).rgb+texture2D(inputBuffer,vUv+uPas*vec2(1.0,1.0)).rgb;
  c*=0.25; float l=max(c.r,max(c.g,c.b)); c*=smoothstep(uSeuil,uSeuil+0.6,l); gl_FragColor=vec4(min(c,vec3(24.0)),1.0); }
