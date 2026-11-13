(()=>{
 const $=id=>document.getElementById(id);
 async function auth(action){
   const msg=$('hs-email-message');msg.textContent='Please wait…';
   try{const r=await fetch('/api/auth/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email:$('hs-email').value,password:$('hs-password').value})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');
   if(d.confirmation_required){msg.textContent='Check your email to confirm your account, then sign in.';return;}
   location.href='/dashboard';
   }catch(e){msg.textContent=e.message;}
 }
 $('hs-email-form')?.addEventListener('submit',e=>{e.preventDefault();auth('login')});
 $('hs-register')?.addEventListener('click',()=>auth('register'));
 window.hsLicensePanel=async function(){
  const r=await fetch('/api/licenses');if(!r.ok)return;const d=await r.json();
  let box=$('hs-license-panel');if(!box){box=document.createElement('section');box.id='hs-license-panel';box.style.cssText='margin:16px;padding:18px;border:1px solid #29354b;border-radius:12px;background:#090e17;color:#dbe8fa';(document.querySelector('#login:not([hidden])')||document.querySelector('#app'))?.prepend(box)}
  if(!d.license){box.innerHTML='<h3>Activate your HeRoShield license</h3><p>Enter the license code supplied after purchase.</p><input id="hs-code" placeholder="HS-..." style="padding:10px;background:#111b2b;color:white"><button id="hs-claim" style="padding:10px">Activate</button><p id="hs-lic-msg"></p>';
    $('hs-claim').onclick=async()=>{const r=await fetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'claim',code:$('hs-code').value.trim()})});const v=await r.json();if(r.ok)location.reload();else $('hs-lic-msg').textContent=v.error||'Could not activate'};
    return;
  }
  const l=d.license;box.innerHTML='<h3>Subscription: '+l.plan+'</h3><p>Expires: '+(l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Lifetime')+' · '+l.role+'</p>';
  if(l.role==='owner'&&l.plan==='enterprise'){
    const p=document.createElement('div');p.innerHTML='<p>Seats: '+(d.members.length+1)+' / '+l.seats+'</p><input id="hs-member-id" placeholder="Discord User ID" style="padding:10px;background:#111b2b;color:white"><button id="hs-add-member">Add member</button><p id="hs-member-message"></p>';
    box.append(p);$('hs-add-member').onclick=async()=>{const r=await fetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'add',identity:$('hs-member-id').value.trim()})});if(r.ok)window.hsLicensePanel();else $('hs-member-message').textContent=(await r.json()).error};
    for(const m of d.members){const row=document.createElement('p');row.textContent=m.identity+' ';const btn=document.createElement('button');btn.textContent='Remove';btn.onclick=async()=>{await fetch('/api/licenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',identity:m.identity})});window.hsLicensePanel()};row.append(btn);box.append(row)}
  }
 };
})();
