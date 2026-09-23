async function check(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    console.log(`${name}: connected (HTTP ${response.status})`);
    return true;
  } catch (error) {
    console.error(`${name}: ${error.cause?.code || error.name || 'error'} - ${error.cause?.message || error.message}`);
    return false;
  }
}

async function main() {
  const results = await Promise.all([
    check('Microsoft login', 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'),
    check('Microsoft Graph', 'https://graph.microsoft.com/v1.0/me')
  ]);
  if (process.argv.includes('--local-api')) {
    require('dotenv').config();
    try {
      const response = await fetch('http://127.0.0.1:3000/api/mail-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: process.env.PASSWORD || '',
          refresh_token: 'invalid-test-token',
          client_id: '00000000-0000-0000-0000-000000000000',
          email: 'test@example.invalid',
          mailbox: 'INBOX'
        }),
        signal: AbortSignal.timeout(15000)
      });
      const body = await response.json();
      const reachedMicrosoft = response.status === 500 && String(body.error || '').includes('HTTP error! status: 400');
      console.log(`Local mail API: ${reachedMicrosoft ? 'reached Microsoft token endpoint' : `unexpected HTTP ${response.status}`}`);
      results.push(reachedMicrosoft);
    } catch (error) {
      console.error(`Local mail API: ${error.cause?.code || error.name || 'error'}`);
      results.push(false);
    }
  }
  if (results.includes(false)) process.exitCode = 1;
}

main();
