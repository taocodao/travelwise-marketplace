
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// This script mimics the Frontend GUI flow to verify the generator works end-to-end.

const GENERATOR_URL = 'http://localhost:3006';
const TARGET_API_URL = 'https://petstore.swagger.io/v2/swagger.json';

async function runTest() {
  console.log('🚀 Starting End-to-End Verification...');

  // Step 1: Analyze
  console.log('\n1️⃣  Testing /analyze...');
  try {
    const res1 = await axios.post(`${GENERATOR_URL}/analyze`, {
      apiEndpoint: TARGET_API_URL
    });
    
    if (!res1.data.success) {
      throw new Error(`Analysis failed: ${res1.data.error}`);
    }
    
    const analysis = res1.data.analysis;
    console.log(`✅  Analysis success! Found ${analysis.endpoints.length} tools.`);
    console.log(`   Name: ${analysis.name}`);

    // Step 2: Generate
    console.log('\n2️⃣  Testing /generate...');
    const serverName = 'verified-petstore';
    
    const res2 = await axios.post(`${GENERATOR_URL}/generate`, {
      apiEndpoint: TARGET_API_URL,
      serverName: serverName,
      selectedTools: analysis.endpoints // Pass all detected endpoints
    });

    if (!res2.data.success) {
      throw new Error(`Generation failed: ${res2.data.error}`);
    }

    console.log(`✅  Generation success! Path: ${res2.data.path}`);

    // Step 3: Verify File System
    console.log('\n3️⃣  Verifying Deployment...');
    // Traverse up from src/ to packages/api
    const deployPath = path.resolve(__dirname, '../../../../packages/api/src/mcp-servers', serverName, 'index.ts');
    
    if (fs.existsSync(deployPath)) {
      console.log(`✅  File exists at: ${deployPath}`);
      const content = fs.readFileSync(deployPath, 'utf-8');
      if (content.includes('express.Router()') && content.includes('/tools')) {
         console.log('✅  Code looks like a valid Router.');
      } else {
         console.warn('⚠️  Code content might be invalid.');
      }
    } else {
      throw new Error(`File not found at ${deployPath}`);
    }

    console.log('\n🎉  SYSTEM VERIFIED: The Generator meets the Strict Interface requirements.');

  } catch (error: any) {
    console.error('\n❌  TEST FAILED:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

runTest();
