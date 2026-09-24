const stage=document.querySelector('#vtuber-stage');
const loadButton=document.querySelector('#vtuber-load');
const status=document.querySelector('#vtuber-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let busy=false,visible=false;
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting},{threshold:.05}).observe(stage);
loadButton.addEventListener('click',async()=>{
 if(busy)return;busy=true;loadButton.hidden=true;status.textContent='Preparando o avatar…';
 let renderer,vrm,controls,observer,frameId,disposed=false;
 try{
 const [THREE,{GLTFLoader},{VRMLoaderPlugin,VRMUtils},{OrbitControls}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js'),import('https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.0/lib/three-vrm.module.min.js'),import('three/addons/controls/OrbitControls.js')]);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x596980,1.2));const key=new THREE.DirectionalLight(0xfff5eb,2.2);key.position.set(2,4,4);scene.add(key);const rim=new THREE.DirectionalLight(0xb3eaff,.7);rim.position.set(-3,2,-2);scene.add(rim);
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.loadAsync('modelos/joao.vrm',p=>{status.textContent=p.total?'Carregando avatar · '+Math.round(p.loaded/p.total*100)+'%':'Carregando avatar…'});
 vrm=gltf.userData.vrm;if(!vrm)throw Error('Arquivo sem avatar VRM');VRMUtils.rotateVRM0(vrm);VRMUtils.combineSkeletons(vrm.scene);vrm.scene.traverse(o=>o.frustumCulled=false);scene.add(vrm.scene);
 const bone=name=>vrm.humanoid.getNormalizedBoneNode(name);
 const left=bone('leftUpperArm'),right=bone('rightUpperArm'),head=bone('head'),chest=bone('chest');
 if(left)left.rotation.z=1.15;if(right)right.rotation.z=-1.15;vrm.update(0);vrm.scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(vrm.scene);const height=bounds.max.y-bounds.min.y;const center=bounds.getCenter(new THREE.Vector3());
 const camera=new THREE.PerspectiveCamera(32,1,.01,100);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Avatar VTuber João. Arraste para girar e use as setas para mudar o ângulo.');stage.append(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableZoom=false;controls.enableDamping=true;controls.minPolarAngle=Math.PI*.25;controls.maxPolarAngle=Math.PI*.7;controls.minAzimuthAngle=-Math.PI*.65;controls.maxAzimuthAngle=Math.PI*.65;
 let closeup=false,motionPaused=reduced,talking=false,expression='neutral',elapsed=0;
 function frameCamera(){const aspect=stage.clientWidth/stage.clientHeight;camera.aspect=aspect;const targetY=closeup?bounds.min.y+height*.82:center.y;const distance=(closeup?height*.37:height*.61)/Math.tan(THREE.MathUtils.degToRad(16))/Math.min(1,aspect);camera.position.set(center.x,targetY,distance+center.z);controls.target.set(center.x,targetY,center.z);camera.updateProjectionMatrix();controls.update();}
 observer=new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);frameCamera()});observer.observe(stage);renderer.setSize(stage.clientWidth,stage.clientHeight);frameCamera();
 renderer.domElement.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),event.key==='ArrowLeft'?-.12:.12);camera.position.copy(controls.target).add(offset);controls.update()});
 const expressions=[...document.querySelectorAll('[data-expression]')];expressions.forEach(button=>{button.disabled=false;button.onclick=()=>{expression=button.dataset.expression;expressions.forEach(b=>b.setAttribute('aria-pressed',String(b===button)))}});
 const motionButton=document.querySelector('#vtuber-motion');motionButton.disabled=false;function motionLabel(){motionButton.textContent=motionPaused?'Ativar movimento':'Pausar movimento';motionButton.setAttribute('aria-pressed',String(motionPaused))}motionLabel();motionButton.onclick=()=>{motionPaused=!motionPaused;motionLabel()};
 const talkButton=document.querySelector('#vtuber-talk');talkButton.disabled=false;talkButton.onclick=()=>{talking=!talking;talkButton.setAttribute('aria-pressed',String(talking));talkButton.textContent=talking?'Parar fala':'Simular fala'};
 const cameraButton=document.querySelector('#vtuber-camera');cameraButton.disabled=false;cameraButton.onclick=()=>{closeup=!closeup;cameraButton.setAttribute('aria-pressed',String(closeup));cameraButton.textContent=closeup?'Corpo inteiro':'Ver rosto';frameCamera()};
 stage.querySelector('.vtuber-placeholder').remove();status.textContent='Arraste para girar · experimente as expressões';
 let last=performance.now();function animate(now){if(disposed)return;frameId=requestAnimationFrame(animate);const delta=Math.min((now-last)/1000,.05);last=now;if(!visible||document.hidden)return;controls.update();if(!motionPaused)elapsed+=delta;
 if(head){head.rotation.y=motionPaused?0:Math.sin(elapsed*.65)*.12;head.rotation.z=motionPaused?0:Math.sin(elapsed*.8)*.025}if(chest)chest.rotation.z=motionPaused?0:Math.sin(elapsed*.8)*.018;
 const manager=vrm.expressionManager;['happy','angry','sad','aa','blink'].forEach(name=>manager?.setValue(name,0));if(expression!=='neutral')manager?.setValue(expression,.85);if(!motionPaused){const blink=elapsed%4.6;manager?.setValue('blink',blink<.18?Math.sin(blink/.18*Math.PI):0)}if(talking)manager?.setValue('aa',motionPaused ? .55 : (Math.sin(elapsed*13)+1)*.35);vrm.update(motionPaused?0:delta);renderer.render(scene,camera)}frameId=requestAnimationFrame(animate);
 window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frameId);observer.disconnect();controls.dispose();VRMUtils.deepDispose(vrm.scene);renderer.dispose()},{once:true});
 }catch(error){console.error('Falha na demonstração VTuber',error);cancelAnimationFrame(frameId);observer?.disconnect();controls?.dispose();renderer?.dispose();renderer?.domElement.remove();busy=false;loadButton.hidden=false;loadButton.textContent='Tentar novamente';status.textContent='Não foi possível carregar o avatar. Tente novamente.'}
});

