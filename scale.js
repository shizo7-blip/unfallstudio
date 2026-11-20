(function(root){
'use strict';
function parseRatio(text){
 const match=String(text).trim().match(/^1\s*:\s*([\d\s.]+)$/);
 if(!match)throw Error('Maßstab bitte als 1:3000 eingeben.');
 let digits=match[1].replace(/\s/g,'');
 if(digits.includes('.')){if(!/^\d{1,3}(\.\d{3})+$/.test(digits))throw Error('Maßstab bitte als 1:3000 eingeben.');digits=digits.replace(/\./g,'')}
 const denominator=Number(digits);if(!Number.isSafeInteger(denominator)||denominator<1||denominator>100000000)throw Error('Maßstab muss zwischen 1:1 und 1:100000000 liegen.');return denominator;
}
function fromRatio(text,dpi=96,pixelScale=1){
 const denominator=parseRatio(text);dpi=Number(dpi);if(!Number.isFinite(dpi)||dpi<10||dpi>2400)throw Error('Bildauflösung muss zwischen 10 und 2400 DPI liegen.');if(!Number.isFinite(pixelScale)||pixelScale<=0||pixelScale>1)throw Error('Ungültiger Bildfaktor.');
 const metersPerPixel=denominator*.0254/(dpi*pixelScale);if(metersPerPixel>100000)throw Error('Maßstab für diese Bildauflösung zu groß.');
 return {denominator,dpi,metersPerPixel};
}
const defaults={car:[4.5,1.8],wagon_black:[4.667,2.017],suv:[4.8,1.95],van:[6,2.1],truck:[12,2.55],semi:[16.5,2.55],bus:[12,2.55],tractor:[4.5,2.5],tractor_jd6m155:[4.733,2.55],trailer:[6,2.5],motorcycle:[2.2,.8],bicycle:[1.8,.6],pedestrian:[.5,.5],tram:[30,2.4],emergency:[6,2.1],scooter:[1.2,.5],other:[4.5,1.8]};
function applyVehicles(s){for(const v of s.vehicles){const d=defaults[v.type]||defaults.other;v.lengthMeters??=d[0];v.widthMeters??=d[1];v.drawbarMeters??=.8;if(s.metersPerPixel){v.l=v.lengthMeters/s.metersPerPixel;v.w=v.widthMeters/s.metersPerPixel;v.drawbar=v.drawbarMeters/s.metersPerPixel}}}
function measure(points,mode){
 if(mode==='distance')return {value:points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0)};
 if(points.length<3)return null;const [a,b,c]=points,ab=Math.hypot(a.x-b.x,a.y-b.y),bc=Math.hypot(c.x-b.x,c.y-b.y);if(ab<1e-8||bc<1e-8)throw Error('Messpunkte müssen verschieden sein.');
 if(mode==='angle')return {value:Math.acos(Math.min(1,Math.max(-1,((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))/(ab*bc))))*180/Math.PI};
 const cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),ac=Math.hypot(c.x-a.x,c.y-a.y);if(Math.abs(cross)<1e-8*ab*bc)throw Error('Kein eindeutiger Radius: drei Punkte auf einer Geraden.');
 const bx=b.x-a.x,by=b.y-a.y,cx=c.x-a.x,cy=c.y-a.y,d=2*cross,u=bx*bx+by*by,v=cx*cx+cy*cy;
 return {value:ab*bc*ac/(2*Math.abs(cross)),center:{x:a.x+(cy*u-by*v)/d,y:a.y+(bx*v-cx*u)/d}};
}
root.UnfallScale={parseRatio,fromRatio,defaults,applyVehicles,measure};if(typeof module!=='undefined')module.exports=root.UnfallScale;
})(typeof window!=='undefined'?window:globalThis);
