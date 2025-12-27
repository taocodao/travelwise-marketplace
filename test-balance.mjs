// Sync test using fetch
async function test() {
  const USDC_CONTRACT = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  const WALLET = '0xc58aCc046d60FE877aC6fA3070665743Da52A89C';
  
  const data = '0x70a08231' + WALLET.slice(2).toLowerCase().padStart(64, '0');
  
  console.log('Contract:', USDC_CONTRACT);
  console.log('Wallet:', WALLET);
  
  const response = await fetch('https://sepolia.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: USDC_CONTRACT, data }, 'latest']
    })
  });
  
  const result = await response.json();
  console.log('Raw result:', result.result);
  
  if (result.result && result.result !== '0x') {
    const balanceRaw = BigInt(result.result);
    console.log('Balance:', Number(balanceRaw) / 1e6, 'USDC');
  } else {
    console.log('Balance: 0 USDC');
  }
}

test().catch(console.error);
