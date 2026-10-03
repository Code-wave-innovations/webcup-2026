// separable 9-tap gaussian with linear-sampling offsets
uniform sampler2D inputBuffer; uniform vec2 uPas; varying vec2 vUv;
void main(){ vec3 c=texture2D(inputBuffer,vUv).rgb*0.2270;
  c+=(texture2D(inputBuffer,vUv+uPas*1.3846).rgb+texture2D(inputBuffer,vUv-uPas*1.3846).rgb)*0.3162;
  c+=(texture2D(inputBuffer,vUv+uPas*3.2308).rgb+texture2D(inputBuffer,vUv-uPas*3.2308).rgb)*0.0703;
  gl_FragColor=vec4(c,1.0); }
