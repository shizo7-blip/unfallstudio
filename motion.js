/* Deterministic, browser-independent schematic trajectory and drawbar model. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),rad=Math.PI/180;
const delta=(a,b)=>((b-a)%360+540)%360-180;
function buildRoute(v,i){
 const a=v.keys[i],b=v.keys[i+1],points=[a,...(a.via||[]),b].map(p=>({x:p.x,y:p.y,a:0}));
 const sub={keys:points,pathMode:v.pathMode==='smooth'?'smooth':'linear',smoothness:v.smoothness};
 let table=[{distance:0,i:0,f:0}],distance=0,previous=points[0];
 for(let j=0;j<points.length-1;j++)for(let k=1;k<=32;k++){let p=segment(sub,j,k/32);distance+=Math.hypot(p.x-previous.x,p.y-previous.y);table.push({distance,i:j,f:k/32});previous=p}
 return {sub,table,length:distance};
}
function routePoint(route,f){
 if(route.length<1e-8)return segment(route.sub,0,0);
 const target=clamp(f,0,1)*route.length,table=route.table;let lo=0,hi=table.length-1;
 while(lo<hi){let mid=(lo+hi)>>1;if(table[mid].distance<target)lo=mid+1;else hi=mid}
 let b=table[lo],a=table[Math.max(0,lo-1)],mix=b.distance===a.distance?0:(target-a.distance)/(b.distance-a.distance);
 let from=a.i===b.i?a.f:0;
 return segment(route.sub,b.i,from+(b.f-from)*mix);
}
function segment(v,i,f,routes){
 const keys=v.keys,a=keys[i],b=keys[i+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 let x=a.x+dx*f,y=a.y+dy*f,tx=dx,ty=dy;
 if(a.via?.length){
  const route=routes?.get(v.id)?.get(i)||buildRoute(v,i),p=routePoint(route,f);x=p.x;y=p.y;
  tx=p.tangent===null?0:Math.cos(p.tangent*rad);ty=p.tangent===null?0:Math.sin(p.tangent*rad);
 }else if(d>1e-7&&v.pathMode==='arc'){
  const radius=Math.max(Number(v.radius)||150,d/2),side=v.arcSide==='right'?-1:1;
  const h=Math.sqrt(Math.max(0,radius*radius-d*d/4));
  const cx=(a.x+b.x)/2-dy/d*h*side,cy=(a.y+b.y)/2+dx/d*h*side;
  const start=Math.atan2(a.y-cy,a.x-cx),sweep=side*2*Math.asin(clamp(d/(2*radius),0,1)),angle=start+sweep*f;
  x=cx+radius*Math.cos(angle);y=cy+radius*Math.sin(angle);
  tx=-Math.sin(angle)*side;ty=Math.cos(angle)*side;
 }else if(d>1e-7&&v.pathMode==='smooth'){
  let p=keys[i-1],n=keys[i+2];
  let m0=p&&Math.hypot(a.x-p.x,a.y-p.y)>1e-7?{x:(b.x-p.x)/2,y:(b.y-p.y)/2}:{x:dx,y:dy};
  let m1=n&&Math.hypot(n.x-b.x,n.y-b.y)>1e-7?{x:(n.x-a.x)/2,y:(n.y-a.y)/2}:{x:dx,y:dy};
  const strength=clamp(v.smoothness??.8,0,1.5);
  for(const m of [m0,m1]){const scale=Math.min(1,d*1.5/(Math.hypot(m.x,m.y)||1))*strength;m.x*=scale;m.y*=scale}
  const f2=f*f,f3=f2*f;
  x=(2*f3-3*f2+1)*a.x+(f3-2*f2+f)*m0.x+(-2*f3+3*f2)*b.x+(f3-f2)*m1.x;
  y=(2*f3-3*f2+1)*a.y+(f3-2*f2+f)*m0.y+(-2*f3+3*f2)*b.y+(f3-f2)*m1.y;
  tx=(6*f2-6*f)*a.x+(3*f2-4*f+1)*m0.x+(-6*f2+6*f)*b.x+(3*f2-2*f)*m1.x;
  ty=(6*f2-6*f)*a.y+(3*f2-4*f+1)*m0.y+(-6*f2+6*f)*b.y+(3*f2-2*f)*m1.y;
 }
 // Preserve exact control points, including coincident points used as holds.
 if(f===0){x=a.x;y=a.y}if(f===1){x=b.x;y=b.y}
 return {x,y,a:a.a+delta(a.a,b.a)*f,tangent:Math.hypot(tx,ty)>1e-8?Math.atan2(ty,tx)/rad:null};
}
function distanceTable(v,i,routes){
 const a=v.keys[i],b=v.keys[i+1];
 if(a.via?.length){const r=routes?.get(v.id)?.get(i)||buildRoute(v,i);return {length:r.length,table:[{distance:0,f:0},{distance:r.length,f:1}]}}
 const d=Math.hypot(b.x-a.x,b.y-a.y);
 if(v.pathMode==='arc'&&d>1e-8){const R=Math.max(v.radius||150,d/2),length=2*R*Math.asin(clamp(d/(2*R),0,1));return {length,table:[{distance:0,f:0},{distance:length,f:1}]}}
 if(v.pathMode!=='smooth')return {length:d,table:[{distance:0,f:0},{distance:d,f:1}]};
 const table=[{distance:0,f:0}];let previous=segment(v,i,0,routes),length=0;
 for(let j=1;j<=128;j++){const p=segment(v,i,j/128,routes);length+=Math.hypot(p.x-previous.x,p.y-previous.y);table.push({distance:length,f:j/128});previous=p}return {length,table};
}
function distanceParameter(data,f){if(data.length<1e-8)return f;const target=clamp(f,0,1)*data.length,table=data.table;let lo=0,hi=table.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(table[mid].distance<target)lo=mid+1;else hi=mid}const b=table[lo],a=table[Math.max(0,lo-1)],u=b.distance===a.distance?0:(target-a.distance)/(b.distance-a.distance);return a.f+(b.f-a.f)*u}
function travelData(v,routes){return v.keys.slice(0,-1).map((k,i)=>distanceTable(v,i,routes))}
function paceProgress(v,i,f,data){
 if(v.keys[i].pace!=='smooth'||data[i].length<1e-8)return f;
 const rates=data.map((d,j)=>d.length/(v.keys[j+1].t-v.keys[j].t)),rate=rates[i];
 function boundary(left,right){if(left<0||right>=rates.length)return 0;const a=rates[left],b=rates[right];if(a<1e-8||b<1e-8)return 0;if(v.keys[left].pace!=='smooth')return a;if(v.keys[right].pace!=='smooth')return b;return 2*a*b/(a+b)}
 let m0=Math.min(3,boundary(i-1,i)/rate),m1=Math.min(3,boundary(i,i+1)/rate);const norm=Math.hypot(m0,m1);if(norm>3){m0*=3/norm;m1*=3/norm}
 const f2=f*f,f3=f2*f;return clamp((f3-2*f2+f)*m0+(-2*f3+3*f2)+(f3-f2)*m1,0,1);
}
function rootPose(v,t,routes,travel){
 const k=v.keys;if(k.length===1)return {...k[0]};
 let i=0;while(i<k.length-2&&t>=k[i+1].t)i++;
 let f=clamp((t-k[i].t)/(k[i+1].t-k[i].t),0,1),data=travel?.get(v.id);if(data)f=distanceParameter(data[i],paceProgress(v,i,f,data));let p=segment(v,i,f,routes);
 if(k.length>1){
  let a=p.tangent;
  if(a===null){for(let j=i-1;j>=0&&a===null;j--)a=segment(v,j,1,routes).tangent;for(let j=i+1;j<k.length-1&&a===null;j++)a=segment(v,j,0,routes).tangent}
  if(a!==null)p.a=a;
 }
 return {x:p.x,y:p.y,a:p.a};
}
function createModel(vehicles,duration){
 const routes=new Map();for(const v of vehicles){const perSegment=new Map();for(let i=0;i<v.keys.length-1;i++)if(v.keys[i].via?.length)perSegment.set(i,buildRoute(v,i));routes.set(v.id,perSegment)}
 const travel=new Map(vehicles.map(v=>[v.id,travelData(v,routes)]));
 const byId=new Map(vehicles.map(v=>[v.id,v]));if(byId.size!==vehicles.length)throw Error('Doppelte Fahrzeugkennung.');
 const visiting=new Set(),visited=new Set(),ordered=[];
 function visit(v){if(visiting.has(v.id))throw Error('Kopplung darf keinen Kreis bilden.');if(visited.has(v.id))return;visiting.add(v.id);if(v.parentId){let p=byId.get(v.parentId);if(!p)throw Error('Zugfahrzeug fehlt.');visit(p)}visiting.delete(v.id);visited.add(v.id);ordered.push(v)}
 for(const v of vehicles)visit(v);
 const hz=120,frames=Math.ceil(duration*hz),angles=new Map();
 const hitch=(v,p)=>({x:p.x-Math.cos(p.a*rad)*v.l/2,y:p.y-Math.sin(p.a*rad)*v.l/2});
 function pose(v,t){
  t=clamp(t,0,duration);if(!v.parentId)return rootPose(v,t,routes,travel);
  const parent=byId.get(v.parentId),h=hitch(parent,pose(parent,t)),samples=angles.get(v.id);
  let index=t*hz,i=Math.min(frames,Math.floor(index)),j=Math.min(frames,i+1),a=samples[i]+delta(samples[i],samples[j])*(index-i);
  const L=v.l/2+(v.drawbar??20);
  return {x:h.x-L*Math.cos(a*rad),y:h.y-L*Math.sin(a*rad),a};
 }
 for(const v of ordered){if(!v.parentId)continue;
  const parent=byId.get(v.parentId),L=v.l/2+(v.drawbar??20),samples=new Float64Array(frames+1);
  let p=pose(parent,0),last=hitch(parent,p),a=p.a+(v.couplingAngle??0);
  samples[0]=a;let axle={x:last.x-L*Math.cos(a*rad),y:last.y-L*Math.sin(a*rad)};
  for(let i=1;i<=frames;i++){
   const h=hitch(parent,pose(parent,i/hz)),dist=Math.hypot(h.x-last.x,h.y-last.y),steps=Math.max(1,Math.ceil(dist/Math.min(1,L/20)));
   for(let j=1;j<=steps;j++){
    const x=last.x+(h.x-last.x)*j/steps,y=last.y+(h.y-last.y)*j/steps;
    const candidate=Math.atan2(y-axle.y,x-axle.x)/rad;
    a+=delta(a,candidate);axle={x:x-L*Math.cos(a*rad),y:y-L*Math.sin(a*rad)};
   }
   samples[i]=a;last=h;
  }
  angles.set(v.id,samples);
 }
 return {pose,rootPose:(v,t)=>rootPose(v,t,routes,travel),segmentLength:(v,i)=>travel.get(v.id)?.[i]?.length||0,ordered,byId};
}
function insertWaypoint(v,index,p){
 const a=v.keys[index],b=v.keys[index+1];if(!a||!b)throw Error('Start und Ziel fehlen.');
 const via=a.via||[],points=[a,...via,b];let best=Infinity,slot=0;
 for(let i=0;i<points.length-1;i++){const q=points[i],r=points[i+1],dx=r.x-q.x,dy=r.y-q.y,den=dx*dx+dy*dy,t=den?clamp(((p.x-q.x)*dx+(p.y-q.y)*dy)/den,0,1):0,d=Math.hypot(p.x-q.x-t*dx,p.y-q.y-t*dy);if(d<best){best=d;slot=i}}
 if(via.length>=100)throw Error('Maximal 100 Wegpunkte pro Abschnitt.');
 a.via=via;a.via.splice(slot,0,{x:p.x,y:p.y});return slot;
}
function retimeForSpeed(v,index,speedPx,sceneDuration){
 if(!Number.isFinite(speedPx)||speedPx<=0)throw Error('Geschwindigkeit muss größer als null sein.');
 const data=travelData(v),length=data[index]?.length;if(!length||length<1e-7)throw Error('Dieser Abschnitt ist eine Standphase. Für Fahrt Start und Ziel unterschiedlich setzen.');
 const start=v.keys[index].t,newEnd=start+length/speedPx,shift=newEnd-v.keys[index+1].t,last=v.keys.at(-1).t+shift;
 if(last>10+1e-8)throw Error('Diese Geschwindigkeit benötigt insgesamt '+last.toFixed(2)+' s. Maximal sind 10 s möglich. Geschwindigkeit erhöhen oder Fahrweg kürzen.');
 if(newEnd-start<.01)throw Error('Der Abschnitt wäre kürzer als 0,01 s. Bitte geringere Geschwindigkeit wählen.');
 const keys=v.keys.map((k,j)=>({...k,t:j>index?k.t+shift:k.t}));
 return {keys,duration:Math.max(sceneDuration,Math.ceil(Math.min(10,last))),end:newEnd,length};
}
function routePoints(v,index){const a=v.keys[index],b=v.keys[index+1];if(!a)return [];return [{p:a,kind:'start'},...(a.via||[]).map((p,index)=>({p,kind:'via',index})),...(b?[{p:b,kind:'end'}]:[])]}
function stationaryGroup(v,index){
 const points=[v.keys[index]],anchor=v.keys[index];if(!anchor)return [];
 for(let i=index-1;i>=0;i--){const k=v.keys[i];if(k.via?.length||Math.hypot(k.x-anchor.x,k.y-anchor.y)>1e-7)break;points.push(k)}
 for(let i=index+1;i<v.keys.length;i++){const k=v.keys[i];if(v.keys[i-1].via?.length||Math.hypot(k.x-anchor.x,k.y-anchor.y)>1e-7)break;points.push(k)}return points;
}
function appendRoutePoint(v,index,p,endTime){
 if(!p||![p.x,p.y].every(Number.isFinite))throw Error('Ungültiger Bewegungspunkt.');
 const a=v.keys[index],b=v.keys[index+1];if(!a)throw Error('Startpunkt fehlt.');
 if(v.routeStarted===false){a.x=p.x;a.y=p.y;v.routeStarted=true;v.auto=true;v.pathMode='smooth';return {kind:'start'}}
 if(!b){if(!Number.isFinite(endTime)||endTime<=a.t)throw Error('Für die Fahrt muss Zeit nach dem Startpunkt verbleiben.');v.keys.push({t:endTime,x:p.x,y:p.y,a:a.a});v.auto=true;v.pathMode='smooth';return {kind:'end'}}
 if(Math.hypot(b.x-p.x,b.y-p.y)<1e-7)return {kind:'end'};
 if((a.via?.length||0)>=100)throw Error('Maximal 100 Zwischenpunkte pro Abschnitt.');
 const old={x:b.x,y:b.y},following=stationaryGroup(v,index+1).filter(k=>v.keys.indexOf(k)>index);
 a.via??=[];const previous=a.via.at(-1)||a;if(Math.hypot(previous.x-old.x,previous.y-old.y)>1e-7)a.via.push(old);for(const k of following){k.x=p.x;k.y=p.y}
 v.auto=true;if(!v.pathMode||v.pathMode==='arc')v.pathMode='smooth';return {kind:'end'};
}
root.UnfallMotion={createModel,rootPose,segment,delta,buildRoute,routePoint,insertWaypoint,distanceTable,distanceParameter,travelData,paceProgress,retimeForSpeed,routePoints,stationaryGroup,appendRoutePoint};
if(typeof module!=='undefined')module.exports=root.UnfallMotion;
})(typeof window!=='undefined'?window:globalThis);
