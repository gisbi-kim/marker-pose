const assert=require("node:assert/strict"),C=require("./calibration-core.js"),P=require("./pose.js"),POS=require("./vendor/posit1.js").POS,AR=require("./vendor/aruco.js").AR;
const K={fx:850,fy:830,cx:470,cy:350,dist:[-.13,.035,.001,-.001,0]};
const truth={R:C.rodrigues([.25,-.3,.08]),t:[.12,-.08,.6]};
const corners=P.model(.1).map(x=>P.project(x,truth,K)),before=JSON.stringify(corners);
const pose=P.estimate(corners,.1,K,POS.Posit);
assert.equal(JSON.stringify(corners),before);assert.ok(pose.error<.6);pose.t.forEach((v,i)=>assert.ok(Math.abs(v-truth.t[i])<.004));
for(const p of [{x:60,y:80},{x:880,y:620}]){const u=P.undistort(p,K);const d=P.distort((u.x-K.cx)/K.fx,(u.y-K.cy)/K.fy,K.dist);assert.ok(Math.hypot(d[0]*K.fx+K.cx-p.x,d[1]*K.fy+K.cy-p.y)<1e-5);}
const dictionary=new AR.Dictionary("ARUCO_MIP_36h12"),detector=new AR.Detector({dictionaryName:"ARUCO_MIP_36h12",maxHammingDistance:2});
const width=640,height=720,data=new Uint8ClampedArray(width*height*4).fill(255);
for(let id=0;id<12;id++){
const ox=80+(id%3)*145,oy=50+Math.floor(id/3)*145,svg=dictionary.generateSVG(id);
for(const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(white|black)"/g)){
const [,x,y,w,h,color]=m;for(let y1=oy+Number(y)*12;y1<oy+(Number(y)+Number(h))*12;y1++)for(let x1=ox+Number(x)*12;x1<ox+(Number(x)+Number(w))*12;x1++){const offset=(y1*width+x1)*4;data[offset]=data[offset+1]=data[offset+2]=color==="black"?0:255;}
}}
const markers=detector.detect({width,height,data});assert.equal(markers.length,12);const corr=C.correspondences(markers);assert.equal(corr.objectPoints.length,48);assert.equal(C.correspondences(markers.slice(1)),null);assert.equal(C.objectPoints(11)[2][0],.125);assert.ok(Math.abs(C.objectPoints(11)[2][1]-.17)<1e-10);
assert.ok(C.quality(Array.from({length:24},()=>({normal:[0,0,1],center:[.5,.5]}))));
const views=Array.from({length:24},(_,i)=>({normal:[(i%3-1)*.3,(Math.floor(i/3)%3-1)*.3,1],center:[.5+(i%3-1)*.15,.5+(Math.floor(i/3)%3-1)*.15]}));assert.equal(C.quality(views),null);
console.log("PASS distortion-aware pose, inverse distortion, 12-marker board detection, 48 correspondences and diversity gates");
