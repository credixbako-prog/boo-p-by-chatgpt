import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const BT={},ctx={BT,window:{BT,addEventListener(){}},document:{addEventListener(){}}};
vm.runInNewContext(readFileSync(new URL('../js/photo-frame.js',import.meta.url),'utf8'),ctx);
test('photo: original, portrait et paysage restent dans les pixels source au zoom maximal',()=>{
 for(const [w,h] of [[4032,3024],[3024,4032],[4000,1000]])for(const ratio of [w/h,.8,1,4/3,2.8])for(const zoom of [1,2,4])for(const [x,y] of [[0,0],[.5,.5],[1,1]]){
  const r=BT.photoFrame.cropRect(w,h,ratio,zoom,x,y);
  assert.ok(r.sx>=0&&r.sy>=0&&r.sw>0&&r.sh>0);assert.ok(r.sx+r.sw<=w+.001&&r.sy+r.sh<=h+.001);assert.ok(Math.abs(r.sw/r.sh-ratio)<.00001);
 }
});
test('ISBN: le cadre visible est projeté dans les pixels de la caméra, y compris en portrait',()=>{
 const landscape=BT.photoFrame.cameraRect(1920,1080,{left:10,top:20,width:960,height:540},{left:106,top:128,width:768,height:216});
 assert.equal(landscape.sx,192);assert.equal(landscape.sy,216);assert.equal(landscape.sw,1536);assert.equal(landscape.sh,432);
 const portrait=BT.photoFrame.cameraRect(1920,1080,{left:0,top:0,width:300,height:400},{left:21,top:150,width:258,height:100});
 assert.ok(portrait.sx>500);assert.equal(portrait.sy,405);assert.equal(portrait.sw,696.6);assert.equal(portrait.sh,270);
});
