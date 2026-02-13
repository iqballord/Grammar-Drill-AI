import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  try {
    console.log('\n📋 Listing available Gemini models...\n');

    const models = await genAI.listModels();

    console.log(`Found ${models.length} models:\n`);

    for (const model of models) {
      console.log(`✅ ${model.name}`);
      console.log(`   Display Name: ${model.displayName}`);
      console.log(`   Description: ${model.description}`);
      console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ')}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error listing models:', error);
  }
}

listModels();
