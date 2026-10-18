/* OpenCV calibration in a dedicated worker: no images or observations leave device. */
let enginePromise;
async function engine(){
 if(!enginePromise)enginePromise=import("https://cdn.jsdelivr.net/npm/@deluksic/opencv-calibration-wasm@0.2.5/dist/index.js").then(m=>m.initCalibrator({wasmPath:"https://cdn.jsdelivr.net/npm/@deluksic/opencv-calibration-wasm@0.2.5/dist/wasm/calibrate.wasm"}));
 return enginePromise;
}
const rms=(a,b)=>Math.sqrt(a.reduce((s,p,i)=>s+(p[0]-b[i][0])**2+(p[1]-b[i][1])**2,0)/a.length);
self.onmessage=async({data})=>{
 try{
 self.postMessage({type:"progress",message:"OpenCV WASM 로딩 중… (최초 1회 다운로드)"});
 const cv=await engine();
 if(data.type==="load"){self.postMessage({type:"ready"});return;}
 const train=data.views.filter((_,i)=>i%5!==4),held=data.views.filter((_,i)=>i%5===4);
 self.postMessage({type:"progress",message:"LM 최적화 중… "+train.length+"개 학습 시점 / "+held.length+"개 검증 시점"});
 const result=cv.calibrateCameraRO({objectPoints:train.map(v=>v.objectPoints),imagePoints:train.map(v=>v.imagePoints),imageSize:data.imageSize,iFixedPoint:-1,flags:128,maxDistCoeffs:5,criteria:{type:3,maxCount:100,epsilon:1e-9}});
 const K=result.cameraMatrix,d=result.distortionCoefficients;
 if(![...K.flat(),...d,result.reprojectionErrorPx].every(Number.isFinite)||result.reprojectionErrorPx<0)throw new Error("최적화 실패. 다양한 각도로 다시 촬영해.");
 const projected=cv.projectPoints({objectPoints:train.map(v=>v.objectPoints),rvecs:result.rvecs,tvecs:result.tvecs,cameraMatrix:K,distortionCoefficients:d}).projectedImagePoints;
 const trainErrors=train.map((v,i)=>rms(v.imagePoints,projected[i]));
 const heldErrors=held.map(v=>{const p=cv.solvePnP({objectPoints:v.objectPoints,imagePoints:v.imagePoints,cameraMatrix:K,distortionCoefficients:d,flags:0});if(!p.success||p.tvec[2]<=0)throw new Error("검증 pose 추정 실패");return rms(v.imagePoints,cv.projectPoints({objectPoints:[v.objectPoints],rvecs:[p.rvec],tvecs:[p.tvec],cameraMatrix:K,distortionCoefficients:d}).projectedImagePoints[0]);});
 const validationRms=Math.sqrt(heldErrors.reduce((s,x)=>s+x*x,0)/heldErrors.length);
 const w=data.imageSize.width,h=data.imageSize.height;
 if(result.reprojectionErrorPx>1.5||validationRms>2)throw new Error("재투영 오차가 큼: 학습 "+result.reprojectionErrorPx.toFixed(2)+" px / 검증 "+validationRms.toFixed(2)+" px. 평평한 보드와 선명한 영상으로 다시 수집해.");
 if(K[0][0]<.25*w||K[0][0]>4*w||K[1][1]<.25*w||K[1][1]>4*w||K[0][2]<.1*w||K[0][2]>.9*w||K[1][2]<.1*h||K[1][2]>.9*h||Math.abs(K[0][0]/K[1][1]-1)>.2)throw new Error("비현실적인 K. 렌즈/줌을 고정하고 시점을 다양하게 수집해.");
 const radius=Math.max(...[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>Math.hypot((x-K[0][2])/K[0][0],(y-K[1][2])/K[1][1])));
 for(let i=0;i<=30;i++){const r=radius*i/30,r2=r*r;if(1+3*(d[0]||0)*r2+5*(d[1]||0)*r2*r2+7*(d[4]||0)*r2*r2*r2<.15)throw new Error("왜곡 모델이 영상 가장자리에서 불안정해. 가장자리 시점을 추가해.");}
 self.postMessage({type:"result",result:{K,dist:d,trainRms:result.reprojectionErrorPx,validationRms,trainErrors,heldErrors,imageSize:data.imageSize,viewCount:data.views.length,engine:"OpenCV calibrateCameraRO / fixed board / LM",model:"Brown-Conrady k1,k2,p1,p2; k3=0; skew=0",synthetic:!!data.synthetic}});
 }catch(e){enginePromise=undefined;self.postMessage({type:"error",message:String(e.message||e)});}
};

