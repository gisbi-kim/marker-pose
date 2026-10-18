"use strict";
const $=id=>document.getElementById(id), canvas=$("view"),ctx=canvas.getContext("2d",{willReadFrequently:true});
const dictionary=new AR.Dictionary("ARUCO_MIP_36h12"),detector=new AR.Detector({dictionaryName:"ARUCO_MIP_36h12",maxHammingDistance:2});
let stream=null,raf=null,last=null,sourceKind="none",lastTime=0,busy=false;
function number(id){const el=$(id);const v=Number(el.value);if(el.value===""||!Number.isFinite(v)||!el.checkValidity())throw new Error("입력값을 확인해: "+el.parentElement.textContent.trim());return v;}
function config(){return {size:number("size")/1000,id:number("markerId")};}
function intrinsics(w,h){
 if($("mode").value==="calibrated"){const sx=w/number("kw"),sy=h/number("kh");return {fx:number("fx")*sx,fy:number("fy")*sy,cx:number("cx")*sx,cy:number("cy")*sy};}
 const f=w/(2*Math.tan(number("fov")*Math.PI/360));return {fx:f,fy:f,cx:w/2,cy:h/2};
}
function clearPose(text="검출된 마커를 기다리는 중"){
 last=null;["distance","tx","ty","tz","roll","pitch","yaw","matrix"].forEach(id=>$(id).textContent="—");$("tag").textContent="NO MARKER";$("quality").textContent=text;$("export").disabled=true;
}
function show(){
 if(!last)return;const pose=$("direction").value==="inverse"?PoseMath.inverse(last.pose):last.pose;
 $("distance").textContent=Math.hypot(...pose.t).toFixed(3);
 ["tx","ty","tz"].forEach((id,i)=>$(id).textContent=pose.t[i].toFixed(3));
 PoseMath.euler(pose.R).forEach((v,i)=>$(["roll","pitch","yaw"][i]).textContent=v.toFixed(1));
 $("matrix").textContent=PoseMath.matrix(pose).map(row=>row.map(v=>(v>=0?" ":"")+v.toFixed(5)).join("  ")).join("\n");
 $("tag").textContent="ID "+last.id;$("export").disabled=false;
 const ambiguity=last.pose.alternativeError!==null&&last.pose.alternativeError-last.pose.error<.5;
 $("quality").textContent=(last.kind==="sample"?"SAMPLE · ":"")+"재투영 RMS "+last.pose.error.toFixed(2)+" px"+(ambiguity?" · 평면 회전 모호성 주의":"")+" · "+(last.mode==="synthetic"?"합성 K":last.mode==="fov"?"근사 K":"입력 K, 왜곡 미보정");
}
function drawOutline(corners){
 ctx.strokeStyle="#c9f485";ctx.lineWidth=3;ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
 corners.forEach((p,i)=>{ctx.fillStyle=i===0?"#fff":"#c9f485";ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();});
}
function drawAxes(pose,K,size){
 const origin=PoseMath.project([0,0,0],pose,K);
 [[size*.55,0,0],[0,size*.55,0],[0,0,-size*.55]].forEach((P,i)=>{
 const end=PoseMath.project(P,pose,K);if(end.z<=0)return;ctx.strokeStyle=["#ff7979","#8af19b","#80b9ff"][i];ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.font="bold 17px monospace";ctx.fillText(["+X","+Y","−Z"][i],end.x+4,end.y-4);
 });
}
function process(Koverride){
 const c=config(),K=Koverride||intrinsics(canvas.width,canvas.height);
 const markers=detector.detect(ctx.getImageData(0,0,canvas.width,canvas.height));
 const marker=markers.find(m=>m.id===c.id);
 $("resolution").textContent="처리 영상: "+canvas.width+" × "+canvas.height+" · fx "+K.fx.toFixed(1)+" / fy "+K.fy.toFixed(1)+" px";
 if(!marker){clearPose(markers.length?"다른 ID 검출: "+markers.map(m=>m.id).join(", "):"마커를 찾지 못했어. 밝기·크기·ID를 확인해.");$("status").textContent="마커 탐색 중";return false;}
 drawOutline(marker.corners);
 try{
 const pose=PoseMath.estimate(marker.corners,c.size,K,POS.Posit);
 if(pose.error>8)throw new Error("재투영 오차가 커. 마커를 더 선명하게 보여줘.");
 last={pose,id:marker.id,size_m:c.size,K,kind:sourceKind,mode:Koverride?"synthetic":$("mode").value,time:new Date().toISOString(),image:{width:canvas.width,height:canvas.height}};
 drawAxes(pose,K,c.size);show();$("status").textContent=sourceKind==="sample"?"샘플 검출 성공":"추적 중";return true;
 }catch(e){clearPose(e.message);$("status").textContent="Pose 불안정";return false;}
}
function reveal(){canvas.style.display="block";$("empty").hidden=true;}
function stopCamera(){
 if(raf!==null)cancelAnimationFrame(raf);raf=null;
 if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$("video").srcObject=null;
 $("start").disabled=false;$("stop").disabled=true;
}
function frame(time){
 if(!stream)return;
 if(time-lastTime>90&&$("video").readyState>=2){
 lastTime=time;const v=$("video");const scale=Math.min(1,960/v.videoWidth);
 canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);
 ctx.drawImage(v,0,0,canvas.width,canvas.height);
 try{process();}catch(e){clearPose(e.message);$("status").textContent="입력값 확인";}
 }
 raf=requestAnimationFrame(frame);
}
$("start").onclick=async()=>{
 if(busy)return;busy=true;$("start").disabled=true;stopCamera();$("start").disabled=true;clearPose();sourceKind="camera";
 try{
 config();if(!navigator.mediaDevices?.getUserMedia)throw new Error("HTTPS에서 Safari 또는 Chrome으로 열어줘.");
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
 $("video").srcObject=stream;await $("video").play();reveal();$("stop").disabled=false;
 $("message").textContent="후면 카메라에서 지정한 마커를 찾는 중. 입력 크기는 검은 정사각형 한 변이야.";
 raf=requestAnimationFrame(frame);
 }catch(e){stopCamera();$("status").textContent="카메라 시작 실패";$("message").textContent=e.name==="NotAllowedError"?"카메라 권한을 허용한 뒤 다시 시작해. 앱 내 브라우저라면 Safari/Chrome으로 열어줘.":e.message;}
 finally{busy=false;}
};
$("stop").onclick=()=>{stopCamera();clearPose("측정 중지");$("status").textContent="중지됨";};
function saveText(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function markerSVG(){
 const c=config(),total=c.size*1000*10/8;
 return dictionary.generateSVG(c.id).replace("<svg ", '<svg width="'+total+'mm" height="'+total+'mm" shape-rendering="crispEdges" ');
}
function updateMarker(){try{$("marker").innerHTML=markerSVG();}catch(e){$("message").textContent=e.message;}}
$("download").onclick=()=>{try{saveText("ARUCO_MIP_36h12-"+config().id+"-"+number("size")+"mm.svg",markerSVG(),"image/svg+xml");}catch(e){$("message").textContent=e.message;}};
$("print").onclick=()=>{try{if(number("size")>150)throw new Error("A4 인쇄는 한 변 150 mm 이하를 권장해. 큰 마커는 SVG로 저장해.");$("printArea").innerHTML=markerSVG()+"<p>ARUCO_MIP_36h12 · ID "+config().id+" · Black square: "+number("size")+" mm</p><p>Print at 100% scale. Measure the black square after printing.</p>";window.print();}catch(e){$("message").textContent=e.message;}};
$("direction").onchange=show;
$("mode").onchange=()=>{const manual=$("mode").value==="calibrated";$("fovFields").hidden=manual;$("kFields").hidden=!manual;$("modeBadge").textContent=manual?"INPUT K":"APPROXIMATE";clearPose("설정 변경됨. 새 프레임 또는 사진을 측정해.");};
["size","markerId","fov","fx","fy","cx","cy","kw","kh"].forEach(id=>$(id).addEventListener("input",()=>{clearPose("설정 변경됨. 새 프레임 또는 사진을 측정해.");if(id==="size"||id==="markerId")updateMarker();}));
$("export").onclick=()=>{if(!last)return;const pose=$("direction").value==="inverse"?PoseMath.inverse(last.pose):last.pose;saveText("marker-pose.json",JSON.stringify({...last,transform:$("direction").value==="inverse"?"T_marker_camera":"T_camera_marker",matrix:PoseMath.matrix(pose),translation_m:pose.t,rotation:pose.R,euler_zyx_deg:PoseMath.euler(pose.R),camera_axes:"x right, y down, z forward",marker_axes:"x right, y down, z into marker",distortion_corrected:false},null,2),"application/json");};
$("photo").onchange=async e=>{
 const file=e.target.files[0];if(!file)return;stopCamera();clearPose();sourceKind="photo";
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();const s=Math.min(1,1280/img.width);canvas.width=Math.round(img.width*s);canvas.height=Math.round(img.height*s);ctx.drawImage(img,0,0,canvas.width,canvas.height);reveal();process();$("message").textContent="사진 측정 · 사진에 사용된 카메라의 화각 또는 K를 입력해야 정확해.";}
 catch(err){$("message").textContent="사진을 읽거나 측정할 수 없어: "+err.message;}finally{URL.revokeObjectURL(url);e.target.value="";}
};
$("test").onclick=async()=>{
 stopCamera();clearPose();sourceKind="sample";
 try{
 const c=config(),img=new Image();img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(dictionary.generateSVG(c.id));await img.decode();
 canvas.width=640;canvas.height=480;ctx.fillStyle="#fff";ctx.fillRect(0,0,640,480);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,220,140,200,200);reveal();
 const ok=process({fx:700,fy:700,cx:320,cy:240});const expected=c.size*700/160;
 const passed=ok&&Math.abs(last.pose.t[2]-expected)/expected<.03;
 $("message").textContent=(passed?"PASS":"FAIL")+" · 합성 마커 검출 + pose 테스트. 기대 Z = "+expected.toFixed(3)+" m. 실제 카메라 측정이 아니야.";
 $("status").textContent=passed?"SAMPLE · PASS":"SAMPLE · FAIL";
 }catch(e){$("message").textContent="샘플 테스트 실패: "+e.message;}
};
document.addEventListener("visibilitychange",()=>{if(document.hidden&&stream){stopCamera();clearPose("백그라운드로 이동하여 카메라를 중지했어.");$("status").textContent="중지됨";}});
window.addEventListener("pagehide",stopCamera);
updateMarker();
