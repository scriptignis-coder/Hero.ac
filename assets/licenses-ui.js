(()=>{
  const el = id => document.getElementById(id);
  const message = text => { const node=el('hs-lic-msg'); if(node) node.textContent=text; };
  async function api(method, body) {
    const response=await fetch('/api/licenses',{
      method, credentials:'same-origin', cache:'no-store',
      headers:body?{'Content-Type':'application/json'}:{},
      body:body?JSON.stringify(body):undefined
    });
    const raw=await response.text();
    let data={};
    try {data=JSON.parse(raw);}catch{}
    if(!response.ok) throw new Error(data.error || `License service unavailable (HTTP ${response.status}).`);
    return data;
  }
  let connected=false;
  function wire() {
    if(connected || !el('hs-license-form')) return;
    connected=true;
    el('hs-license-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const code=el('hs-code').value.trim().toUpperCase();
      if(!/^HS-[A-F0-9]{32}$/.test(code)){
        message('Invalid license key format. Use HS- followed by 32 hexadecimal characters.');
        return;
      }
      const button=el('hs-claim');
      button.disabled=true;
      button.textContent='Activating…';
      message('');
      try {
        await api('POST',{action:'claim',code});
        message('License activated! Opening dashboard…');
        location.replace('/dashboard');
        // Cache-free reload makes the new server-side permissions visible.
        location.reload();
      } catch(error) {
        message(error.message);
        button.disabled=false;
        button.textContent='Activate License';
      }
    });
    el('hs-retry').addEventListener('click',()=>window.hsLicensePanel());
  }
  window.hsLicensePanel=async function() {
    // Never hide the input/button just because the license API is down.
    wire();
    const retry=el('hs-retry');
    if(retry) retry.hidden=true;
    message('');
    try {
      const data=await api('GET');
      if(data.license) {
        message('Active license found. Checking dashboard access…');
        // /api/me is authoritative; do not grant access in browser.
        const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});
        if(response.ok) {
          const me=await response.json();
          if(me.access?.herocheck || me.access?.admin) location.reload();
          else message('License found but access has not refreshed. Please retry in a moment.');
        }
      }
    } catch(error) {
      message('License service unavailable: '+error.message+' You can still enter a key; activation requires the server.');
      if(retry) retry.hidden=false;
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire);
  else wire();
})();
