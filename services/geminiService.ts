import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty, QuestionType, AIGenConfig } from "../types";

// --- HELPER: GET API KEY SAFELY ---
const getApiKey = (): string => {
  if (typeof localStorage !== 'undefined') {
    const localKey = localStorage.getItem('bamboo_ai_api_key');
    if (localKey && localKey.trim().length > 0) return localKey.trim();
  }
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  return '';
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- HELPER: ROBUST JSON PARSING ---
const cleanAndParseJSON = (text: string): any => {
    let cleanText = text.replace(/```json\s*|\s*```/g, "").trim();
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("Direct JSON Parse Failed. Attempting repair mechanism...", e);
        if (cleanText.startsWith("[")) {
            let lastBraceIndex = cleanText.lastIndexOf("}");
            let attempts = 0;
            while (lastBraceIndex > 0 && attempts < 20) {
                const candidate = cleanText.substring(0, lastBraceIndex + 1) + "]";
                try {
                    return JSON.parse(candidate);
                } catch (repairError) {
                    lastBraceIndex = cleanText.lastIndexOf("}", lastBraceIndex - 1);
                    attempts++;
                }
            }
        }
        throw e;
    }
};

// --- PROFESSIONAL TOOL: CLIENT-SIDE OCR (Tesseract) ---
const performLocalOCR = async (fileData: { mimeType: string; data: string }): Promise<string> => {
    // Check if Tesseract is loaded globally via CDN
    // @ts-ignore
    if (typeof Tesseract !== 'undefined') {
        try {
            console.log("Starting Local OCR (Professional Fallback)...");
            const imageUrl = `data:${fileData.mimeType};base64,${fileData.data}`;
            // @ts-ignore
            const { data: { text } } = await Tesseract.recognize(imageUrl, 'vie+eng', {
                logger: (m: any) => console.log(m) // Optional logging
            });
            console.log("OCR Completed:", text.substring(0, 100) + "...");
            return text;
        } catch (e) {
            console.error("Local OCR Failed:", e);
            return "";
        }
    }
    return "";
};

// --- 1. GENERATE QUIZ (Creative Mode) ---
export const generateQuizQuestions = async (
  topic: string,
  config: AIGenConfig, 
  contextText: string = '',
  fileData?: { mimeType: string; data: string }
): Promise<Question[]> => {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Fallback: If image provided, try to OCR it first to give AI more context
    let ocrText = "";
    if (fileData && fileData.mimeType.startsWith('image/')) {
        ocrText = await performLocalOCR(fileData);
    }

    const totalCount = config.typeCounts.single + config.typeCounts.multiple + config.typeCounts.trueFalse + config.typeCounts.short;
    
    // --- CONSTRUCT DETAILED REQUIREMENT PROMPT ---
    const structureReq = `
    - Total Questions: ${totalCount}
    - Question Types Distribution:
      + Single Choice: ${config.typeCounts.single}
      + Multiple Choice: ${config.typeCounts.multiple}
      + True/False: ${config.typeCounts.trueFalse}
      + Short Answer: ${config.typeCounts.short}
    - Difficulty Distribution:
      + Easy (Nhận biết): ${config.difficultyCounts.easy}
      + Medium (Thông hiểu): ${config.difficultyCounts.medium}
      + Hard (Vận dụng): ${config.difficultyCounts.hard}
      + Expert (Vận dụng cao): ${config.difficultyCounts.expert}
    `;

    const strictSystemInstruction = `
      ROLE: Bạn là chuyên gia soạn thảo câu hỏi trắc nghiệm. Để đảm bảo công thức hiển thị đúng trên hệ thống, bạn bắt buộc phải tuân thủ:

      QUY TẮC ĐỊNH DẠNG CÔNG THỨC (QUAN TRỌNG):
      1. Luôn bao quanh công thức Toán/Lý bằng cặp dấu \\( ... \\) (cho cùng dòng) hoặc $$...$$ (cho xuống dòng).
      2. Với công thức Hóa học, phải viết lệnh \\ce{...} nằm bên trong cặp dấu LaTeX. Ví dụ: \\( \\ce{NH3} \\) thay vì chỉ viết \\ce{NH3}.
      3. Không được gửi văn bản thô cho các ký hiệu khoa học mà không có các dấu bao quanh này.
      
      INPUT CONTEXT:
      ${contextText ? `TEXT CONTENT:\n"""${contextText}"""` : ""}
      ${ocrText ? `OCR EXTRACTED TEXT (Use this for accuracy):\n"""${ocrText}"""` : ""}
      
      TASK REQUIREMENTS:
      1. **Context & Directive**: ${topic}
      2. **Structure**: ${structureReq}

      STRICT RULES:
      1. **Source Fidelity**: All questions must be derived **STRICTLY** from the "INPUT CONTEXT" provided above.
      2. **JSON Format**: Return ONLY a JSON array.
      3. **Language**: Vietnamese.
      4. **MANDATORY CORRECT ANSWER**: Determine correct answer strictly based on context.
    `;

    const parts: any[] = [{ text: strictSystemInstruction }];
    if (fileData) parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["SINGLE", "MULTIPLE", "TRUE_FALSE", "SHORT"] },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING }, 
              difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD", "EXPERT"] },
              explanation: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["content", "type", "options", "correctAnswer", "difficulty"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Empty response");
    return mapAIResponseToQuestions(cleanAndParseJSON(response.text));

  } catch (error) {
    console.error("Gemini API Error:", error);
    return []; 
  }
};

// --- 2. PARSE EXAM (Professional Smart Scan) ---
export const parseQuestionsFromDocument = async (
    fileData: { mimeType: string; data: string },
    contextText: string = ''
): Promise<Question[]> => {
    const apiKey = getApiKey();
    if (!apiKey) return [];

    try {
        const ai = new GoogleGenAI({ apiKey });

        // --- PROFESSIONAL HYBRID PARSING ---
        let enhancedContext = contextText;
        if (fileData.mimeType.startsWith('image/')) {
             const ocrResult = await performLocalOCR(fileData);
             if (ocrResult) {
                 enhancedContext += `\n\n[SYSTEM INFO: RAW OCR TEXT LAYER]\n${ocrResult}\n[END OCR LAYER]\nUse the OCR text above to verify specific numbers, formulas, or blurry text in the image.`;
             }
        }

        const extractionSystemInstruction = `
            ROLE: Bạn là chuyên gia OCR và xử lý đề thi.
            
            QUY TẮC ĐỊNH DẠNG CÔNG THỨC (BẮT BUỘC):
            1. Toán/Lý: Bao quanh bằng \\( ... \\) hoặc $$ ... $$.
            2. Hóa học: Bao quanh bằng \\( \\ce{...} \\). Ví dụ: \\( \\ce{H2O} \\).
            3. Giữ nguyên nội dung, không tóm tắt.
            
            OUTPUT FORMAT (JSON Array).
        `;

        const parts: any[] = [{ text: extractionSystemInstruction }];
        if (enhancedContext) parts.push({ text: `Additional Context:\n${enhancedContext}` });
        parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: parts },
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            content: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["SINGLE", "MULTIPLE", "TRUE_FALSE", "SHORT"] },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.STRING },
                            difficulty: { type: Type.STRING },
                            explanation: { type: Type.STRING },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["content", "type", "options", "difficulty"]
                    }
                }
            }
        });

        if (!response.text) throw new Error("Empty response");
        return mapAIResponseToQuestions(cleanAndParseJSON(response.text), true);

    } catch (error) {
        console.error("Gemini Parse Error:", error);
        return [];
    }
};

const mapAIResponseToQuestions = (rawData: any[], isParseMode: boolean = false): Question[] => {
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map((q: any) => {
        let mappedType = QuestionType.SINGLE;
        let mappedCorrect: string[] = [];

        if (q.type === 'MULTIPLE') mappedType = QuestionType.MULTIPLE;
        else if (q.type === 'TRUE_FALSE') mappedType = QuestionType.TRUE_FALSE;
        else if (q.type === 'SHORT') mappedType = QuestionType.SHORT;

        // --- IMPROVED ANSWER MAPPING LOGIC ---
        if (q.correctAnswer) {
            const rawAns = q.correctAnswer.toString();

            if (mappedType === QuestionType.SHORT) {
                mappedCorrect = [rawAns];
            } else {
                // For Choice Questions:
                // 1. Check if the correctAnswer matches the TEXT of one of the options exactly
                const options = q.options || [];
                const matchedIndex = options.findIndex((opt: string) => opt.trim() === rawAns.trim());
                
                if (matchedIndex !== -1) {
                    mappedCorrect = [matchedIndex.toString()];
                } else {
                    // 2. If no text match, assume it's "A", "B", "C", "D"
                    const clean = rawAns.toUpperCase().replace(/[^A-Z,]/g, ''); // Remove non-letters/commas
                    
                    // Split by comma in case of multiple choice (e.g., "A, B")
                    const parts = clean.split(',').filter((s: string) => s.length === 1);
                    
                    if (parts.length > 0) {
                        mappedCorrect = parts.map((char: string) => (char.charCodeAt(0) - 65).toString());
                    } else {
                        // 3. Fallback: If it's True/False and AI returned "True"/"False" text
                        if (mappedType === QuestionType.TRUE_FALSE) {
                             if (rawAns.toLowerCase().includes('true') || rawAns.toLowerCase().includes('đúng')) mappedCorrect = ["0"]; // Usually A is True
                             else if (rawAns.toLowerCase().includes('false') || rawAns.toLowerCase().includes('sai')) mappedCorrect = ["1"]; // B is False
                        }
                    }
                }
            }
        }

        let mappedDiff = Difficulty.MEDIUM;
        // Map simplified enums from AI to App Enums
        const diffStr = q.difficulty?.toUpperCase();
        if (diffStr === 'EASY' || diffStr?.includes('NHẬN BIẾT')) mappedDiff = Difficulty.EASY;
        else if (diffStr === 'HARD' || diffStr?.includes('VẬN DỤNG')) mappedDiff = Difficulty.HARD;
        else if (diffStr === 'EXPERT' || diffStr?.includes('CAO')) mappedDiff = Difficulty.EXPERT;
        else mappedDiff = Difficulty.MEDIUM; // Default/Medium

        return {
            id: generateId(),
            type: mappedType,
            content: q.content,
            options: q.options || [],
            correctAnswers: mappedCorrect,
            explanation: q.explanation || (isParseMode ? 'Được trích xuất từ tài liệu gốc' : 'AI tự động giải thích dựa trên ngữ cảnh.'),
            difficulty: mappedDiff,
            tags: q.tags || (isParseMode ? ['Smart Scan'] : ['AI Generated'])
        };
    });
};

export const analyzePerformance = async (studentResults: any): Promise<any> => { return {}; } // Placeholder