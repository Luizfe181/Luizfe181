const stage=document.querySelector('#vtuber-stage');
const loadButton=document.querySelector('#vtuber-load');
const status=document.querySelector('#vtuber-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const models={joao:{name:'João',file:'modelos/joao.vrm',size:14},ramses:{name:'Ramses',file:'modelos/ramses.vrm',size:12}};
let selected='joao',busy=false,visible=false,cleanup;
const modelButtons=[...document.querySelectorAll('[data-vtuber-model]')];
function selectLabel(){modelButtons.forEach(button=>{button.disabled=busy;button.setAttribute('aria-pressed',String(button.dataset.vtuberModel===selected))});document.querySelector('.vtuber-badge').textContent=models[selected].name.toUpperCase()+' / AVATAR 3D';}
modelButtons.forEach(button=>button.addEventListener('click',()=>{if(busy||selected===button.dataset.vtuberModel)return;selected=button.dataset.vtuberModel;selectLabel();loadAvatar()}));
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting},{threshold:.05}).observe(stage);
loadButton.addEventListener('click',loadAvatar);
async function loadAvatar(){
 if(busy)return;cleanup?.();busy=true;selectLabel();document.querySelectorAll('.vtuber-controls button').forEach(b=>b.disabled=true);loadButton.hidden=true;status.textContent='Preparando o avatar…';
 let renderer,vrm,controls,observer,frameId,disposed=false;
 try{
 const [THREE,{GLTFLoader},{VRMLoaderPlugin,VRMUtils},{OrbitControls}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js'),import('https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.0/lib/three-vrm.module.min.js'),import('three/addons/controls/OrbitControls.js')]);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x596980,1.2));const key=new THREE.DirectionalLight(0xfff5eb,2.2);key.position.set(2,4,4);scene.add(key);const rim=new THREE.DirectionalLight(0xb3eaff,.7);rim.position.set(-3,2,-2);scene.add(rim);
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.loadAsync(models[selected].file,p=>{status.textContent=p.total?'Carregando avatar · '+Math.round(p.loaded/p.total*100)+'%':'Carregando avatar…'});
 vrm=gltf.userData.vrm;if(!vrm)throw Error('Arquivo sem avatar VRM');VRMUtils.rotateVRM0(vrm);VRMUtils.combineSkeletons(vrm.scene);vrm.scene.traverse(o=>o.frustumCulled=false);scene.add(vrm.scene);
 const bone=name=>vrm.humanoid.getNormalizedBoneNode(name);
 const left=bone('leftUpperArm'),right=bone('rightUpperArm'),head=bone('head'),chest=bone('chest');
 // Rest pose: shoulders down, arms beside the torso, elbows slightly bent.
 if(left)left.rotation.set(.06,0,1.43);
 if(right)right.rotation.set(.06,0,-1.43);
 const leftElbow=bone('leftLowerArm'),rightElbow=bone('rightLowerArm');
 if(leftElbow)leftElbow.rotation.set(-.10,0,-.08);
 if(rightElbow)rightElbow.rotation.set(-.10,0,.08);
 vrm.update(0);vrm.scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(vrm.scene);const height=bounds.max.y-bounds.min.y;const center=bounds.getCenter(new THREE.Vector3());
 const camera=new THREE.PerspectiveCamera(32,1,.01,100);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Avatar VTuber '+models[selected].name+'. Arraste para girar e use as setas para mudar o ângulo.');stage.append(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=true;controls.minPolarAngle=Math.PI*.25;controls.maxPolarAngle=Math.PI*.7;controls.minAzimuthAngle=-Math.PI*.65;controls.maxAzimuthAngle=Math.PI*.65;
 let closeup=false,motionPaused=reduced,talking=false,expression='neutral',elapsed=0;
 const gazeTarget=new THREE.Object3D();scene.add(gazeTarget);if(vrm.lookAt)vrm.lookAt.target=gazeTarget;
 let gazeEnabled=!reduced,gazeX=0,gazeY=0,targetX=0,targetY=0,nextGaze=1.6,nextBlink=2.5,blinkStart=-10;
 const gazeButton=document.querySelector('#vtuber-gaze');gazeButton.disabled=false;gazeButton.setAttribute('aria-pressed',String(gazeEnabled));gazeButton.onclick=()=>{gazeEnabled=!gazeEnabled;gazeButton.setAttribute('aria-pressed',String(gazeEnabled))};
 const headOffset=new THREE.Quaternion(),headEuler=new THREE.Euler();
 let headX=0,headY=0;
 // Short phonemes overlap softly; phrase pauses let the lips settle completely.
 const vowels=selected==='ramses'?['aa','ih','ee','ou','oh']:['aa','ih','ee','ou'];
 const mouth=Object.fromEntries(vowels.map(v=>[v,0]));
 const emotion={happy:0,angry:0,sad:0};
 let syllableStart=0,syllableEnd=0,phraseLeft=0,phoneme='aa',strength=.5;
 function updateFace(delta){
  const manager=vrm.expressionManager;
  if(talking && elapsed>=syllableEnd){
   syllableStart=elapsed;
   if(phraseLeft<=0){phraseLeft=5+Math.floor(Math.random()*7);phoneme='';syllableEnd=elapsed+.35+Math.random()*.65;}
   else{phraseLeft--;const choices=vowels.filter(v=>v!==phoneme);phoneme=choices[Math.floor(Math.random()*choices.length)];strength=.28+Math.random()*.32;syllableEnd=elapsed+.11+Math.random()*.16;}
  }
  const phase=THREE.MathUtils.clamp((elapsed-syllableStart)/Math.max(.001,syllableEnd-syllableStart),0,1);
  const envelope=Math.sin(Math.PI*phase)**.65;
  for(const vowel of vowels){
   const target=talking && phoneme===vowel?strength*envelope:0;
   mouth[vowel]=THREE.MathUtils.damp(mouth[vowel],target,target>mouth[vowel]?20:14,delta);
   manager?.setValue(vowel,mouth[vowel]);
  }
  for(const name of Object.keys(emotion)){
   emotion[name]=THREE.MathUtils.damp(emotion[name],expression===name?(talking?.38:.75):0,8,delta);
   manager?.setValue(name,emotion[name]);
  }
  const blinkTime=elapsed-blinkStart;
  manager?.setValue('blink',blinkTime>=0&&blinkTime<.19?Math.sin(blinkTime/.19*Math.PI):0);
 }


 function frameCamera(){const aspect=stage.clientWidth/stage.clientHeight;camera.aspect=aspect;const targetY=closeup?bounds.min.y+height*.82:center.y;const distance=(closeup?height*.37:height*.61)/Math.tan(THREE.MathUtils.degToRad(16))/Math.min(1,aspect);camera.position.set(center.x,targetY,distance+center.z);controls.target.set(center.x,targetY,center.z);camera.updateProjectionMatrix();controls.update();}
 observer=new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);frameCamera()});observer.observe(stage);renderer.setSize(stage.clientWidth,stage.clientHeight);frameCamera();
 renderer.domElement.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),event.key==='ArrowLeft'?-.12:.12);camera.position.copy(controls.target).add(offset);controls.update()});
 const expressions=[...document.querySelectorAll('[data-expression]')];expressions.forEach(button=>{button.disabled=false;button.setAttribute('aria-pressed',String(button.dataset.expression==='neutral'));button.onclick=()=>{expression=button.dataset.expression;expressions.forEach(b=>b.setAttribute('aria-pressed',String(b===button)))}});
 const motionButton=document.querySelector('#vtuber-motion');motionButton.disabled=false;function motionLabel(){motionButton.textContent=motionPaused?'Ativar movimento':'Pausar movimento';motionButton.setAttribute('aria-pressed',String(motionPaused))}motionLabel();motionButton.onclick=()=>{motionPaused=!motionPaused;motionLabel()};
 const talkButton=document.querySelector('#vtuber-talk');talkButton.disabled=false;talkButton.textContent='Simular fala';talkButton.setAttribute('aria-pressed','false');talkButton.onclick=()=>{talking=!talking;if(talking){syllableEnd=elapsed;phraseLeft=7;}talkButton.setAttribute('aria-pressed',String(talking));talkButton.textContent=talking?'Parar fala':'Simular fala'};
 const cameraButton=document.querySelector('#vtuber-camera');cameraButton.disabled=false;cameraButton.textContent='Ver rosto';cameraButton.setAttribute('aria-pressed','false');cameraButton.onclick=()=>{closeup=!closeup;cameraButton.setAttribute('aria-pressed',String(closeup));cameraButton.textContent=closeup?'Corpo inteiro':'Ver rosto';frameCamera()};
 stage.querySelector('.vtuber-placeholder')?.remove();busy=false;selectLabel();status.textContent='Arraste para girar · experimente as expressões';
 let last=performance.now();function animate(now){if(disposed)return;frameId=requestAnimationFrame(animate);if(now-last<1000/30)return;const delta=Math.min((now-last)/1000,.06);last=now;if(!visible||document.hidden)return;controls.update();
 if(!motionPaused){elapsed+=delta;
 if(elapsed>=nextGaze){nextGaze=elapsed+2.2+Math.random()*2.8;targetX=Math.random()<.45?0:(Math.random()<.5?-1:1)*(.35+Math.random()*.5);targetY=(Math.random()-.5)*.16;}
 if(elapsed>=nextBlink){blinkStart=elapsed;nextBlink=elapsed+2.8+Math.random()*3.7;}
 }
 const gx=gazeEnabled?targetX:0,gy=gazeEnabled?targetY:0;
 if(!motionPaused){gazeX=THREE.MathUtils.damp(gazeX,gx,7,delta);gazeY=THREE.MathUtils.damp(gazeY,gy,7,delta);headX=THREE.MathUtils.damp(headX,gazeX,2.4,delta);headY=THREE.MathUtils.damp(headY,gazeY,2.4,delta);}
 gazeTarget.position.set(center.x+gazeX*height,bounds.min.y+height*(.85+gazeY),center.z+height*2.5);
 if(head&&!motionPaused){headEuler.set(-headY*.25,-headX*.22,Math.sin(elapsed*.55)*.012);headOffset.setFromEuler(headEuler);head.quaternion.copy(headOffset);}
 updateFace(motionPaused?0:delta);vrm.update(motionPaused?0:delta);renderer.render(scene,camera)}frameId=requestAnimationFrame(animate);
 function onPageHide(event){if(!event.persisted)cleanup?.()}
 cleanup=()=>{disposed=true;cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();VRMUtils.deepDispose(vrm.scene);renderer.dispose();renderer.domElement.remove();window.removeEventListener('pagehide',onPageHide);cleanup=null;};
 window.addEventListener('pagehide',onPageHide);
 }catch(error){console.error('Falha na demonstração VTuber',error);cancelAnimationFrame(frameId);observer?.disconnect();controls?.dispose();renderer?.dispose();renderer?.domElement.remove();busy=false;selectLabel();loadButton.hidden=false;loadButton.textContent='Tentar novamente';status.textContent='Não foi possível carregar o avatar. Tente novamente.'}
}
