import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fixture, login } from "./helpers.mjs";
import { id, saveSettings } from "../server/db.mjs";
import { showTimeline, moveScene } from "../shared/signage.mjs";
import { parseShow } from "../server/signage-schema.mjs";

test("TV scene order and individual durations survive validation and cannot lengthen a video past its end", () => {
  const block={id:id(),type:"message",afterAnimal:1,seconds:7};
  const show={program:parseShow({introSeconds:5,statsEnabled:false,logoEvery:0,inserts:[block]}),items:[{id:"a",species:"dog",media:[{kind:"photo"}]},{id:"b",species:"cat",media:[{kind:"video",duration:8}]}]};
  const initial=showTimeline(show), keys=initial.scenes.map(s=>s.key), last=keys.at(-1);
  const order=moveScene(keys,last,keys[0]);
  show.program=parseShow({...show.program,sceneOrder:order,sceneDurations:{[last]:120,[keys[1]]:11}});
  const next=showTimeline(show);
  assert.equal(next.scenes[0].key,last);
  assert.equal(next.scenes[0].duration,8*24);
  assert.equal(next.scenes.find(s=>s.key===keys[1]).duration,11*24);
  assert.equal(next.frames,next.scenes.reduce((n,s)=>n+s.duration,0));
  assert.deepEqual(next.scenes.map(s=>s.start),[0,192,312,576]);
  assert.throws(()=>parseShow({...show.program,sceneOrder:["intro","intro"]}));
  assert.throws(()=>parseShow({...show.program,sceneDurations:{intro:1000}}));
  const missing=showTimeline({...show,items:show.items.slice(0,1)});
  assert.equal(missing.scenes.some(s=>s.key===last),false);
  assert.equal(new Set(missing.scenes.map(s=>s.key)).size,missing.scenes.length);
});

test("public page access controls both C8 catalog and byte ranges, with private defaults and immediate revocation", async t => {
  const {app,c,base}=await fixture(t), admin=await login(app);
  c.broadcastDir=path.join(base,"broadcasts");await fs.mkdir(c.broadcastDir);await fs.writeFile(path.join(c.broadcastDir,"episode.mp4"),Buffer.alloc(40,7));
  const file="/api/broadcasts/"+Buffer.from("episode.mp4").toString("base64url")+"/file";
  for(const url of ["/api/broadcasts",file,"/api/stats"]) assert.equal((await app.inject({url})).statusCode,401);
  const res=await app.inject({method:"PUT",url:"/api/admin/settings",headers:admin.headers,payload:{pageAccess:{broadcasts:"public",stats:"public",activity:"team"}}});
  assert.equal(res.statusCode,200,res.body);
  assert.equal((await app.inject({url:"/api/broadcasts"})).json().videos.length,1);
  const range=await app.inject({url:file,headers:{range:"bytes=0-4"}});assert.equal(range.statusCode,206);assert.equal(range.rawPayload.length,5);
  assert.equal((await app.inject({url:"/api/stats"})).statusCode,200);
  for(const url of ["/api/feed","/feed.xml","/api/public/changes"]) assert.equal((await app.inject({url})).statusCode,401,url);
  assert.equal((await app.inject({url:"/api/feed",headers:admin.headers})).statusCode,200);
  saveSettings(app.db,{pageAccess:{broadcasts:"team",stats:"team",activity:"public"}});
  assert.equal((await app.inject({url:file,headers:{range:"bytes=0-4"}})).statusCode,401);
  assert.equal((await app.inject({url:"/api/overview"})).json().interface.pageAccess.broadcasts,"team");
  assert.equal((await app.inject({url:"/api/admin/visitors"})).statusCode,401);
});

test("visitor dashboard returns filled daily series, breakdowns and account/page search without exposing session hashes", async t => {
  const {app}=await fixture(t),admin=await login(app),session=id();
  for(const page of ["#gallery","#studio"]) await app.inject({method:"POST",url:"/api/visit",headers:{...admin.headers,"user-agent":"Mozilla/5.0 Windows Chrome/155.0"},payload:{session,path:page}});
  const r=await app.inject({url:"/api/admin/visitors?days=7&query=studio",headers:admin.headers}),d=r.json();
  assert.equal(r.statusCode,200,r.body);assert.equal(d.daily.length,7);assert.equal(d.daily.reduce((n,x)=>n+x.views,0),2);
  assert.equal(d.breakdowns.browsers[0].name,"Chrome");assert.equal(d.breakdowns.browsers[0].views,2);
  assert.equal(d.rows.length,1);assert.equal(d.rows[0].path,"#studio");assert.equal("session_hash" in d.rows[0],false);assert.equal(d.summary.online,1);
});
