/** Auth UI state and email OTP workflows; all credentials are submitted to Apps Script. */
window.AuthUI = (() => {
  let pendingEmail = '';
  let registration = null;
  let verificationPending = false;
  function showVerification(email) {
    pendingEmail = email;
    verificationPending = true;
    $('#verifyEmail').textContent = email;
    $('#verifyForm').reset();
    tab('verify');
    $('#verifyForm').querySelector('[name=otp]').focus();
  }
  const forms = ['login','register','verify','forgot','reset'];
  const $ = (selector) => document.querySelector(selector);
  function tab(name) {
    clearFeedback();
    forms.forEach(item => { $('#'+item+'Form').hidden = item!==name; });
    if (name === 'verify') $('#verificationNotice').hidden = false;
    document.querySelectorAll('[data-auth-tab]').forEach(b => b.classList.toggle('active',b.dataset.authTab===name));
  }
  function clearFeedback() {
    document.querySelectorAll('#authDialog .dialog-feedback').forEach(el => { el.classList.remove('show'); el.textContent = ''; });
    document.querySelectorAll('#authDialog .field-error').forEach(el => el.remove());
    document.querySelectorAll('#authDialog .invalid-field').forEach(el => el.classList.remove('invalid-field'));
  }
  function fieldError(form, name, message) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) { notify(message, 'error'); return; }
    input.classList.add('invalid-field');
    const error = document.createElement('span');
    error.className = 'field-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    input.closest('label').appendChild(error);
    input.focus();
    input.addEventListener('input', () => { error.remove(); input.classList.remove('invalid-field'); }, { once: true });
  }
  function open(name='login') { tab(name); $('#authDialog').showModal(); }
  async function submit(form, action) {
    const button=form.querySelector('button[type=submit]');
    if(button.disabled)return;
    clearFeedback();
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
      try {
        const session=await DBC_API.request({action:'login',email:f.get('email'),password:f.get('password')});
        enter(session);
      } catch (error) {
        if (error.message.startsWith('EMAIL_NOT_VERIFIED:')) {
          showVerification(String(f.get('email')).trim().toLowerCase());
          notify('Your email is not verified. Enter the code we sent, or request a new one.', 'error');
          return;
        }
        throw error;
      }
    });});
    $('#registerForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      pendingEmail=String(f.get('email')).trim().toLowerCase();
      if (f.get('password') !== f.get('confirmPassword')) {
        fieldError(e.target, 'confirmPassword', 'Passwords do not match. Please enter the same password.');
        return;
      }
      registration={name:f.get('name'),email:pendingEmail,mobile:String(f.get('mobile')).trim(),password:f.get('password'),confirmPassword:f.get('confirmPassword')};
      const result=await DBC_API.request({action:'register',...registration});
      registration=null; // do not retain credentials after request
      showVerification(pendingEmail);
      notify('Verification email sent. Enter your 6-digit code to activate your account.', 'success');
    });});
    $('#verifyForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      await DBC_API.request({action:'verifyRegister',email:pendingEmail,otp:f.get('otp')});
      registration=null;verificationPending=false;
      e.target.reset();
      tab('login');
      $('#loginForm').reset();
      notify('Email verified successfully! Your account is active. Please enter your email and password to sign in.', 'success');
      $('#loginForm').querySelector('[name=email]').focus();
    });});
    $('#resendOtp').addEventListener('click',()=>{
      tab('register');
      $('#registerForm').querySelector('[name=email]').value=pendingEmail;
      notify('To send a new code, enter your password and submit the registration form again.');
    });
    $('#forgotForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      pendingEmail=String(f.get('email')).trim().toLowerCase();
      const result=await DBC_API.request({action:'forgot',email:pendingEmail});
      tab('reset');notify(result.message,'success');
    });});
    $('#resetForm').addEventListener('submit',e=>{e.preventDefault();submit(e.target,async f=>{
      const result=await DBC_API.request({action:'reset',email:pendingEmail,otp:f.get('otp'),password:f.get('password')});
      e.target.reset();tab('login');$('#loginForm').reset();notify(result.message || 'Password changed. Please sign in with your new password.', 'success');
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
