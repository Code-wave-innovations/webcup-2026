// Full-screen sheet drawn straight in clip space, in front of everything.
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy*2.0,0.0,1.0); }
