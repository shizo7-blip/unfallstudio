(function(root){
'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function fit(w,h,cw,ch){const z=Math.min(w/cw,h/ch);return {z,x:(w-cw*z)/2,y:(h-ch*z)/2,min:z}}
function constrain(v,w,h,cw,ch){const z=clamp(v.z,v.min,v.min*8),x=cw*z<=w?(w-cw*z)/2:clamp(v.x,w-cw*z,0),y=ch*z<=h?(h-ch*z)/2:clamp(v.y,h-ch*z,0);return {...v,z,x,y}}
function zoom(v,newZ,p){const z=clamp(newZ,v.min,v.min*8),x=p.x-(p.x-v.x)*z/v.z,y=p.y-(p.y-v.y)*z/v.z;return {...v,z,x,y}}
root.UnfallViewport={fit,constrain,zoom};if(typeof module!=='undefined')module.exports=root.UnfallViewport;
})(typeof window!=='undefined'?window:globalThis);
