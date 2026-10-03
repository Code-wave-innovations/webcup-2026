// Birds, instanced. The wing is a two-joint chain: the arm turns at the shoulder, the hand at the wrist, lagging
// behind the arm and sweeping back on the upstroke; the downstroke takes 60 % of the beat, the body rises with it,
// and the whole bird banks into its turns. Position, heading, bank and wingbeat come from birds/flight.ts.
attribute vec3 aPartie; attribute vec4 iPos; attribute vec4 iDir; attribute vec4 iAile;
// uForme: wing root, shoulder → wrist; uVol: glide shoulder, wrist, sweep; uBattement: beat shoulder, wrist, lag, sweep; uBattement2: extend, bob
uniform vec2 uForme; uniform vec3 uVol; uniform vec4 uBattement; uniform vec2 uBattement2;
varying vec3 vPos; varying vec3 vN; varying vec3 vPartie; varying float vDos;
void main(){
  float amp=iAile.y;
  float a=iAile.x-0.35*(1.0-cos(iAile.x));
  float c=cos(a);
  float remontee=smoothstep(0.0,0.7,-sin(a));
  float epaule=uVol.x+amp*uBattement.x*c;
  float poignet=uVol.y+amp*uBattement.y*cos(a-uBattement.z);
  float fleche=uVol.z*(1.0-amp*uBattement2.x)+amp*uBattement.w*remontee;
  vec3 p=position; vec3 n=normal;
  if(abs(aPartie.x-1.0)<0.5){
    float cote=sign(p.x); float r=abs(p.x)-uForme.x;
    float bras=min(r,uForme.y); float paume=max(r-uForme.y,0.0);
    float dansMain=step(uForme.y-1e-4,r);
    vec2 e=vec2(cos(epaule),sin(epaule)); vec2 h=vec2(cos(epaule+poignet),sin(epaule+poignet));
    // the hand sweeps around the wrist, in its own plane
    float f=fleche*dansMain; float cf=cos(f); float sf=sin(f);
    float u=paume*cf+p.z*sf;
    p=vec3(cote*(uForme.x+bras*e.x+u*h.x),p.y+bras*e.y+u*h.y,p.z*cf-paume*sf);
    vec2 d=mix(e,h,dansMain);
    n=vec3(-cote*d.y,d.x,0.0);
  }
  vDos=n.y;
  p.y-=uBattement2.y*amp*c;
  vec3 fw=iDir.xyz; vec3 X=normalize(cross(vec3(0.0,1.0,0.0),fw)); vec3 Y=cross(fw,X);
  float cb=cos(iDir.w); float sb=sin(iDir.w);
  vec3 Xb=X*cb-Y*sb; vec3 Yb=Y*cb+X*sb;
  vec3 w=iPos.xyz+(Xb*p.x+Yb*p.y+fw*p.z)*iPos.w;
  vPos=w; vN=Xb*n.x+Yb*n.y+fw*n.z; vPartie=aPartie;
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0); }
