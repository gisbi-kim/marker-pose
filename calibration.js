"use strict";
window.Calibration=(()=>{
 const C=CalibrationCore,KEY="marker-pose-calibration-v1";
 let collecting=false,views=[],previous=null,capturedAt=0,sessionSignature=null,sessionSize=null,result=null,saved=null,worker=null,workerTimer=null,working=false;
 try{saved=JSON.parse(localStorage.getItem(KEY)||"null");}catch{}
 const msg=text=>$("calStatus").textContent=text;
 const signature=()=>{const s=stream?.getVideoTracks()[0]?.getSettings()||{};return {deviceId:s.deviceId||"",width:$("video").videoWidth,height:$("video").videoHeight,zoom:s.zoom??1};};
 const matches=(a,b)=>a&&b&&a.deviceId!==""&&a.deviceId===b.deviceId&&a.width===b.width&&a.height===b.height&&a.zoom===b.zoom;
 const busyUI=b=>{working=b;["calStart","calSolve","calTest","calApply"].forEach(id=>$(id).disabled=b);$("calCancel").disabled=!b;updateButtons();};
 function updateButtons(){$("calSolve").disabled=working||!!C.quality(views);$("calApply").disabled=working||!result||result.synthetic;}
 function pause(){if(collecting){collecting=false;previous=null;msg("수집 중지 · "+views.length+"개 시점 보관. 충분하면 보정 계산을 눌러줘.");updateButtons();}}
 function KFor(w,h){
 if(!saved)throw new Error("저장된 보정값이 없어. 먼저 보정을 실행해.");
 if(sourceKind!=="camera"||!matches(saved.signature,signature()))throw new Error("저장된 보정과 카메라·해상도·줌이 달라. 같은 설정으로 시작하거나 다시 보정해.");
 const sx=w/saved.imageSize.width,sy=h/saved.imageSize.height;
 return {fx:saved.K[0][0]*sx,fy:saved.K[1][1]*sy,cx:saved.K[0][2]*sx,cy:saved.K[1][2]*sy,dist:[...saved.dist]};
 }
 function onCamera(){if(saved&&matches(saved.signature,signature())){$("mode").value="profile";$("mode").onchange();msg("이 카메라 설정의 저장된 보정값을 적용했어.");}}
 function normal(markers,w,h){const m=markers.find(m=>m.id===0);const pose=PoseMath.estimate(m.corners,.035,{fx:w,fy:w,cx:w/2,cy:h/2},POS.Posit);return [pose.R[0][2],pose.R[1][2],pose.R[2][2]];}
 function sharpness(image,points){
 const {data,width,height}=image;let sum=0,n=0;
 for(const p of points){const x0=Math.round(p[0]),y0=Math.round(p[1]);for(let dy=-4;dy<=4;dy+=2)for(let dx=-4;dx<=4;dx+=2){const x=x0+dx,y=y0+dy;if(x<1||y<1||x>=width-1||y>=height-1)continue;const i=(y*width+x)*4;const lap=4*data[i]-data[i-4]-data[i+4]-data[i-width*4]-data[i+width*4];sum+=lap*lap;n++;}}
 return n?sum/n:0;
 }
 function capture(markers,image){
 if(!collecting)return;
 const corr=C.correspondences(markers);
 if(!matches(sessionSignature,signature())||image.width!==sessionSize.width||image.height!==sessionSize.height){pause();msg("카메라 설정이 달라졌어. 처음부터 다시 수집해.");return;}
 markers.filter(m=>m.id<12).forEach(m=>drawOutline(m.corners));
 if(!corr){previous=null;msg("보드 전체를 보여줘 · "+markers.filter(m=>m.id<12).length+"/12 마커 · "+views.length+"/24 시점");return;}
 const points=corr.imagePoints,w=image.width,h=image.height;
 const minEdge=Math.min(...markers.filter(m=>m.id<12).flatMap(m=>m.corners.map((p,i)=>Math.hypot(p.x-m.corners[(i+1)%4].x,p.y-m.corners[(i+1)%4].y))));
 if(minEdge<28||points.some(p=>p[0]<10||p[0]>w-10||p[1]<10||p[1]>h-10)){previous=null;msg("보드를 더 크게, 네 가장자리가 잘리지 않게 보여줘.");return;}
 if(sharpness(image,points)<150){previous=null;msg("영상이 흐려. 밝은 곳에서 잠깐 멈춰줘.");return;}
 const fp=C.fingerprint(points,w,h),now=performance.now();
 const stable=previous&&C.difference(fp,previous)<.006;previous=fp;
 if(!stable){msg("현재 자세에서 잠깐 멈춰줘 · "+views.length+"/24");return;}
 if(now-capturedAt<1000)return;
 let n;try{n=normal(markers,w,h);}catch{return;}
 if(views.some(v=>C.difference(v.fingerprint,fp)<.035&&Math.hypot(n[0]-v.normal[0],n[1]-v.normal[1])<.13)){msg("새로운 위치·기울기로 움직여줘 · "+views.length+"/24");return;}
 const center=[points.reduce((s,p)=>s+p[0],0)/points.length/w,points.reduce((s,p)=>s+p[1],0)/points.length/h];
 views=[...views,{...corr,fingerprint:fp,normal:n,center}];capturedAt=now;
 $("calCount").textContent=views.length+" / 24";$("calProgress").value=views.length;
 const issue=C.quality(views);msg("시점 "+views.length+" 수집 ✓ · "+(issue||"각도·위치 다양성 확보. 보정 계산을 눌러도 돼."));updateButtons();
 if(views.length>=24&&!issue){collecting=false;solve(false);}
 if(views.length>=36){collecting=false;msg(issue||"수집 완료. 보정 계산을 눌러줘.");}
 }
 function runWorker(payload){
 clearTimeout(workerTimer);if(worker)worker.terminate();worker=new Worker("calibration-worker.js?v=2",{type:"module"});busyUI(true);
 workerTimer=setTimeout(()=>{worker?.terminate();worker=null;busyUI(false);msg("계산 시간이 초과됐어. 네트워크를 확인하고 다시 시도해.");},120000);
 worker.onmessage=({data})=>{
 if(data.type==="progress"){msg(data.message);return;}
 clearTimeout(workerTimer);
 if(data.type==="result"){result={...data.result,signature:payload.synthetic?null:sessionSignature,createdAt:new Date().toISOString()};
 let suffix="";
 if(payload.synthetic){const K=result.K,expected=payload.expectedK;const err=Math.max(Math.abs(K[0][0]/expected[0][0]-1),Math.abs(K[1][1]/expected[1][1]-1),Math.abs(K[0][2]-expected[0][2])/payload.imageSize.width,Math.abs(K[1][2]-expected[1][2])/payload.imageSize.height);const distErr=Math.max(...result.dist.slice(0,4).map((v,i)=>Math.abs(v-payload.expectedDist[i])));suffix=err<.01&&distErr<.02?" · SYNTHETIC PASS":" · SYNTHETIC FAIL";result.testPassed=err<.01&&distErr<.02;}
 $("calResult").textContent=(payload.synthetic?"합성 테스트 (저장 불가)\n":"측정 결과 (아직 미적용)\n")+result.K.map(r=>r.map(v=>v.toFixed(3)).join("  ")).join("\n")+"\nd = "+result.dist.map(v=>v.toFixed(6)).join(", ")+"\n학습 RMS: "+result.trainRms.toFixed(3)+" px / 검증 RMS: "+result.validationRms.toFixed(3)+" px"+suffix;
 msg(payload.synthetic?suffix+" · 보정 최적화 검증. 실제 폰 보정값이 아니야.":"보정 계산 완료. 결과를 확인하고 저장·적용을 눌러줘.");
 }else{msg("보정 실패: "+data.message);}
 worker?.terminate();worker=null;busyUI(false);
 };
 worker.onerror=e=>{clearTimeout(workerTimer);worker?.terminate();worker=null;busyUI(false);msg("보정 엔진을 실행하지 못했어: "+e.message);};
 worker.postMessage(payload);
 }
 function solve(synthetic){
 const issue=C.quality(views);if(issue){msg(issue);return;}collecting=false;
 runWorker({type:"calibrate",views,imageSize:sessionSize,synthetic});
 }
 $("calBoard").onclick=()=>saveText("marker-pose-calibration-board.svg",C.boardSVG(dictionary),"image/svg+xml");
 $("calPrint").onclick=()=>{$("printArea").innerHTML=C.boardSVG(dictionary);window.print();};
 $("calStart").onclick=async()=>{
 if(working)return;if(!stream)await $("start").onclick();if(!stream)return;
 result=null;views=[];previous=null;capturedAt=0;sessionSignature=signature();const s=Math.min(1,960/$("video").videoWidth);sessionSize={width:Math.round($("video").videoWidth*s),height:Math.round($("video").videoHeight*s)};
 collecting=true;clearPose("카메라 보정 수집 중");$("calCount").textContent="0 / 24";$("calProgress").value=0;$("calResult").textContent="—";updateButtons();msg("12개 마커 보드 전체를 보여줘. 폰 또는 보드를 움직이고 잠깐씩 멈추면 자동 수집돼.");
 };
 $("calPause").onclick=pause;
 $("calSolve").onclick=()=>solve(false);
 $("calCancel").onclick=()=>{clearTimeout(workerTimer);worker?.terminate();worker=null;busyUI(false);msg("보정 계산 취소됨. 수집한 시점은 유지돼.");};
 $("calApply").onclick=()=>{
 if(!result||result.synthetic)return;
 saved={...result};try{localStorage.setItem(KEY,JSON.stringify(saved));msg("이 폰 브라우저에 보정값 저장 완료. 같은 카메라 설정에서 자동 적용돼.");}catch{msg("브라우저 저장이 차단됐어. 이번 세션에만 적용돼. JSON으로 백업해.");}
 $("mode").value="profile";$("mode").onchange();clearPose("보정 적용 완료. 마커를 비춰줘.");$("calSaved").textContent="저장됨 · "+new Date(saved.createdAt).toLocaleString();$("calExport").disabled=false;
 };
 $("calExport").onclick=()=>{if(!saved)return;const {signature:device,...publicData}=saved;saveText("camera-calibration.json",JSON.stringify({...publicData,capture:{width:device.width,height:device.height,zoom:device.zoom}},null,2),"application/json");};
 $("calTest").onclick=()=>{
 pause();result=null;const K={fx:850,fy:830,cx:470,cy:350,dist:[-.13,.035,.001,-.001,0]},w=960,h=720;
 const objectPoints=Array.from({length:12},(_,id)=>C.objectPoints(id)).flat();
 const syntheticViews=Array.from({length:24},(_,i)=>{
 const R=C.rodrigues([((i%4)-1.5)*.25,(Math.floor(i/4)%3-1)*.35,(i%3-1)*.09]);
 const t=[-.0625+((i%3)-1)*.09,-.085+(Math.floor(i/3)%3-1)*.065,.42+(i%4)*.045];
 const imagePoints=objectPoints.map(P=>{const p=PoseMath.project(P,{R,t},K);return [p.x,p.y];});
 return {objectPoints:objectPoints.map(p=>[...p]),imagePoints};
 });
 runWorker({type:"calibrate",views:syntheticViews,imageSize:{width:w,height:h},synthetic:true,expectedK:[[850,0,470],[0,830,350],[0,0,1]],expectedDist:K.dist});
 };
 $("calSaved").textContent=saved?"저장값 있음 · 같은 카메라 설정에서 적용":"저장된 보정 없음";$("calExport").disabled=!saved;
 updateButtons();
 return {capture,isCollecting:()=>collecting,pause,KFor,onCamera};
})();

