import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition } from "../types";

// Initialize the API client
// Note: We create the instance inside the function to ensure we get the latest key if it changes
const getAIClient = () => {
    const apiKey = process.env.API_KEY || '';
    // In a real scenario, we might want to handle missing keys gracefully in the UI
    return new GoogleGenAI({ apiKey });
};

export const translateWord = async (word: string, contextSentence: string): Promise<WordDefinition> => {
  const ai = getAIClient();

  const prompt = `
    Analyze the word "${word}" in the context of the sentence: "${contextSentence}".
    Provide a translation, phonetic pronunciation, word type (verb, noun, etc.), and a short usage example.
    Output JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translation: { type: Type.STRING },
            pronunciation: { type: Type.STRING },
            type: { type: Type.STRING },
            contextUsage: { type: Type.STRING },
          },
          required: ['translation', 'pronunciation', 'type']
        }
      }
    });

    if (response.text) {
        const data = JSON.parse(response.text);
        return {
            word,
            translation: data.translation,
            pronunciation: data.pronunciation,
            type: data.type,
            contextUsage: data.contextUsage
        };
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return {
        word,
        translation: "Error",
        pronunciation: "...",
        type: "Unknown",
        contextUsage: "Could not fetch definition."
    };
  }
};