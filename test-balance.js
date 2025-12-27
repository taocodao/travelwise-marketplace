// Quick test script to check USDC balance
const https = require('https');

const USDC_CONTRACT = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const WALLET = '0xc58aCc046d60FE877aC6fA3070665743Da52A89C';

// Build balanceOf call data
const data = '0x70a08231' + WALLET.slice(2).toLowerCase().padStart(64, '0');

const requestBody = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'eth_call',
  params: [{ to: USDC_CONTRACT, data }, 'latest']
});

console.log('Testing USDC balance fetch...');
console.log('Contract:', USDC_CONTRACT);
console.log('Wallet:', WALLET);
console.log('Call data:', data);

const req = https.request({
  hostname: 'sepolia.base.org',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('\nRaw response:', body);
    try {
      const result = JSON.parse(body);
      console.log('Result:', result.result);
      if (result.result && result.result !== '0x') {
        const balanceRaw = BigInt(result.result);
        const balance = Number(balanceRaw) / 1e6;
        console.log('Balance:', balance, 'USDC');
      } else {
        console.log('Balance: 0 USDC (empty result)');
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  });
});

req.on('error', e => console.error('Request error:', e));
req.write(requestBody);
req.end();
