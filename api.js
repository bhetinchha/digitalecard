/** Hidden iframe form transport for Google Apps Script HTML service.
 * Only responses with the matching nonce from the expected Google host are accepted.
 */
window.DBC_API = Object.freeze({
  request(payload) {
    return new Promise((resolve,reject) => {
      const nonce = crypto.randomUUID();
      const frame = document.createElement('iframe');
      frame.name = 'dbc_api_' + nonce.replace(/-/g,'');
      frame.hidden = true;
      frame.setAttribute('title','Secure authentication response');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = DBC_CONFIG.apiUrl;
      form.target = frame.name;
      form.hidden = true;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'payload';
      input.value = JSON.stringify({...payload,nonce});
      form.appendChild(input);
      let timer;
      const clean = () => { clearTimeout(timer); window.removeEventListener('message', onMessage); form.remove(); frame.remove(); };
      const onMessage = (event) => {
        if (!/^https:\/\/(script\.google\.com|script\.googleusercontent\.com|[a-z0-9-]+\.googleusercontent\.com)$/.test(event.origin)) return;
        // Apps Script may wrap HtmlService in a nested iframe; its source is not always frame.contentWindow.
        // A cryptographically random, per-request nonce and a trusted Google origin identify the reply.
        if (!event.data || event.data.nonce !== nonce) return;
        const data = event.data;
        clean();
        if (data.ok) resolve(data.data);
        else reject(new Error(data.error || 'Request failed.'));
      };
      window.addEventListener('message',onMessage);
      timer = setTimeout(() => {clean();reject(new Error('Server response was not received. Check Apps Script deployment, access settings and execution logs. Please do not submit repeatedly.'));},DBC_CONFIG.requestTimeoutMs);
      document.body.append(frame,form);
      form.submit();
    });
  }
});
