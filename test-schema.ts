import { GoogleGenAI, Type } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: 'dummy' });
console.log('Test parsed Type.OBJECT:', Type.OBJECT);
