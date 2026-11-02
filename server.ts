// Copyright (c) 2026 Dedi Sukmana - ASF (Autonomous Solution Factory). Proprietary; all rights reserved.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const DIFFICULTY_RUBRIC = `
DIFFICULTY CALIBRATION RUBRIC:
- "Very Easy": Direct recall, foundational definition, or 1-step arithmetic/algebraic substitution. Distractors test basic reading or simple sign slips.
- "Easy": Routine 1–2 step procedural calculation using a standard formula directly taught in the topic. Distractors reflect basic arithmetic errors or inverted operations.
- "Intermediate": 2–3 step application or contextual word problem requiring connecting two sub-concepts or rearranging equations. Distractors represent plausible procedural mistakes (e.g., misapplied exponent/logarithm rule, forgetting domain constraint).
- "Advanced": Multi-step analytical reasoning (3–4+ steps), non-routine AKM numeracy context, or synthesis of multiple mathematical properties. Distractors are subtle and correspond to realistic partial solutions, edge-case oversights, or subtle conceptual misconceptions.
- "Very Advanced": High-order problem solving (HOTS / Olympiad-bridge / deep analytical synthesis), multi-layered deductions, parameter analysis, or rigorous algebraic/geometric proof steps. Distractors are highly sophisticated traps targeting advanced reasoning pitfalls (e.g., extraneous roots, subtle boundary violations, converse fallacies).
`;

function buildMixedDistribution(numQuestions: number): string[] {
  const tiers = ['Very Easy', 'Easy', 'Intermediate', 'Advanced', 'Very Advanced'];
  const distribution: string[] = [];
  for (let i = 0; i < numQuestions; i++) {
    distribution.push(tiers[i % tiers.length]);
  }
  return distribution;
}

app.post('/api/questions/generate', async (req, res) => {
  try {
    const params = req.body?.params;
    if (!params || !params.topic) {
      return res.status(400).json({ error: 'Missing required question generation parameters or topic.' });
    }

    const ai = getGeminiClient();
    const numQuestions = Math.max(1, Math.min(50, Number(params.numQuestions) || 5));
    const qType = String(params.questionType || '1');
    const numOptions = Number(params.numOptions) || 5;

    let difficultyInstruction = '';
    if (params.difficulty === 'Mixed') {
      const targetTiers = buildMixedDistribution(numQuestions);
      const assignmentList = targetTiers.map((tier, idx) => `Question #${idx + 1}: ${tier}`).join(', ');
      difficultyInstruction = `The user selected "Mixed" difficulty. You MUST ensure a balanced distribution across all 5 difficulty levels ("Very Easy", "Easy", "Intermediate", "Advanced", "Very Advanced"). Specifically assign difficulty per question as follows: ${assignmentList}. Set "tingkat_kesulitan" on each question to its assigned tier.`;
    } else {
      difficultyInstruction = `All ${numQuestions} questions MUST strictly adhere to the "${params.difficulty}" difficulty tier. Set "tingkat_kesulitan" on every question to "${params.difficulty}".`;
    }

    const optionLabels = ['A', 'B', 'C', 'D', 'E'].slice(0, numOptions);

    const prompt = `You are a Professional Mathematics Assessment Item Writer specialized in CBT / AKM mathematics assessments.
Generate ${numQuestions} distinct, mathematically rigorous questions in ${params.language}.

ACADEMIC & GENERATION PARAMETERS:
- Education Level: ${params.educationLevel}
- Major / Stream: ${params.major}
- Subject: ${params.subject}
- Topic / Chapter: ${params.topic}
- Grade / Class: ${params.grade}
- Semester: ${params.semester}
- Curriculum: ${params.curriculum}
- Question Type Code (JENIS): ${qType}
- Requested Difficulty: ${params.difficulty}
- Language: ${params.language}
${qType === '1' || qType === '2' ? `- Answer Options per Question: ${numOptions} (${optionLabels.join(', ')})` : ''}

${DIFFICULTY_RUBRIC}

DIFFICULTY ASSIGNMENT REQUIREMENT:
${difficultyInstruction}
Ensure the difficulty is authentically reflected in:
1. Complexity and depth of mathematical concepts involved.
2. Number of logical/algebraic steps required to reach the solution.
3. Subtlety and diagnostic precision of distractors (common student errors for lower tiers vs. sophisticated conceptual/edge-case traps for higher tiers).

DETAILED EXPLANATION (PEMBAHASAN) REQUIREMENT:
Every question MUST include a comprehensive "pembahasan" written in ${params.language} using inline LaTeX ($...$):
- State the relevant mathematical principles, theorems, or formulas used.
- Show clear step-by-step derivation proving why the correct answer is right.
- For Type 1 & Type 2 (Multiple Choice): Explicitly explain why EACH incorrect option (${optionLabels.join(', ')}) is wrong by identifying the specific misconception, sign error, formula misapplication, or trap that leads to that distractor.
- For Type 3 (Matching): Explain the mathematical relationship linking each BARIS item to its corresponding KOLOM match and why alternative pairings fail.
- For Type 4 & Type 5 (Short Answer / Essay): Provide the full step-by-step mathematical rubric, key principles, and common pitfalls to avoid.

STRICT CBT TEMPLATE & LATEX FORMATTING RULES:
1. Wrap ALL mathematical expressions, variables, numbers in equations, and symbols in inline LaTeX mode: $...$ (MathJax compatible, standard LaTeX commands only).
2. Output a JSON array of row objects matching the CBT import template structure:
   - TYPE 1 (Single MC) & TYPE 2 (Complex MC):
     Each question #N produces ${numOptions} consecutive rows in the array (one for each option ${optionLabels.join(', ')}).
     - On the FIRST row of question #N (opsi = "A"): populate "no" (N), "soal" (question stem), "jenis" ("${qType}"), "opsi" ("A"), "jawaban" (option A text), "kunci" ("v" if correct else ""), "tingkat_kesulitan" (tier name), and "pembahasan" (complete explanation covering correct answer + all distractors).
     - On SUBSEQUENT rows of question #N (opsi = B, C, ...): populate "no" (N), "soal" (same question stem or ""), "jenis" ("${qType}"), "opsi", "jawaban", "kunci" ("v" if correct else ""), "tingkat_kesulitan" (same tier name), and "pembahasan" ("" or same explanation — prefer putting fullahasan on row A and "" on rows B..${optionLabels[optionLabels.length - 1]} to avoid bloat, we will normalize it).
     - Type 1 MUST have exact ONE option marked "v" per question. Type 2 MUST have TWO OR MORE options marked "v" per question.
   - TYPE 3 (Matching):
     Each question #N has "no" (N), "soal", "jenis" ("3"), "baris" (left expression), "kolom" (matching right expression), "kunci" ("v"), "tingkat_kesulitan", and "pembahasan".
   - TYPE 4 (Short Answer) & TYPE 5 (Essay):
     Each question #N has "no" (N), "soal", "jenis" ("${qType}"), "jawaban" (exact answer or model solution), "tingkat_kesulitan", and "pembahasan".
3. Double-check all calculations so the marked answer key ("v" or "jawaban") is 100% mathematically accurate.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              no: { type: Type.INTEGER, description: 'Question number (1-indexed)' },
              soal: { type: Type.STRING, description: 'Question stem with $...$ LaTeX' },
              jenis: { type: Type.STRING, description: 'CBT question type code (1, 2, 3, 4, or 5)' },
              opsi: { type: Type.STRING, description: 'Option letter A-E for Type 1 & 2, empty string otherwise' },
              jawaban: { type: Type.STRING, description: 'Option content for Type 1/2, or answer for Type 4/5' },
              kunci: { type: Type.STRING, description: '"v" for correct option/match, "" otherwise' },
              baris: { type: Type.STRING, description: 'Left item for Type 3 matching, "" otherwise' },
              kolom: { type: Type.STRING, description: 'Right item for Type 3 matching, "" otherwise' },
              tingkat_kesulitan: {
                type: Type.STRING,
                description: 'Difficulty tier: Very Easy, Easy, Intermediate, Advanced, or Very Advanced',
              },
              pembahasan: {
                type: Type.STRING,
                description: 'Detailed mathematical explanation with $...$ LaTeX covering why correct answer is right and why distractors are wrong',
              },
            },
            required: ['no', 'soal', 'jenis', 'jawaban', 'tingkat_kesulitan', 'pembahasan'],
          },
        },
      },
    });

    const rawText = (response.text ?? '[]').trim();
    const parsed: any[] = JSON.parse(rawText);

    // Normalize multi-row MC questions so question stem, difficulty, and explanation are consistently accessible
    const explanationByNo = new Map<number, string>();
    const difficultyByNo = new Map<number, string>();
    const soalByNo = new Map<number, string>();

    for (const row of parsed) {
      if (row.no != null) {
        if (row.pembahasan && !explanationByNo.has(row.no)) {
          explanationByNo.set(row.no, row.pembahasan);
        }
        if (row.tingkat_kesulitan && !difficultyByNo.has(row.no)) {
          difficultyByNo.set(row.no, row.tingkat_kesulitan);
        }
        if (row.soal && !soalByNo.has(row.no)) {
          soalByNo.set(row.no, row.soal);
        }
      }
    }

    const seenFirstRow = new Set<number>();
    const normalized = parsed.map((row) => {
      const qNo = Number(row.no);
      const isMC = qType === '1' || qType === '2';
      const isFirstRow = !seenFirstRow.has(qNo);
      if (isFirstRow) seenFirstRow.add(qNo);

      return {
        no: qNo,
        soal: isMC ? (isFirstRow ? (row.soal || soalByNo.get(qNo) || '') : '') : (row.soal || soalByNo.get(qNo) || ''),
        jenis: String(row.jenis || qType),
        opsi: row.opsi || undefined,
        jawaban: row.jawaban ?? '',
        kunci: row.kunci || '',
        baris: row.baris || undefined,
        kolom: row.kolom || undefined,
        tingkat_kesulitan: isMC
          ? (isFirstRow ? (row.tingkat_kesulitan || difficultyByNo.get(qNo) || '') : '')
          : (row.tingkat_kesulitan || difficultyByNo.get(qNo) || ''),
        pembahasan: isMC
          ? (isFirstRow ? (row.pembahasan || explanationByNo.get(qNo) || '') : '')
          : (row.pembahasan || explanationByNo.get(qNo) || ''),
      };
    });

    return res.json({ questions: normalized });
  } catch (error: any) {
    console.error('Error generating questions:', error);
    const status = error?.status || 500;
    return res.status(status).json({
      error: error?.message || 'Failed to generate mathematics questions.',
    });
  }
});

app.post('/api/questions/explain', async (req, res) => {
  try {
    const { questions, params } = req.body || {};
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'No questions provided to explain.' });
    }

    const ai = getGeminiClient();
    const language = params?.language || 'Bahasa Indonesia';
    const qType = String(params?.questionType || questions[0]?.jenis || '1');

    // Group existing rows by question number so the model sees full question + all options
    const groupedMap = new Map<number, any[]>();
    let currentNo = 1;
    for (const q of questions) {
      if (q.no) currentNo = Number(q.no);
      const list = groupedMap.get(currentNo) || [];
      list.push({ ...q, resolvedNo: currentNo });
      groupedMap.set(currentNo, list);
    }

    const questionSummaries = Array.from(groupedMap.entries()).map(([no, rows]) => {
      const stem = rows.find((r) => r.soal)?.soal || '';
      const options = rows
        .filter((r) => r.opsi)
        .map((r) => `${r.opsi}: ${r.jawaban} ${r.kunci === 'v' ? '[CORRECT KEY]' : '[INCORRECT]'}`)
        .join('\n  ');
      const matchInfo = rows[0]?.baris ? `BARIS: ${rows[0].baris} <-> KOLOM: ${rows[0].kolom}` : '';
      const directAnswer = !rows[0]?.opsi && !rows[0]?.baris ? `Expected Answer: ${rows[0]?.jawaban || ''}` : '';

      return `Question #${no}:
  Stem: ${stem}
  ${options ? `Options:\n  ${options}` : ''}${matchInfo}${directAnswer}`;
    });

    const prompt = `You are a Senior Mathematics Assessment Specialist.
Below is a set of previously generated CBT mathematics questions (Topic: ${params?.topic || 'Mathematics'}, Grade: ${params?.grade || ''}, Curriculum: ${params?.curriculum || ''}, Question Type: ${qType}).

For EACH question number, generate:
1. "tingkat_kesulitan": Classify the question's actual difficulty into one of: "Very Easy", "Easy", "Intermediate", "Advanced", or "Very Advanced" based on conceptual complexity, solution steps, and distractor subtlety.
2. "pembahasan": A thorough, pedagogical mathematical explanation in ${language} using inline LaTeX ($...$):
   - Cite the relevant mathematical principles, definitions, or theorems.
   - Show the step-by-step solution derivation confirming why the marked correct answer is right.
   - If Multiple Choice (Type 1 or Type 2), explicitly analyze EACH incorrect option (e.g., Option A, B, D, E) and explain why it is wrong and what student error/misconception it represents.
   - If Matching, Short Answer, or Essay, explain the full mathematical reasoning and highlight common mistakes to avoid.

QUESTIONS TO EXPLAIN:
${questionSummaries.join('\n\n')}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              no: { type: Type.INTEGER, description: 'The question number matching the input' },
              tingkat_kesulitan: {
                type: Type.STRING,
                description: 'Assessed difficulty tier: Very Easy, Easy, Intermediate, Advanced, or Very Advanced',
              },
              pembahasan: {
                type: Type.STRING,
                description: 'Detailed mathematical explanation with $...$ LaTeX for correct answer and all incorrect options',
              },
            },
            required: ['no', 'tingkat_kesulitan', 'pembahasan'],
          },
        },
      },
    });

    const rawText = (response.text ?? '[]').trim();
    const explanations: Array<{ no: number; tingkat_kesulitan: string; pembahasan: string }> = JSON.parse(rawText);

    const expMap = new Map<number, { tingkat_kesulitan: string; pembahasan: string }>();
    for (const item of explanations) {
      expMap.set(Number(item.no), {
        tingkat_kesulitan: item.tingkat_kesulitan,
        pembahasan: item.pembahasan,
      });
    }

    const seenNo = new Set<number>();
    let runningNo = 1;
    const enrichedQuestions = questions.map((q: any) => {
      if (q.no) runningNo = Number(q.no);
      const isMC = qType === '1' || qType === '2';
      const isFirst = !seenNo.has(runningNo);
      if (isFirst) seenNo.add(runningNo);

      const found = expMap.get(runningNo);
      return {
        ...q,
        no: isMC ? (isFirst ? runningNo : q.no) : runningNo,
        tingkat_kesulitan: isMC
          ? (isFirst ? (q.tingkat_kesulitan || found?.tingkat_kesulitan || '') : '')
          : (q.tingkat_kesulitan || found?.tingkat_kesulitan || ''),
        pembahasan: isMC
          ? (isFirst ? (found?.pembahasan || q.pembahasan || '') : '')
          : (found?.pembahasan || q.pembahasan || ''),
      };
    });

    return res.json({ questions: enrichedQuestions });
  } catch (error: any) {
    console.error('Error generating retroactive explanations:', error);
    const status = error?.status || 500;
    return res.status(status).json({
      error: error?.message || 'Failed to generate explanations for existing questions.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
