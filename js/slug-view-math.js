// +X is the head axis. Positive yaw turns +X toward -Z; screen Y grows downward.
const elevationSin=(1.12-.23)/Math.hypot(1.12-.23,2.5);
export function projectedHeading(dx,dy){return Math.atan2(-dy/elevationSin,dx);}
export function intersectsCanvas(t,x,y,w,h,cw,ch){
 const corners=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]];
 const xs=corners.map(p=>t.a*p[0]+t.c*p[1]+t.e);
 const ys=corners.map(p=>t.b*p[0]+t.d*p[1]+t.f);
 return Math.max(...xs)>0&&Math.max(...ys)>0&&Math.min(...xs)<cw&&Math.min(...ys)<ch;
}
