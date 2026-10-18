/* Pure calibration board geometry and quality checks. */
(function(root){
"use strict";
const board={cols:3,rows:4,marker:0.035,gap:0.010};
function objectPoints(id){const x=(id%3)*.045,y=Math.floor(id/3)*.045;return [[x,y,0],[x+.035,y,0],[x+.035,y+.035,0],[x,y+.035,0]];}
function correspondences(markers){const sorted=Array.from({length:12},(_,id)=>markers.find(m=>m.id===id));if(sorted.some(m=>!m))return null;return {objectPoints:sorted.flatMap(m=>objectPoints(m.id)),imagePoints:sorted.flatMap(m=>m.corners.map(p=>[p.x,p.y]))};}
function boardSVG(dictionary){let svg='<svg xmlns="http://www.w3.org/2000/svg" width="145mm" height="210mm" viewBox="0 0 145 210"><rect width="145" height="210" fill="white"/>';
for(let id=0;id<12;id++){const x=10+(id%3)*45-4.375,y=10+Math.floor(id/3)*45-4.375;svg+=dictionary.generateSVG(id).replace('<svg ', '<svg x="'+x+'" y="'+y+'" width="43.75" height="43.75" shape-rendering="crispEdges" ');}
return svg+'<g fill="black" font-family="sans-serif" text-anchor="middle"><text x="72.5" y="192" font-size="4">MARKER POSE / CALIBRATION BOARD v1</text><text x="72.5" y="199" font-size="3">3 x 4 / IDs 0-11 / ARUCO_MIP_36h12</text><text x="72.5" y="205" font-size="3">Black edge 35 mm / Gap 10 mm / Print 100%</text></g></svg>';}
function fingerprint(points,width,height){return points.flatMap(p=>[p[0]/width,p[1]/height]);}
function difference(a,b){return Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/(a.length/2));}
function quality(views){
 if(views.length<18)return "최소 18개 시점이 필요해.";
 const span=values=>Math.max(...values)-Math.min(...values);
 if(span(views.map(v=>v.center[0]))<.12||span(views.map(v=>v.center[1]))<.12)return "보드를 화면 왼쪽·오른쪽·위·아래에도 배치해줘.";
 if(span(views.map(v=>v.normal[0]))<.3||span(views.map(v=>v.normal[1]))<.3)return "폰을 좌우와 위아래에서 비스듬히 기울여 찍어줘. 정면 사진만으로는 부족해.";
 return null;
}
function rodrigues(v){const theta=Math.hypot(...v);if(theta<1e-12)return [[1,0,0],[0,1,0],[0,0,1]];const [x,y,z]=v.map(a=>a/theta),c=Math.cos(theta),s=Math.sin(theta),C=1-c;return [[c+x*x*C,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,c+y*y*C,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,c+z*z*C]];}
const api={board,objectPoints,correspondences,boardSVG,fingerprint,difference,quality,rodrigues};
if(typeof module!=="undefined")module.exports=api;else root.CalibrationCore=api;
})(typeof window!=="undefined"?window:this);

