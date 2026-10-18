const assert=require('node:assert/strict');
const M=require('./pose.js');const POS=require('./vendor/posit1.js').POS;const AR=require('./vendor/aruco.js').AR;
const K={fx:820,fy:790,cx:330,cy:230};
const ax=.22,ay=-.35,az=.17;
const mul=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,i)=>s+v*B[i][j],0)));
const Rx=[[1,0,0],[0,Math.cos(ax),-Math.sin(ax)],[0,Math.sin(ax),Math.cos(ax)]];
const Ry=[[Math.cos(ay),0,Math.sin(ay)],[0,1,0],[-Math.sin(ay),0,Math.cos(ay)]];
const Rz=[[Math.cos(az),-Math.sin(az),0],[Math.sin(az),Math.cos(az),0],[0,0,1]];
for(const truth of [{R:[[1,0,0],[0,1,0],[0,0,1]],t:[0,0,.6]},{R:mul(mul(Rz,Ry),Rx),t:[.04,-.025,.7]}]){
 const corners=M.model(.1).map(p=>M.project(p,truth,K));const before=JSON.stringify(corners);const result=M.estimate(corners,.1,K,POS.Posit);
 assert.equal(JSON.stringify(corners),before);assert.ok(result.error<.5);
 result.t.forEach((v,i)=>assert.ok(Math.abs(v-truth.t[i])<.003));
 result.R.flat().forEach((v,i)=>assert.ok(Math.abs(v-truth.R.flat()[i])<.025));
 const inv=M.inverse(result);const I=mul(inv.R,result.R);I.flat().forEach((v,i)=>assert.ok(Math.abs(v-(i%4===0?1:0))<1e-8));
 console.log('PASS synthetic pose',result.t,'RMS',result.error);
}
const d=new AR.Dictionary('ARUCO_MIP_36h12');const det=new AR.Detector({dictionaryName:'ARUCO_MIP_36h12',maxHammingDistance:2});
for(const id of [0,42,249]){
 const width=640,height=480,data=new Uint8ClampedArray(width*height*4).fill(255);const svg=d.generateSVG(id);
 for(const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(white|black)"/g)){
  const [,x,y,w,h,color]=m;for(let py=140+Number(y)*20;py<140+(Number(y)+Number(h))*20;py++)for(let px=220+Number(x)*20;px<220+(Number(x)+Number(w))*20;px++){const off=(py*width+px)*4;data[off]=data[off+1]=data[off+2]=color==='black'?0:255;}
 }
 const markers=det.detect({width,height,data});assert.equal(markers.length,1);assert.equal(markers[0].id,id);
 const p=M.estimate(markers[0].corners,.1,{fx:700,fy:700,cx:320,cy:240},POS.Posit);assert.ok(Math.abs(p.t[2]-.4375)<.01);console.log('PASS raster detector + pose',id,p.t);
}
