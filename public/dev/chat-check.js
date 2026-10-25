// Local diagnostic fixture; uses the actual ChatBox and room.chat protocol.
import { h, render } from '../vendor/preact.module.js';
import { ChatBox } from '../js/ui/chatBox.js';
import { ToastHost } from '../js/ui/toasts.js';
import { Net, net } from '../js/net.js';
import { pushChatMessage } from '../js/store.js';
const peer=new Net({getToken:()=>null});
const state=document.getElementById('state');
net.getToken=()=>null;
net.on('helloError',e=>{state.textContent=e.message;});
peer.on('helloError',e=>{state.textContent=e.message;});
render(h(ChatBox,{}),document.getElementById('chat'));
render(h(ToastHost,{}),document.getElementById('toast'));
net.on('room.chat',pushChatMessage);
peer.on('room.chat',m=>{document.getElementById('peer').textContent+=`${m.name}: ${m.text}\n`;});
const once=(n,type)=>new Promise(resolve=>{const off=n.on(type,m=>{off();resolve(m);});});
document.getElementById('start').onclick=async()=>{
 if(!['127.0.0.1','localhost'].includes(location.hostname))return;
 try{
  document.getElementById('start').disabled=true;
  const welcome=once(net,'welcome');net.setName('ChatSender');net.connect();await welcome;
  const joined=once(peer,'welcome');peer.setName('ChatPeer');peer.connect();await joined;
  const room=once(net,'room.state');await net.request('room.create',{mode:'coop',difficulty:'NORMAL'});
  await peer.request('room.join',{code:(await room).code});state.textContent='Two clients connected';
 }catch(e){state.textContent=e.message;}
};
document.getElementById('offline').onclick=()=>{net.close();state.textContent='Sender disconnected';};
document.getElementById('finish').onclick=async()=>{await Promise.allSettled([net.request('room.leave'),peer.request('room.leave')]);net.close();peer.close();state.textContent='Test room left';};
window.addEventListener('pagehide',()=>{net.close();peer.close();});
