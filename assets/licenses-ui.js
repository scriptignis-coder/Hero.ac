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
  const r=await fetch('/api/licenses',{credentials:'same-origin'});if(!r.ok){const slot=$('hs-activation-slot');if(slot)slot.textContent='License service unavailable. Please try again later.';return;}const d=await r.json();
  let box=$('hs-license-panel');if(!box){box=document.createElement('section');box.id='hs-license-panel';box.style.cssText='margin:12px 0;padding:18px;border:1px solid #26344b;border-radius:12px;background:#0b111b;color:#dbe8fa;text-align:left';(document.getElementById('hs-activation-slot') || document.querySelector('#app'))?.append(box)}
  if(!d.license){box.innerHTML='<label for="hs-code" style="display:block;margin-bottom:9px;font-weight:600">License Key</label><input id="hs-code" autocomplete="off" placeholder="HS-XXXX-XXXX-XXXX" style="box-sizing:border-box;width:100%;padding:13px;border-radius:9px;border:1px solid #34445d;background:#111b2b;color:white"><button id="hs-claim" class="btn btn-primary" style="width:100%;margin-top:12px">Activate License</button><p id="hs-lic-msg" role="alert" style="color:#ff7184;font-size:13px;margin-top:10px"></p>';
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
