(function(root){
'use strict';
function clone(scene){const {map,...rest}=scene;return {...JSON.parse(JSON.stringify(rest)),map}}
function same(a,b){if(a.map!==b.map)return false;const {map:am,...ar}=a,{map:bm,...br}=b;return JSON.stringify(ar)===JSON.stringify(br)}
class SceneHistory{
 constructor(limit=80){this.limit=limit;this.entries=[];this.index=-1;this.group=null}
 reset(scene){this.entries=[clone(scene)];this.index=0;this.group=null}
 record(scene,group=null){if(this.index<0){this.reset(scene);return false}if(same(this.entries[this.index],scene))return false;
 const replace=group!==null&&group===this.group&&this.index===this.entries.length-1&&this.index>0;
 if(replace)this.entries[this.index]=clone(scene);else{this.entries.splice(this.index+1);this.entries.push(clone(scene));this.index++;if(this.entries.length>this.limit+1){this.entries.shift();this.index--}}
 this.group=group;return true}
 get canUndo(){return this.index>0}get canRedo(){return this.index<this.entries.length-1}
 undo(){if(!this.canUndo)return null;this.group=null;return clone(this.entries[--this.index])}
 redo(){if(!this.canRedo)return null;this.group=null;return clone(this.entries[++this.index])}
}
root.SceneHistory=SceneHistory;if(typeof module!=='undefined')module.exports=SceneHistory;
})(typeof window!=='undefined'?window:globalThis);
