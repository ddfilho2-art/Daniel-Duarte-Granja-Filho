import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
console.log('API KEY:', typeof apiKey, apiKey ? apiKey.substring(0, 5) + '...' : 'none');
