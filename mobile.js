'use strict';
// Responsive application shell. Scene/project data continue to use the same storage.
const mobileMedia=matchMedia('(max-width: 900px)');
let mobilePanel='scene',installationPrompt=null;
function showPanel(panel){
 mobilePanel=panel;document.body.dataset.mobilePanel=panel;$('undo').textContent=mobileMedia.matches?'↶ Zurück':'↶ Rückgängig';$('redo').textContent=mobileMedia.matches?'↷ Vor':'↷ Wiederholen';
 document.querySelectorAll('#mobileNav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===panel)));
 const aside=document.querySelector('aside');aside.setAttribute('aria-label',panel==='properties'?'Fahrzeug bearbeiten':panel==='vehicles'?'Fahrzeuge auswählen':'Projekt verwalten');
 if(mobileMedia.matches&&panel!=='scene'){aside.scrollTop=0;window.scrollTo(0,0)}
}
showPanel('scene');document.querySelectorAll('#mobileNav button').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$('catalog').addEventListener('click',e=>{if(e.target.closest('button')&&mobileMedia.matches)showPanel('properties')});
$('vehicleList').addEventListener('click',e=>{if(e.target.closest('button')&&mobileMedia.matches)showPanel('properties')});
$('routeEdit').addEventListener('click',()=>{if(routeEditing){endPanMode();showPanel('scene')}});
$('measureScale').addEventListener('click',()=>{if(measureMode){endPanMode();showPanel('scene')}updateMapExit()});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installationPrompt=e});
$('install').onclick=async()=>{if(installationPrompt){const prompt=installationPrompt;installationPrompt=null;await prompt.prompt();await prompt.userChoice}else $('installGuide').showModal()};
window.addEventListener('appinstalled',()=>{$('install').hidden=true;status('Unfallstudio wurde zum Startbildschirm hinzugefügt.')});
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)$('install').hidden=true;
// Viewport only changes presentation. Canvas exports always contain the entire scene.
const stage=c.parentElement,V=UnfallViewport;
let view={z:1,x:0,y:0,min:1},pan=false,activePointers=new Map(),gesture=null,gestureConsumed=false,preGestureVehicles=null;
function bounds(){return {w:stage.clientWidth,h:stage.clientHeight,cw:c.offsetWidth,ch:c.offsetHeight}}
function paintView(){const {w,h,cw,ch}=bounds();if(!cw||!ch||!w||!h)return;view=V.constrain(view,w,h,cw,ch);c.style.transformOrigin='0 0';c.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.z})`;$('zoomFit').textContent='Einpassen';$('zoomFit').title='Ansicht zurücksetzen';updateMapExit();render()}
function fitView(){const {w,h,cw,ch}=bounds();if(w&&h&&cw&&ch){view=V.fit(w,h,cw,ch);paintView()}}
function localPoint(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function zoomAt(factor){const {w,h}=bounds();view=V.zoom(view,view.z*factor,{x:w/2,y:h/2});paintView()}
$('zoomIn').onclick=()=>zoomAt(1.4);$('zoomOut').onclick=()=>zoomAt(1/1.4);$('zoomFit').onclick=fitView;
$('panView').onclick=()=>{pan=!pan;$('panView').setAttribute('aria-pressed',String(pan));$('panView').textContent=pan?'✓ Verschieben':'✋ Verschieben';stage.classList.toggle('pan-mode',pan);updateMapExit()};
function updateMapExit(){
 const expanded=stage.classList.contains('map-expanded')||document.fullscreenElement===stage;
 $('closeMap').hidden=!(expanded||view.z>view.min*1.01||pan||routeEditing||measureMode||rulerActive);
 $('closeMap').textContent=expanded?'← Karte schließen':'↶ Ansicht zurücksetzen';
 $('mapFullscreen').textContent=expanded?'✕':'⛶';$('mapFullscreen').setAttribute('aria-label',expanded?'Karte schließen':'Große Karte öffnen');
}
function clearMapGesture(){
 if(drag&&!gestureConsumed){if(drag.kind==='newPoint')drag=null;else finish()}
 for(const id of activePointers.keys()){for(const target of [stage,c])try{if(target.hasPointerCapture(id))target.releasePointerCapture(id)}catch(_){}}
 activePointers.clear();gesture=null;gestureConsumed=false;preGestureVehicles=null;drag=null;
}
async function leaveMap(){
 clearMapGesture();stage.classList.remove('map-expanded','pan-mode');document.body.classList.remove('map-open');
 rulerActive=false;rulerPoints=[];$('rulerOverlay').hidden=true;$('rulerStart').textContent='Auf Karte messen';pan=false;routeEditing=false;measureMode=false;measurePoints=[];chosenPoint=null;
 $('panView').setAttribute('aria-pressed','false');$('panView').textContent='✋ Verschieben';
 try{if(document.fullscreenElement===stage&&document.exitFullscreen)await document.exitFullscreen()}catch(_){status('Zum Verlassen des Browser-Vollbilds die Zurück-Taste verwenden.');}
 showPanel('scene');if(!recording)seek(time);requestAnimationFrame(()=>{fitView();updateMapExit();stage.scrollIntoView({block:'center'})});
}
$('closeMap').onclick=leaveMap;
$('mapFullscreen').onclick=()=>{if(stage.classList.contains('map-expanded')||document.fullscreenElement===stage){leaveMap();return}clearMapGesture();showPanel('scene');stage.classList.add('map-expanded');document.body.classList.add('map-open');updateMapExit();requestAnimationFrame(fitView)};
$('zoomFit').onclick=leaveMap;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(stage.classList.contains('map-expanded')||view.z>view.min*1.01||pan)){e.preventDefault();leaveMap()}});
document.addEventListener('fullscreenchange',()=>{updateMapExit();requestAnimationFrame(fitView)});
new MutationObserver(updateMapExit).observe(stage,{attributes:true,attributeFilter:['class']});
function stop(e){e.preventDefault();e.stopImmediatePropagation()}
function pinchState(){const p=[...activePointers.values()],a=p[0],b=p[1];return {point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}}
stage.addEventListener('pointerdown',e=>{
 if(e.target.closest('.viewport-tools,.map-exit-control,.map-edit-tools,#rulerOverlay')||recording)return;
 activePointers.set(e.pointerId,localPoint(e));
 if(activePointers.size===1){preGestureVehicles=JSON.stringify(state.vehicles);gestureConsumed=pan;gesture={kind:'pan',point:localPoint(e),view:{...view}};if(pan){stage.setPointerCapture(e.pointerId);stop(e)}}
 else if(activePointers.size===2){if(preGestureVehicles){state.vehicles=JSON.parse(preGestureVehicles);drag=null;chosenPoint=null}gestureConsumed=true;const start=pinchState();gesture={kind:'pinch',...start,view:{...view}};stage.setPointerCapture(e.pointerId);stop(e);sync();render()}
 else if(gestureConsumed)stop(e);
},{capture:true});
stage.addEventListener('pointermove',e=>{
 if(!activePointers.has(e.pointerId))return;activePointers.set(e.pointerId,localPoint(e));if(!gestureConsumed)return;stop(e);
 if(activePointers.size>=2&&gesture?.kind==='pinch'){const now=pinchState(),base=gesture.view;view=V.zoom(base,base.z*now.distance/gesture.distance,gesture.point);view.x+=now.point.x-gesture.point.x;view.y+=now.point.y-gesture.point.y}
 else if(gesture?.kind==='pan'){const now=localPoint(e);view={...gesture.view,x:gesture.view.x+now.x-gesture.point.x,y:gesture.view.y+now.y-gesture.point.y}}paintView();
},{capture:true});
function releasePointer(e){if(!activePointers.has(e.pointerId))return;activePointers.delete(e.pointerId);if(gestureConsumed){stop(e);if(activePointers.size===1){const point=[...activePointers.values()][0];gesture={kind:'pan',point,view:{...view}}}if(!activePointers.size){gesture=null;preGestureVehicles=null;gestureConsumed=false;drag=null;sync();render()}}else if(!activePointers.size){gesture=null;preGestureVehicles=null}}
stage.addEventListener('lostpointercapture',e=>{if(activePointers.has(e.pointerId))releasePointer(e)},{capture:true});
stage.addEventListener('pointerup',releasePointer,{capture:true});stage.addEventListener('pointercancel',releasePointer,{capture:true});
// Fit after a map, a responsive layout or a fullscreen change. No viewport state is saved in the project.
let fitting=false;const scheduleFit=()=>{if(fitting)return;fitting=true;requestAnimationFrame(()=>{fitting=false;fitView()})};
new ResizeObserver(scheduleFit).observe(stage);new MutationObserver(scheduleFit).observe(c,{attributes:true,attributeFilter:['width','height']});mobileMedia.addEventListener('change',()=>{showPanel('scene');scheduleFit()});scheduleFit();
// Best-effort screen wake lock during exports; lack of browser support does not block saving.
for(const id of ['video','gif']){const original=$(id).onclick;$(id).onclick=async function(e){let lock=null;try{if(navigator.wakeLock&&document.visibilityState==='visible')lock=await navigator.wakeLock.request('screen')}catch(_){}try{await original.call(this,e)}finally{if(lock)try{await lock.release()}catch(_){}}}}

const openProjectOnChange=$('open').onchange;$('open').onchange=async e=>{const before=state;await openProjectOnChange(e);if(state!==before){showPanel('scene');scheduleFit()}};
const openMapOnChange=$('map').onchange;$('map').onchange=async e=>{const before=state.map;await openMapOnChange(e);if(state.map!==before){showPanel('scene');scheduleFit()}};
$('save').addEventListener('click',()=>{if(mobileMedia.matches){showPanel('scene');$('download').scrollIntoView({block:'nearest',behavior:'smooth'})}});

function endPanMode(){pan=false;stage.classList.remove('pan-mode');$('panView').setAttribute('aria-pressed','false');$('panView').textContent='✋ Verschieben';updateMapExit()}
async function openVehicleEditor(){if(!current()||recording)return;await leaveMap();showPanel('properties');if(!mobileMedia.matches)$('propertiesPanel').scrollIntoView({block:'start'})}
$('editVehicle').onclick=openVehicleEditor;$('mapEditVehicle').onclick=openVehicleEditor;
$('mapDrawRoute').onclick=()=>{if(!current()||current().parentId)return;endPanMode();$('routeEdit').click()};

$('rulerStart').addEventListener('click',()=>{if(rulerActive){endPanMode();showPanel('scene')}updateMapExit()});

$('rulerStart').addEventListener('click',()=>{if(!state.metersPerPixel&&$('rulerMode').value!=='angle'){showPanel('project');const d=$('measureMeters').closest('details');if(d)d.open=true;$('measureMeters').focus();status('Maßstabsbalken im Screenshot: Länge in Metern eintragen, dann Strecke auf Karte messen.')}});
