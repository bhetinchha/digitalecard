/** Auth UI state and email OTP workflows; all credentials are submitted to Apps Script. */
window.AuthUI = (() => {
  let pendingEmail = '';
  let registration = null;
  const forms = ['login','register','verify','forgot','reset'];
  const $ = (selector) => document.querySelector(selector);
  function tab(name) {
    forms.forEach(item => { $('#'+item+'Form').hidden = item!==name; });
    document.querySelectorAll('[data-auth-tab]').forEach(b => b.classList.toggle('active',b.dataset.authTab===name));
  }
  function open(name='login') { tab(name); $('#authDialog').showModal(); }
  async function submit(form, action) {
    const button=form.querySelector('button[type=submit]');
    if(button.disabled)return;
    const previous=button.textContent;
    button.disabled=true;button.textContent='Please wait…';
    try { await action(new FormData(form)); }
    catch(error){ notify(error.message||'Request failed.','error'); }
    finally{button.disabled=false;button.textContent=previous;}
  }
  function enter(session) {
    sessionStorage.setItem('dbc_session',session.token);
    loadDemoAccount(session.user.id,session.user.name);
    updateLoginUI();
    $('#authDialog').close();
    notify('Welcome! Your email-verified account is ready.','success');
  }
  async function logout() {
    const token=sessionStorage.getItem('dbc_session');
    sessionStorage.removeItem('dbc_session');
    if(token) { try { await DBC_API.request({action:'logout',token}); } catch(error) { /* Local session removed regardless. */ } }
  }
  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[data-auth-tab]').forEach(button=>button.addEventListener('click',()=>tab(button.dataset.authTab)));
    document.querySelectorAll('.password-toggle').forEach(button=>button.addEventListener('click',()=>{
      const input=button.parentElement.querySelector('input');
      input.type=input.type==='password'?'text':'password';
      button.textContent=input.type==='password'?'Show':'Hide';
    }));
    $('#loginForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      const session=await DBC_API.request({action:'login',email:f.get('email'),password:f.get('password')});enter(session);
    });});
    $('#registerForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      pendingEmail=String(f.get('email')).trim().toLowerCase();
      if (f.get('password') !== f.get('confirmPassword')) {
        throw new Error('Passwords do not match.');
      }
      registration={name:f.get('name'),email:pendingEmail,mobile:String(f.get('mobile')).trim(),password:f.get('password'),confirmPassword:f.get('confirmPassword')};
      const result=await DBC_API.request({action:'register',...registration});
      registration=null; // do not retain credentials after request
      $('#verifyEmail').textContent=pendingEmail;tab('verify');notify(result.message,'success');
    });});
    $('#verifyForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      const session=await DBC_API.request({action:'verifyRegister',email:pendingEmail,otp:f.get('otp')});
      registration=null;enter(session);
    });});
    $('#resendOtp').addEventListener('click',()=>{tab('register');notify('Re-enter your password to request a fresh code.');});
    $('#forgotForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      pendingEmail=String(f.get('email')).trim().toLowerCase();
      const result=await DBC_API.request({action:'forgot',email:pendingEmail});
      tab('reset');notify(result.message,'success');
    });});
    $('#resetForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      const result=await DBC_API.request({action:'reset',email:pendingEmail,otp:f.get('otp'),password:f.get('password')});
      e.target.reset();tab('login');notify(result.message,'success');
    });});
    const token=sessionStorage.getItem('dbc_session');
    if(token){
      try {
        const result=await DBC_API.request({action:'me',token});
        loadDemoAccount(result.user.id,result.user.name);updateLoginUI();
      }catch(error){sessionStorage.removeItem('dbc_session');state.demoId='';state.demoUser='';updateLoginUI();}
    }
  });
  return {open,logout};
})();
