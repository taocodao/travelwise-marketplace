
import axios from 'axios';
import * as fs from 'fs';

const BASE = 'http://127.0.0.1:3006';
const SPEC_URL = 'https://petstore.swagger.io/v2/swagger.json';

const log = (msg: string) => {
  console.log(msg);
  fs.appendFileSync('test-log.txt', msg + '\n');
};

async function run() {
  log('Testing Analyze...');
  try {
    const resH = await axios.get(`${BASE}/health`);
    log(`Health: ${JSON.stringify(resH.data)}`);

    const res1 = await axios.post(`${BASE}/analyze`, { apiEndpoint: SPEC_URL });
    log(`Analyze Result: ${res1.data.success ? 'SUCCESS' : 'FAIL'}`);
    if (res1.data.success) {
      log('Testing Generate...');
      const res2 = await axios.post(`${BASE}/generate`, {
         apiEndpoint: SPEC_URL,
         serverName: 'generated-petstore',
         selectedTools: res1.data.analysis.endpoints // Generate all
      });
      log(`Generate Result: ${res2.data.success ? 'SUCCESS' : 'FAIL'}`);
      log(`Path: ${res2.data.path}`);
    } else {
        log(`Analyze response: ${JSON.stringify(res1.data)}`);
    }
  } catch (e: any) {
    log(`Test Failed: ${e.message} [Code: ${e.code}]`);
    if(e.response) log(`Response data: ${JSON.stringify(e.response.data)}`);
  }
}

fs.writeFileSync('test-log.txt', 'Starting Test\n');
run();
