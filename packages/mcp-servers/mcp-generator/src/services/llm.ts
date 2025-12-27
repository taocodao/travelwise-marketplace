
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

console.log('Debug LLM: Starting...');
try {
  // Assume running from package root
  const rootEnv = path.resolve(process.cwd(), '../../../.env');
  console.log(`Debug LLM: CWD is ${process.cwd()}`);
  console.log(`Debug LLM: Loading env from ${rootEnv}`);
  
  if (fs.existsSync(rootEnv)) {
      dotenv.config({ path: rootEnv });
      console.log('Debug LLM: Loaded root .env');
  } else {
      console.log('Debug LLM: Root .env not found');
      // Try API package
      const apiEnv = path.resolve(process.cwd(), '../../api/.env');
       if (fs.existsSync(apiEnv)) {
          dotenv.config({ path: apiEnv });
          console.log('Debug LLM: Loaded API .env');
      }
  }
} catch (e: any) {
  console.error('Debug LLM: Env load error:', e.message);
}

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('⚠️ OPENAI_API_KEY not found. LLM features will fail.');
} else {
  console.log('Debug LLM: API Key Found!');
}

const openai = new OpenAI({
  apiKey: apiKey || 'dummy', 
});

export const callLLM = async (
  systemPrompt: string, 
  userPrompt: string, 
  jsonMode: boolean = true
): Promise<any> => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective model 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: jsonMode ? { type: 'json_object' } : { type: 'text' },
      temperature: 0.2, 
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content from LLM');

    return jsonMode ? JSON.parse(content) : content;
  } catch (error) {
    console.error('LLM Call Failed:', error);
    throw error;
  }
};
