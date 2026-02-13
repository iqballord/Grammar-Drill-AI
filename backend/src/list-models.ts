import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// This script is a placeholder as listModels is not directly available in this SDK version
async function listModels() {
  console.log('Checking model availability...');
  try {
     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
     const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
     console.log('Successfully initialized model client for gemini-1.5-flash');
  } catch (error) {
    console.error('Error:', error);
  }
}

listModels();
