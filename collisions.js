/* Schematic contact response, not an accident dynamics solver. */
(function(root){'use strict';
const rad=Math.PI/180;
function mass(v){return v.massKg||({tractor:8000,tractor_jd6m155:7800,truck:12000,semi:20000,bus:12000,trailer:4000,bicycle:100,motorcycle:250,pedestrian:80,scooter:100}[v.type]||1500)}
function contact(a,p,b,q){
 const ax={x:Math.cos(p.a*rad),y:Math.sin(p.a*rad)},ay={x:-ax.y,y:ax.x},bx={x:Math.cos(q.a*rad),y:Math.sin(q.a*rad)},by={x:-bx.y,y:bx.x},dx=q.x-p.x,dy=q.y-p.y;let depth=Infinity,normal;
 for(const n of [ax,ay,bx,by]){const da=(a.l*Math.abs(ax.x*n.x+ax.y*n.y)+a.w*Math.abs(ay.x*n.x+ay.y*n.y))/2,db=(b.l*Math.abs(bx.x*n.x+bx.y*n.y)+b.w*Math.abs(by.x*n.x+by.y*n.y))/2,dot=dx*n.x+dy*n.y,overlap=da+db-Math.abs(dot);if(overlap<=1e-8)return null;if(overlap<depth){depth=overlap;normal={x:n.x*(dot<0?-1:1),y:n.y*(dot<0?-1:1)}}}return {...normal,depth};
}
function createModel(base,vehicles,duration){
 const hz=120,count=Math.ceil(duration*hz),roots=new Map(),groups=new Map(),byId=base.byId;
 for(const v of vehicles){let r=v;while(r.parentId)r=byId.get(r.parentId);roots.set(v.id,r.id);if(!groups.has(r.id))groups.set(r.id,[]);groups.get(r.id).push(v)}
 const bodies=new Map([...groups].map(([id,vs])=>[id,{x:0,y:0,vx:0,vy:0,mass:vs.reduce((s,v)=>s+mass(v),0),samples:new Float64Array((count+1)*2)}]));
 const enabled=vehicles.filter(v=>v.collides!==false),ignored=new Set();
 for(let i=0;i<enabled.length;i++)for(let j=i+1;j<enabled.length;j++){const a=enabled[i],b=enabled[j];if(roots.get(a.id)!==roots.get(b.id)&&contact(a,base.pose(a,0),b,base.pose(b,0)))ignored.add(i+':'+j)}
 const poseAt=(v,t)=>{const p=base.pose(v,t),b=bodies.get(roots.get(v.id));return {x:p.x+b.x,y:p.y+b.y,a:p.a}};
 for(let frame=1;frame<=count;frame++){
  const start=(frame-1)/hz,end=Math.min(duration,frame/hz);let travel=0,minSize=Infinity;
  for(const v of enabled){const p=base.pose(v,start),q=base.pose(v,end),b=bodies.get(roots.get(v.id));travel=Math.max(travel,Math.hypot(q.x-p.x,q.y-p.y)+Math.hypot(b.vx,b.vy)/hz);minSize=Math.min(minSize,v.l,v.w)}
  const steps=Math.max(1,Math.ceil(travel/Math.max(.05,minSize*.2)));if(steps>256)throw Error('Fahrt für die Kollisionsanimation zu schnell. Geschwindigkeit oder Maßstab prüfen.');const dt=(end-start)/steps;
  for(let step=1;step<=steps;step++){const t=start+step*dt;for(const b of bodies.values()){b.x+=b.vx*dt;b.y+=b.vy*dt;const decay=Math.exp(-3*dt);b.vx*=decay;b.vy*=decay}
   for(let iteration=0;iteration<5;iteration++)for(let i=0;i<enabled.length;i++)for(let j=i+1;j<enabled.length;j++){
    const a=enabled[i],b=enabled[j],ra=bodies.get(roots.get(a.id)),rb=bodies.get(roots.get(b.id));if(ra===rb)continue;
    const p=poseAt(a,t),q=poseAt(b,t);if(Math.abs(p.x-q.x)>(a.l+a.w+b.l+b.w)/2||Math.abs(p.y-q.y)>(a.l+a.w+b.l+b.w)/2){ignored.delete(i+':'+j);continue;}
    const c=contact(a,p,b,q),key=i+':'+j;if(ignored.has(key)){if(!c)ignored.delete(key);continue}if(!c)continue;
    const ia=1/ra.mass,ib=1/rb.mass,total=ia+ib,p0=base.pose(a,t-dt),q0=base.pose(b,t-dt),pa=base.pose(a,t),qb=base.pose(b,t);
    const approach=((qb.x-q0.x-pa.x+p0.x)/dt+rb.vx-ra.vx)*c.x+((qb.y-q0.y-pa.y+p0.y)/dt+rb.vy-ra.vy)*c.y;
    if(approach<0){const impulse=-approach/total;ra.vx-=impulse*ia*c.x;ra.vy-=impulse*ia*c.y;rb.vx+=impulse*ib*c.x;rb.vy+=impulse*ib*c.y}
    const shift=c.depth+1e-6;ra.x-=shift*ia/total*c.x;ra.y-=shift*ia/total*c.y;rb.x+=shift*ib/total*c.x;rb.y+=shift*ib/total*c.y;
   }
  }
  for(const b of bodies.values()){b.samples[frame*2]=b.x;b.samples[frame*2+1]=b.y}
 }
 function pose(v,t){t=Math.max(0,Math.min(duration,t));const p=base.pose(v,t),b=bodies.get(roots.get(v.id)),f=t*hz,i=Math.min(count,Math.floor(f)),j=Math.min(count,i+1),u=f-i;return {x:p.x+b.samples[i*2]*(1-u)+b.samples[j*2]*u,y:p.y+b.samples[i*2+1]*(1-u)+b.samples[j*2+1]*u,a:p.a}}
 return {...base,pose,rootPose:pose};
}
root.UnfallCollisions={contact,mass,createModel};if(typeof module!=='undefined')module.exports=root.UnfallCollisions;
})(typeof window!=='undefined'?window:globalThis);
