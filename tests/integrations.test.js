const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/app.js', 'utf8');
function section(start, end, globals) {
  const context = vm.createContext(Object.assign({Promise, Date, encodeURIComponent, setTimeout, clearTimeout}, globals));
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  return context;
}
function spotify(response) {
  return section('  function spApi(', '  function cover(', {sp: {}, spToken: () => Promise.resolve('token'), fetch: () => Promise.resolve(response)});
}
test('successful plain-text playback command does not fail JSON parsing', async () => {
  for (const status of [200, 202, 204]) {
    const c = spotify({status, ok: true, text: async () => 'Web Playback command accepted'});
    assert.equal(await c.spApi('PUT', '/me/player/play', {}), null);
  }
});
test('JSON read responses still return playback data', async () => {
  const c = spotify({status: 200, ok: true, text: async () => '{"is_playing":true}'});
  assert.equal((await c.spApi('GET', '/me/player')).is_playing, true);
});
test('invalid read responses produce a useful error', async () => {
  const c = spotify({status: 200, ok: true, text: async () => 'Wrong gateway response'});
  await assert.rejects(c.spApi('GET', '/me/player'), /invalid response/);
});
test('disconnected device profile overrides stale A2DP connected flag', async () => {
  const bt = {adapter: 'adapter', list: [], out: 'tv_speaker', prev: null};
  const c = section('  function isAudio(', '  function conn()', {bt, BTU: 'bt/', paintSnd() {}, btAutoConnect() {}, toast() {}, lc: async uri => uri === 'bt/device/getStatus' ? {devices:[{name:'Speaker', address:'speaker', paired:true, classOfDevice:1024, connectedProfiles:[]}]} : uri === 'bt/a2dp/getStatus' ? {connected:true} : {settings:{soundOutput:'tv_speaker'}}});
  await c.btPoll();
  assert.equal(bt.list[0].connected, false);
});
test('live Bluetooth subscription refreshes on changes and is retained once', () => {
  const bridges = [];
  function PalmServiceBridge() { bridges.push(this); this.call = () => {}; }
  const c = section('  var btPending =', '  function conn()', {PalmServiceBridge, bt: {}, BTU: 'bt/'});
  let updates = 0;
  c.btPoll = () => { updates++; };
  c.btWatch('bt/device/getStatus', {});
  bridges[0].onservicecallback('{"returnValue":true,"subscribed":true}');
  bridges[0].onservicecallback('{"returnValue":true,"devices":[]}');
  c.btWatch('bt/device/getStatus', {});
  assert.equal(updates, 1);
  assert.equal(bridges.length, 1);
});
test('rate limiting retains Spotify retry delay', async () => {
  const c = spotify({status:429, headers:{get:()=> '10'}});
  await assert.rejects(c.spApi('GET','/me/player'), /rate/);
  assert.ok(c.sp.backoff >= Date.now()+9000);
});
test('expired Spotify access token is cleared', async () => {
  const c = spotify({status:401}); c.sp.token = 'expired';
  await assert.rejects(c.spApi('GET','/me/player'), /401/);
  assert.equal(c.sp.token, '');
});
test('preferred paired speaker reconnects and retries are bounded', () => {
  const calls = [], S = {btAuto:true, btPreferred:'speaker'};
  const bt = {list:[{address:'speaker',name:'Speaker',connected:false}],adapter:'a'};
  const c = section('  function btAutoConnect(', '  function btConnect(', {S, bt, document:{hidden:false}, save(){}, btConnect:(d,automatic)=>calls.push({d,automatic})});
  c.btAutoConnect(); c.btAutoConnect();
  assert.equal(calls.length,1);
  assert.equal(calls[0].automatic,true);
});
test('automatic reconnect respects choosing TV speakers', () => {
  let calls=0;
  const c = section('  function btAutoConnect(', '  function btConnect(', {S:{btAuto:false},bt:{list:[{address:'s',connected:false}]},document:{hidden:false},save(){},btConnect(){calls++;}});
  c.btAutoConnect(); assert.equal(calls,0);
});
test('sound routing uses the TVs working audio adapter endpoint', async () => {
  let called;
  const c = section('  function setOutput(', '  function btAutoConnect(', {bt:{},S:{btAuto:true},setTimeout:fn=>fn(),paintSnd(){},req:async uri=>{if(uri.endsWith('changeSoundOutput'))called=uri;return {soundOutput:'bt_soundbar'};}});
  await c.setOutput('bt_soundbar');
  assert.equal(called,'ssap://com.webos.service.apiadapter/audio/changeSoundOutput');
});
test('Bluetooth query failure retains devices without a false disconnect', async () => {
  let announcements=0;
  const bt={adapter:'a',list:[{address:'s',name:'Speaker',connected:true}],out:'bt_soundbar',prev:'Speaker'};
  const c=section('  function isAudio(', '  function conn()', {bt,BTU:'bt/',paintSnd(){},btAutoConnect(){},toast(){announcements++;},lc:async()=>({returnValue:false,errorText:'timeout'})});
  await c.btPoll();
  assert.equal(bt.list.length,1);
  assert.equal(bt.list[0].connected,true);
  assert.equal(announcements,0);
  assert.equal(bt.stale,true);
});
test('sound output is confirmed and retried if the TV resets it during connection', async () => {
  let changes=0, reads=0;
  const bt={out:'tv_speaker'};
  const c=section('  function setOutput(', '  function btAutoConnect(', {bt,S:{btAuto:true},paintSnd(){},setTimeout:fn=>fn(),req:async uri=>{if(uri.endsWith('changeSoundOutput')){changes++;return {};}reads++;return {soundOutput:reads===1?'tv_speaker':'bt_soundbar'};}});
  await c.setOutput('bt_soundbar');
  assert.equal(changes,2);
  assert.equal(bt.out,'bt_soundbar');
});
test('already connected preferred speaker gets selected as sound output', () => {
  let output;
  const c=section('  function btAutoConnect(', '  function btConnect(', {S:{btAuto:true,btPreferred:'s'},bt:{out:'tv_speaker',list:[{address:'s',connected:true}]},document:{hidden:false},save(){},setOutput:o=>{output=o;return Promise.resolve();},btConnect(){throw new Error('already connected');}});
  c.btAutoConnect(); assert.equal(output,'bt_soundbar');
});
test('a newer Connect choice cancels pending TV speaker retries', async () => {
  let changes=0;const S={btAuto:false};
  const c=section('  function setOutput(', '  function btAutoConnect(', {S,bt:{},paintSnd(){},setTimeout:fn=>fn(),req:async uri=>{if(uri.endsWith('changeSoundOutput')){changes++;S.btAuto=true;}return {soundOutput:'bt_soundbar'};}});
  await c.setOutput('tv_speaker');assert.equal(changes,1);
});
test('TV playback skips the embedded DRM player and uses the native app', async () => {
  let played;
  const c=section('  function spPlay(body)', '  function spLoadPlaylists(', {spUsesNative:()=>true,spPlayTvApp:async body=>{played=body;},spWhenReady(){throw new Error('embedded player must not start on TV');},spFail:e=>{throw e;}});
  const body={uris:['spotify:track:test']};await c.spPlay(body);assert.equal(played,body);
});
test('native playback asks the service to launch Spotify even for a remembered device', async () => {
  let payload;
  const c=section('  function spTvJob(', '  function spPlay(body)', {spUsesNative:()=>true,sp:{cfg:{clientId:'client'}},spRefresh:()=> 'refresh',SVC:'service/',call:async(uri,p)=>{payload=p;return {returnValue:true};},toast(){},spApi(){throw new Error('foreground playback job belongs in service');}});
  await c.spPlayTvApp({uris:['spotify:track:test']});assert.equal(payload.openApp,true);
});
test('TV never starts the unsupported embedded Spotify audio engine', () => {
  const c=section('  function spInitPlayer()', '  function spWhenReady(', {spUsesNative:()=>true,sp:{},spOn:()=>true,window:{},document:{createElement(){throw new Error('SDK must not be loaded on TV');}}});
  c.spInitPlayer();
});
test('service opens native Spotify even if its Connect device is already listed', () => {
  const src=fs.readFileSync('service/service.js','utf8');let handler,launches=0;
  const c=vm.createContext({gen:0,activePlay:false,note(){},spToken:(p,cb)=>cb('token'),isTv:()=>true,setInterval(){return 1;},setTimeout(){},clearInterval(){},jreq:(method,host,path,headers,body,cb)=>cb(200,{devices:[{id:'tv',name:'LG',is_active:true}]}),svc:{register:(name,fn)=>{handler=fn;},call:(uri,p,cb)=>{launches++;cb({payload:{returnValue:true}});}}});
  vm.runInContext(src.slice(src.indexOf("svc.register('playOnTv'")),c);
  handler({payload:{clientId:'client',refreshToken:'refresh',openApp:true},respond(){}});
  assert.equal(launches,1);
});
test('next from the dashboard uses the native playback job on TV', async () => {
  let action;
  const c=section('  function spCtl(', '  function isTvDev(', {sp:{state:{deviceType:'TV'}},isTvDev:d=>d.type==='TV',spUsesNative:()=>true,spTvJob:async(body,a)=>{action=a;},spApi(){throw new Error('must run after native app opens');},spFail:e=>{throw e;}});
  await c.spCtl('next');assert.equal(action,'next');
});
test('service sends next to the explicit native TV device', () => {
  const src=fs.readFileSync('service/service.js','utf8');let handler,command;
  const c=vm.createContext({gen:0,activePlay:false,note(){},spToken:(p,cb)=>cb('token'),isTv:()=>true,setInterval(){},setTimeout(){},jreq:(method,host,path,headers,body,cb)=>{if(method==='GET')cb(200,{devices:[{id:'tv',name:'LG',is_active:true}]});else{command={method,path};cb(204,null);}},svc:{register:(name,fn)=>{handler=fn;}}});
  vm.runInContext(src.slice(src.indexOf("svc.register('playOnTv'")),c);
  handler({payload:{clientId:'client',refreshToken:'refresh',action:'next'},respond(){}});
  assert.equal(command.method,'POST');assert.equal(command.path,'/v1/me/player/next?device_id=tv');
});
test('dashboard controls keep controlling a selected remote phone', async () => {
  let path;
  const c=section('  function spCtl(', '  function isTvDev(', {sp:{state:{deviceType:'Smartphone',device:'Phone'}},spUsesNative:()=>true,isTvDev:d=>d.type==='TV',spTvJob(){throw new Error('must not control TV');},spApi:async(method,p)=>{path=p;},spPoll(){},setTimeout(){},spFail:e=>{throw e;}});
  await c.spCtl('next');assert.equal(path,'/me/player/next');
});
test('service reports busy instead of pretending a discarded control succeeded', () => {
  const src=fs.readFileSync('service/service.js','utf8');let handler,reply;
  const c=vm.createContext({gen:0,activePlay:true,note(){},svc:{register:(name,fn)=>{handler=fn;}}});vm.runInContext(src.slice(src.indexOf("svc.register('playOnTv'")),c);
  handler({payload:{clientId:'client',refreshToken:'refresh',action:'pause'},respond:r=>{reply=r;}});
  assert.equal(reply.returnValue,false);assert.match(reply.errorText,/opening|busy/i);
});
test('a newer play request supersedes an older one that is still waiting', () => {
  const src=fs.readFileSync('service/service.js','utf8');let handler;const replies=[],bodies=[];
  const c=vm.createContext({gen:0,activePlay:false,note(){},spToken:(p,cb)=>cb('token'),isTv:()=>true,setInterval(){return 1;},clearInterval(){},setTimeout(fn){fn();},
    jreq:(method,host,path,headers,body,cb)=>{if(method==='GET')cb(200,{devices:[{id:'tv',name:'LG'}]});else{bodies.push(body);cb(204,null);}},svc:{register:(name,fn)=>{handler=fn;},call:(u,p,cb)=>cb({payload:{returnValue:true}})}});
  vm.runInContext(src.slice(src.indexOf("svc.register('playOnTv'")),c);
  const respond=r=>replies.push(r);
  handler({payload:{clientId:'c',refreshToken:'r',action:'play',body:{context_uri:'first'}},respond});
  handler({payload:{clientId:'c',refreshToken:'r',action:'play',body:{context_uri:'second'}},respond});
  assert.ok(replies.every(r=>r.returnValue===true));
  assert.equal(bodies.filter(b=>b&&b.context_uri==='first').length,0);
});
