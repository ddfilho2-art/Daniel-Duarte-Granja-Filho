import { GoogleGenAI, Type } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
console.log('API KEY:', apiKey ? apiKey.substring(0, 5) + '...' : 'none');

const ai = new GoogleGenAI({ apiKey });

async function test() {
  try {
    const prompt = 'Return a simple json with {"score_total": 90}';
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score_total: { type: Type.NUMBER },
          },
          required: ["score_total"]
        }
      }
    });
    console.log('Response:', response.text);
  } catch (err) {
    if (err instanceof Error) {
      console.error('Error MESSAGE:', err.message);
    } else {
      console.error('Error:', err);
    }
  }
}
test();
