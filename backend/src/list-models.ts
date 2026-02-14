import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// This script is a placeholder as listModels is not directly available in this SDK version
async function listModels() {
  console.log('Checking model availability...');
  try {
     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
     const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
     console.log('Successfully initialized model client for gemini-2.5-flash-lite');
  } catch (error) {
    console.error('Error:', error);
  }
}

listModels();
