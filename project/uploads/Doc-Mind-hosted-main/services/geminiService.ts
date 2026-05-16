

import { GoogleGenAI, Type, Chat as GeminiChat } from "@google/genai";
import type { QuizQuestion, Flashcard, RecapScriptLine, QAItem, MindMapNode, RevisionPoint, Settings } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // Don't throw error immediately, as user might be using Ollama
  console.warn("API_KEY environment variable not set. Gemini provider will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

// This list should be kept in sync with the one in AIDiagramMaker.tsx
const diagramTypesForAuto = [
    "Flowchart", "Mind Map", "Sequence Diagram", "State Diagram", "Class Diagram", "Gantt Chart", 
    "Pie Chart", "User Journey", "Timeline", "Requirement Diagram", "Quadrant Chart", "Git Graph", 
    "Packet Diagram", "Block Diagram"
];

// --- Ollama Helper Functions ---
async function ollamaGenerate(settings: Settings, prompt: string, model: string = 'llama3') {
    const response = await fetch(`${settings.ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, format: 'json' })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Ollama API Error:", errorText);
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    try {
        // The actual JSON payload is often a string inside the 'response' key
        return JSON.parse(data.response);
    } catch(e) {
        console.error("Failed to parse Ollama JSON response string:", data.response, e);
        throw new Error("Ollama returned malformed JSON.");
    }
}

async function ollamaGenerateImage(settings: Settings, prompt: string, imageBase64: string, model: string = 'llava') {
     const response = await fetch(`${settings.ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            images: [imageBase64],
            stream: false
        })
    });
    if (!response.ok) {
         const errorText = await response.text();
        console.error("Ollama API Error:", errorText);
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.response; // Ollama multimodal response is plain text
}

// --- Main AI Service ---

export const geminiService = {
  startChat: (settings: Settings, context?: string): GeminiChat => {
    // Note: For simplicity, Ollama chat is not stateful in the same way.
    // Each message will be a new generation call. A true chat implementation would require more complex state management.
    // The current AIChat component will work with this stateless approach.
    let systemInstruction = "You are a friendly and encouraging AI study assistant called DocMind. Your goal is to help students understand complex topics by providing clear, concise explanations, examples, and study tips. Keep your responses helpful and engaging.";

    if (context) {
        systemInstruction += `\n\nWhen answering questions, your primary source of information should be the following document:\n\n---DOCUMENT START---\n${context}\n---DOCUMENT END---\n\nIf a question cannot be answered using the provided document, clearly state that the document does not contain the answer before providing a general response.`;
    }

    return ai.chats.create({
      model: settings.aiProvider === 'ollama' ? 'llama3' : 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
      },
    });
  },

  startYoutubeChat: (): GeminiChat => {
    // This feature is Gemini-only due to the googleSearch tool requirement.
    const systemInstruction = "You are a helpful AI assistant specialized in discussing YouTube videos. When the user provides a YouTube URL and a question, use Google Search to find information about the video (such as its title, uploader, and general topic). Use this information to answer the user's question. Synthesize the search results into a conversational response. Do not say that you cannot watch videos. Base your answer on the search results.";
    return ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
      },
    });
  },

  generateQuizFromText: async (settings: Settings, text: string, title: string): Promise<{ title: string, questions: QuizQuestion[] }> => {
    const prompt = `Based on the following text, generate a 10-question multiple-choice quiz titled "${title}". Each question should have 4 options, one correct answer, and a brief explanation for the correct answer.

Text to analyze:
---
${text}
---

Return ONLY the quiz in the specified JSON format.`;

    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'The title of the quiz.'
            },
            questions: {
              type: Type.ARRAY,
              description: "An array of quiz questions.",
              items: {
                type: Type.OBJECT,
                properties: {
                  questionText: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["questionText", "options", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["title", "questions"]
        },
      },
    });
    return JSON.parse(response.text);
  },

  generateFlashcardsFromText: async (settings: Settings, text: string, title: string): Promise<{ title: string, cards: { question: string, answer: string }[] }> => {
    const prompt = `Based on the following text, generate a set of at least 10 flashcards titled "${title}". Each flashcard should have a "question" and a concise "answer".

Text to analyze:
---
${text}
---

Return ONLY the flashcards in the specified JSON format. The question should be a real question, and the answer should be a concise response.`;
    
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                },
                required: ["question", "answer"]
              }
            }
          },
          required: ["title", "cards"]
        },
      },
    });
    return JSON.parse(response.text);
  },

  generateMindMapFromText: async (settings: Settings, text: string, title: string): Promise<{ title: string; root: MindMapNode }> => {
    const prompt = `Based on the following text, create a hierarchical mind map.
The output MUST be a JSON object with two keys: "title" (string) and "root" (an object). The JSON MUST be valid and directly parsable.
The "root" object represents the main topic and must have "id", "text", and "children" properties.
- "id" should be a unique string based on the content.
- "text" should be a concise node label.
- "children" must be an array of node objects. Each node object in this array must also have "id", "text", and a "children" array. This structure is recursive.
Create a detailed, nested structure representing the key concepts and their relationships from the text. The root node text should be "${title}".
Do NOT wrap the JSON in markdown fences like \`\`\`json. Return ONLY the raw JSON object string.

Text to analyze:
---
${text}
---
`;
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
  
    let jsonString = response.text.trim();
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(jsonString);
    } catch(e) {
        console.error("Failed to parse mind map JSON from Gemini:", jsonString, e);
        throw new Error("The AI returned a malformed JSON response for the mind map.");
    }
  },

  generateAudioRecapScript: async (settings: Settings, text: string, title: string): Promise<{ title: string; summary: string; script: RecapScriptLine[] }> => {
    const prompt = `Analyze the following text and generate a conversational audio script, like a podcast episode, between two hosts, "Alex" and "Ben".
The script should be titled "${title}". It must start with a brief summary of the content, followed by the dialogue.
The hosts should discuss the key points from the text in an engaging and explanatory way.

Text to analyze:
---
${text}
---

Return ONLY the result in the specified JSON format. The script should have at least 5 lines of dialogue per speaker.`;
    
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            script: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING, enum: ['Alex', 'Ben'] },
                  dialogue: { type: Type.STRING }
                },
                required: ["speaker", "dialogue"]
              }
            }
          },
          required: ["title", "summary", "script"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  },

  answerRecapQuestion: async (settings: Settings, originalText: string, currentScript: RecapScriptLine[], question: string): Promise<RecapScriptLine[]> => {
    const scriptSoFar = currentScript.map(line => `${line.speaker}: ${line.dialogue}`).join('\n');
    const prompt = `You are in the middle of a podcast-style discussion between "Alex" and "Ben" about a specific topic. A user has interrupted to ask a question. Your task is to provide a concise, conversational answer to the user's question, staying in character as Alex and Ben. The answer should be directly related to the original text.

Original Topic Text:
---
${originalText}
---

Discussion so far (including the user's question):
---
${scriptSoFar}
---

User's Question: "${question}"

Provide a short, helpful answer from Alex and Ben. Return ONLY the answer as a valid JSON array of dialogue lines in the specified format.`;

    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    try {
        const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING, enum: ['Alex', 'Ben'] }, dialogue: { type: Type.STRING } }, required: ["speaker", "dialogue"] } }
        }
        });
        const jsonString = response.text.trim();
        return jsonString ? JSON.parse(jsonString) : [{ speaker: 'Alex', dialogue: "I'm not sure how to answer that." }];
    } catch (e) {
        console.error("Gemini API error in answerRecapQuestion:", e);
        return [{ speaker: 'Alex', dialogue: "Sorry, I had a little trouble processing that question." }];
    }
  },

  generateShortQAFromText: async (settings: Settings, text: string): Promise<QAItem[]> => {
    const prompt = `Based on the following text, generate 5 short-answer questions. For each question, provide a concise answer (1-2 sentences maximum).

Text to analyze:
---
${text}
---

Return ONLY the Q&A pairs in the specified JSON format.`;
    
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ["question", "answer"] }
        }
      },
    });
    return JSON.parse(response.text);
  },

  generateLongQAFromText: async (settings: Settings, text: string): Promise<QAItem[]> => {
    const prompt = `Based on the following text, generate 3 long-answer, thought-provoking questions that require a detailed explanation. For each question, provide a comprehensive answer (at least one full paragraph).

Text to analyze:
---
${text}
---

Return ONLY the Q&A pairs in the specified JSON format.`;
    
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ["question", "answer"] }
        }
      },
    });
    return JSON.parse(response.text);
  },
  
  generateQuickReviseFromText: async (settings: Settings, text: string, title: string): Promise<{ title: string; points: RevisionPoint[] }> => {
    const prompt = `Based on the following text, create a "Quick Revise" session titled "${title}".
Identify the most important key points. For EACH key point, provide:
1.  A "simplifiedExplanation" (ELI5 style).
2.  A "detailedExplanation" (a comprehensive paragraph).

Text to analyze:
---
${text}
---

Return ONLY the result in the specified JSON format.`;
    
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyPoint: { type: Type.STRING },
                  simplifiedExplanation: { type: Type.STRING },
                  detailedExplanation: { type: Type.STRING }
                },
                required: ["keyPoint", "simplifiedExplanation", "detailedExplanation"]
              }
            }
          },
          required: ["title", "points"]
        },
      },
    });
    return JSON.parse(response.text);
  },

  generateContentFromImage: async (settings: Settings, prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerateImage(settings, prompt, imageBase64);
    }

    const imagePart = { inlineData: { mimeType, data: imageBase64 } };
    const textPart = { text: prompt };
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    return response.text;
  },

  generateManimCode: async (settings: Settings, concept: string): Promise<string> => {
    const prompt = `You are an expert in Manim (Community Edition v0.17.3). 
Generate Python code for a Manim scene visualizing: "${concept}".
The code must be self-contained in a single class inheriting from 'Scene'.
The scene class should be named based on the concept.
Return ONLY the raw Python code. Do not include explanation or markdown fences.`;

    if (settings.aiProvider === 'ollama') {
        const result = await ollamaGenerate(settings, prompt, 'codellama');
        // codellama might still wrap in markdown
        const rawText = result.response || result;
        const codeBlockMatch = rawText.match(/```(python)?\n([\s\S]*?)\n```/);
        return (codeBlockMatch && codeBlockMatch[2]) ? codeBlockMatch[2].trim() : rawText.trim();
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const rawText = response.text;
    const codeBlockMatch = rawText.match(/```(python)?\n([\s\S]*?)\n```/);
    return (codeBlockMatch && codeBlockMatch[2]) ? codeBlockMatch[2].trim() : rawText.trim();
  },

  generateMermaidDiagram: async (settings: Settings, text: string, diagramType: string, faultyCode?: string, error?: string): Promise<string> => {
    let prompt: string;
    if (faultyCode) {
        prompt = `You are a Mermaid.js expert. Your previous attempt to generate a "${diagramType}" diagram failed with a syntax error. Analyze the following faulty code and error, and provide a corrected, valid Mermaid.js diagram.
PREVIOUS FAULTY CODE:
---
${faultyCode}
---
SYNTAX ERROR:
---
${error || 'Unknown syntax error'}
---
Return ONLY the corrected, raw Mermaid.js code.`;
    } else {
        prompt = `You are a Mermaid.js expert. Based on the following text, create a "${diagramType}" diagram. Strictly follow Mermaid.js syntax. Return ONLY the raw Mermaid.js code.
Text to analyze:
---
${text}
---`;
    }

    if (settings.aiProvider === 'ollama') {
        const result = await ollamaGenerate(settings, prompt);
        const rawText = result.response || result;
        const codeBlockMatch = rawText.match(/```(mermaid)?\n([\s\S]*?)\n```/);
        return (codeBlockMatch && codeBlockMatch[2]) ? codeBlockMatch[2].trim() : rawText.trim();
    }

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const rawText = response.text;
    const codeBlockMatch = rawText.match(/```(mermaid)?\n([\s\S]*?)\n```/);
    return (codeBlockMatch && codeBlockMatch[2]) ? codeBlockMatch[2].trim() : rawText.trim();
  },

  generateAutoDiagram: async (settings: Settings, text: string): Promise<{ diagramType: string; mermaidCode: string }> => {
    const prompt = `Analyze text and select the best Mermaid.js diagram type from: ${diagramTypesForAuto.join(', ')}. Then, generate the code for it. Return a single JSON object with "diagramType" and "mermaidCode" keys.
Text:
---
${text}
---`;
    
    if (settings.aiProvider === 'ollama') {
        return ollamaGenerate(settings, prompt);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagramType: { type: Type.STRING, enum: diagramTypesForAuto },
            mermaidCode: { type: Type.STRING }
          },
          required: ["diagramType", "mermaidCode"]
        }
      }
    });
    return JSON.parse(response.text);
  },
};