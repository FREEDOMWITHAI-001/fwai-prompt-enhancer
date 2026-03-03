const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

// ── Gemini Setup ──────────────────────────────────────────────
// Set your Gemini API key: firebase functions:secrets:set GEMINI_API_KEY
// Or use: firebase functions:config:set gemini.key="YOUR_KEY"

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// ── Auth Middleware ───────────────────────────────────────────

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    return await admin.auth().verifyIdToken(token);
  } catch (e) {
    return null;
  }
}

// ── CORS Helper ──────────────────────────────────────────────

function handleCors(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

// ── Use-Case Categories & Detection ─────────────────────────

const USE_CASES = {
  code_generation: {
    keywords: ["write code", "create a function", "implement", "build a", "generate code", "code for", "script that", "program that", "write a script", "create an app", "develop a", "write me a"],
    framework: "RISEN + CoT",
    tone: "Precise, technical, and pragmatic. Use code terminology. Be direct and specific.",
    role: "a senior software engineer with 15+ years of experience across multiple languages, frameworks, and architectures",
    clarifyingFocus: "the programming language/framework version, performance requirements, error handling expectations, coding style preferences, and deployment environment"
  },
  code_debugging: {
    keywords: ["bug", "error", "fix", "debug", "not working", "broken", "crash", "exception", "issue with", "fails", "doesn't work", "troubleshoot", "stack trace"],
    framework: "RISEN + Reflexion + CoT",
    tone: "Methodical, diagnostic, and systematic. Like a seasoned debugger walking through the problem.",
    role: "a senior debugging specialist and software reliability engineer who has resolved thousands of production issues",
    clarifyingFocus: "the full error message/stack trace, when the issue started, what changed recently, the environment (OS, runtime version), and steps to reproduce"
  },
  code_review: {
    keywords: ["review", "refactor", "optimize", "improve code", "clean up", "code quality", "best practices", "performance", "make it better", "code smell"],
    framework: "RISEN + Reflexion",
    tone: "Constructive, thorough, and standards-driven. Like a thoughtful senior engineer in a code review.",
    role: "a principal engineer and code quality expert specializing in clean architecture, SOLID principles, and performance optimization",
    clarifyingFocus: "the primary optimization goal (readability, performance, maintainability), the project's coding standards, testing requirements, and backward compatibility constraints"
  },
  creative_writing: {
    keywords: ["story", "poem", "write a", "creative", "fiction", "narrative", "character", "dialogue", "screenplay", "novel", "essay", "blog post", "article"],
    framework: "CRISPE + CO-STAR",
    tone: "Evocative, imaginative, and encouraging of creative freedom. Warm and expressive.",
    role: "an award-winning author and creative writing professor with expertise in narrative craft, character development, and multiple literary genres",
    clarifyingFocus: "the target audience and their expectations, desired emotional impact, length/format requirements, any themes or elements to include/avoid, and reference works or styles to emulate"
  },
  marketing_copy: {
    keywords: ["marketing", "ad copy", "slogan", "tagline", "social media", "campaign", "brand", "copywriting", "headline", "landing page", "conversion", "CTA", "SEO"],
    framework: "CO-STAR + AIDA",
    tone: "Persuasive, audience-aware, and conversion-focused. Energetic but professional.",
    role: "a senior marketing strategist and conversion copywriter with expertise in brand voice, consumer psychology, and multi-channel campaigns",
    clarifyingFocus: "the target demographic, brand voice/guidelines, the specific platform or channel, key differentiators/USPs, and what action you want the audience to take"
  },
  business_strategy: {
    keywords: ["strategy", "business", "analyze", "market", "ROI", "KPI", "revenue", "competitive", "stakeholder", "forecast", "growth", "startup", "plan", "roadmap"],
    framework: "CO-STAR + ROSES + CoT",
    tone: "Professional, data-driven, and action-oriented. Confident and strategic.",
    role: "a senior management consultant with 20 years of experience in corporate strategy, market analysis, and organizational transformation across Fortune 500 companies and startups",
    clarifyingFocus: "the industry context, company stage and size, available data/metrics, timeline and resource constraints, key stakeholders, and how success will be measured"
  },
  email_communication: {
    keywords: ["email", "message", "reply", "respond to", "draft", "letter", "communication", "memo", "proposal", "outreach", "follow up", "cold email"],
    framework: "CO-STAR",
    tone: "Context-appropriate: formal for business, warm for personal, persuasive for outreach. Always clear and purposeful.",
    role: "a professional communications specialist with expertise in business writing, persuasion, and cross-cultural communication",
    clarifyingFocus: "the recipient and your relationship with them, the desired outcome, the tone (formal/casual/persuasive), any sensitive topics to handle carefully, and any previous context in the conversation"
  },
  research_academic: {
    keywords: ["research", "study", "paper", "literature", "methodology", "hypothesis", "academic", "journal", "thesis", "dissertation", "cite", "sources", "evidence"],
    framework: "RISEN + CoT + Self-Consistency",
    tone: "Academic, rigorous, and evidence-based. Measured and precise with proper scholarly conventions.",
    role: "a research professor and published academic with expertise in research methodology, critical analysis, and scholarly writing across multiple disciplines",
    clarifyingFocus: "the academic field/discipline, research scope and methodology preferences, required depth and length, citation style (APA, MLA, etc.), and any existing literature or data you're working with"
  },
  data_analysis: {
    keywords: ["data", "dataset", "statistics", "visualization", "trend", "correlation", "regression", "chart", "dashboard", "SQL", "pandas", "analyze data", "insights"],
    framework: "RISEN + ReAct + Self-Consistency",
    tone: "Analytical, methodical, and results-focused. Precise with numbers and clear with interpretations.",
    role: "a senior data scientist and analytics engineer with deep expertise in statistical analysis, data visualization, machine learning, and translating data into actionable business insights",
    clarifyingFocus: "the data source, format, and size, the specific questions to answer, preferred tools/languages (Python, R, SQL), visualization preferences, statistical methods to use, and the audience for the results"
  },
  education_learning: {
    keywords: ["explain", "teach", "learn", "beginner", "concept", "understand", "how does", "what is", "tutorial", "guide", "course", "lesson", "help me understand"],
    framework: "CO-STAR + CoT + Socratic",
    tone: "Patient, clear, and encouraging. Scaffolded from simple to complex. Uses analogies and examples generously.",
    role: "an expert educator and curriculum designer who excels at breaking down complex concepts into intuitive, step-by-step explanations for any learning level",
    clarifyingFocus: "your current knowledge level on this topic, specific areas of confusion, preferred learning style (examples, analogies, visual, hands-on), and what you plan to do with this knowledge"
  },
  brainstorming: {
    keywords: ["brainstorm", "ideas", "suggest", "come up with", "possibilities", "alternatives", "options", "creative solutions", "innovate", "what if", "how might we"],
    framework: "CRISPE + ToT",
    tone: "Expansive, creative, and non-judgmental. Encourages divergent thinking before converging.",
    role: "an innovation strategist and design thinking facilitator who specializes in generating breakthrough ideas through structured creative processes",
    clarifyingFocus: "the problem space and constraints, what solutions have already been considered, evaluation criteria for ideas, how wild/practical the ideas should be, and the timeline for implementation"
  },
  summarization: {
    keywords: ["summarize", "summary", "condense", "key points", "TLDR", "brief", "overview", "highlight", "main ideas", "recap", "digest"],
    framework: "CO-STAR + RISEN",
    tone: "Precise, economical, and hierarchical. Prioritizes signal over noise.",
    role: "an expert analyst and information architect who excels at distilling complex information into clear, hierarchical summaries without losing critical nuance",
    clarifyingFocus: "the desired length/format of the summary, the audience and their expertise level, which aspects to prioritize, whether to include your own analysis/recommendations, and the purpose of the summary"
  },
  translation_language: {
    keywords: ["translate", "translation", "grammar", "proofread", "rewrite in", "convert to", "rephrase", "paraphrase", "language", "tone change", "make it sound"],
    framework: "CO-STAR",
    tone: "Culturally aware, linguistically precise, and context-sensitive. Preserves meaning and intent across transformations.",
    role: "a professional linguist and translator with expertise in cross-cultural communication, idiomatic expression, and context-preserving language transformation",
    clarifyingFocus: "the target language/dialect, the audience and formality level, whether to prioritize literal accuracy or natural flow, any domain-specific terminology to preserve, and cultural considerations"
  },
  math_logic: {
    keywords: ["calculate", "solve", "equation", "math", "proof", "theorem", "logic", "algorithm", "formula", "probability", "statistics", "derive", "compute"],
    framework: "CoT + Self-Consistency + RISEN",
    tone: "Rigorous, step-by-step, and verification-focused. Shows all work with clear logical progression.",
    role: "a mathematics professor and computational expert who specializes in breaking down complex problems into clear, verified step-by-step solutions",
    clarifyingFocus: "the mathematical domain (algebra, calculus, statistics, etc.), the level of detail needed in the solution steps, whether you need the proof/derivation or just the answer, and any specific methods or tools to use"
  },
  general: {
    keywords: [],
    framework: "CO-STAR + CoT",
    tone: "Helpful, thorough, and conversational. Adapts naturally to the request's complexity.",
    role: "a knowledgeable assistant with broad expertise who adapts their depth and approach to match the specific task at hand",
    clarifyingFocus: "the specific context and background, your expectations for the response format, any constraints or preferences, and what you plan to do with the output"
  }
};

function detectUseCase(prompt) {
  const lower = prompt.toLowerCase();
  let bestMatch = "general";
  let bestScore = 0;

  for (const [category, config] of Object.entries(USE_CASES)) {
    if (category === "general") continue;
    let score = 0;
    for (const keyword of config.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(" ").length; // multi-word matches score higher
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  return bestMatch;
}

// ── Platform Optimization ───────────────────────────────────

const PLATFORM_GUIDES = {
  chatgpt: `PLATFORM: ChatGPT (OpenAI)
Optimization: Use clear role definitions ("Act as a..."). Break work into explicit sequential steps. Specify output format precisely (tables, JSON, headings). Add one short example for tone calibration. Include hard limits (word count, sections). Ask the AI to verify rules before answering.`,
  claude: `PLATFORM: Claude (Anthropic)
Optimization: Provide rich context upfront — Claude excels with detailed background. Use structured sections with clear headers. Request the AI to think through its reasoning before answering. For complex tasks, ask for assumptions and tradeoffs. Set explicit length constraints to prevent over-generation.`,
  gemini: `PLATFORM: Gemini (Google)
Optimization: Frame requests with research-oriented language. Specify what counts as a good source. Ask for citations and evidence. Leverage Gemini's strength in synthesis and multi-faceted analysis. Use natural conversational framing rather than rigid templates.`,
  copilot: `PLATFORM: Microsoft Copilot
Optimization: Keep instructions concise and well-structured. Use clear formatting requests. Leverage Copilot's integration context (Office, web). Specify output structure explicitly.`,
  perplexity: `PLATFORM: Perplexity
Optimization: Frame as specific research questions. Request sourced information with citations. Ask for comparison and synthesis across multiple sources. Leverage Perplexity's search-augmented capabilities.`,
  poe: `PLATFORM: Poe
Optimization: Use a universal format with clear role definitions. Specify output structure. Include explicit formatting guidance since Poe routes to various models.`,
  other: `PLATFORM: General AI Assistant
Optimization: Use universally effective techniques — clear role assignment, structured instructions, explicit output format, and specific constraints. These work well across all AI platforms.`
};

// ── Enhancement Style Config ────────────────────────────────

const STYLE_CONFIGS = {
  concise: {
    wordTarget: "150-250 words",
    instruction: "Create a tight, focused enhanced prompt. Add structure and depth without bulk. Every word should earn its place. Prioritize clarity and specificity over comprehensiveness."
  },
  balanced: {
    wordTarget: "250-450 words",
    instruction: "Create a thorough enhanced prompt with clear sections and good depth. Balance structure with readability. Include all critical components without over-engineering."
  },
  detailed: {
    wordTarget: "450-700 words",
    instruction: "Create a comprehensive, detailed enhanced prompt that covers all angles. Include extensive context, detailed step-by-step instructions, multiple output format specifications, and thorough constraints. Leave nothing to assumption."
  }
};

// ── Build the Meta Prompt ───────────────────────────────────

function buildMetaPrompt(prompt, platform, style) {
  const useCase = detectUseCase(prompt);
  const config = USE_CASES[useCase];
  const platformGuide = PLATFORM_GUIDES[platform] || PLATFORM_GUIDES.other;
  const styleConfig = STYLE_CONFIGS[style] || STYLE_CONFIGS.balanced;

  return `You are the world's foremost prompt engineering specialist. You have deep expertise in CO-STAR, RISEN, CRISPE, Chain-of-Thought, Tree-of-Thought, Self-Consistency, ReAct, and Reflexion frameworks. Your singular mission: transform any prompt into a masterfully-crafted prompt that produces exceptional AI outputs.

═══════════════════════════════════════
TASK CLASSIFICATION
═══════════════════════════════════════
Detected category: ${useCase.replace(/_/g, " ").toUpperCase()}
Primary framework to apply: ${config.framework}
Enhancement tone: ${config.tone}

You may override this classification if your analysis determines a different category is more accurate. If so, adjust your approach accordingly.

═══════════════════════════════════════
${platformGuide}
═══════════════════════════════════════

═══════════════════════════════════════
ENHANCEMENT METHODOLOGY
═══════════════════════════════════════
Apply ALL of the following enhancement layers — this is aggressive, thorough enhancement:

1. ROLE ASSIGNMENT (from RISEN + CRISPE)
   Assign a specific, domain-aligned expert persona: "${config.role}"
   Make the role vivid and credible — include years of experience, specific expertise areas, and relevant credentials when natural.

2. CONTEXT ENRICHMENT (from CO-STAR)
   Extract all implicit context from the original prompt and make it explicit. Add relevant background information that would help the AI produce better output. Frame the problem space clearly.

3. OBJECTIVE CRYSTALLIZATION (from CO-STAR + RISEN)
   Transform vague goals into precise, measurable objectives. If the original says "help me with X", specify exactly what success looks like.

4. STRUCTURED INSTRUCTIONS (from RISEN + CoT)
   Break the task into clear, logical steps. For reasoning tasks, include "Think through this step-by-step" instructions. For complex tasks, define phases or stages.

5. OUTPUT FORMAT SPECIFICATION (from CO-STAR + RISEN)
   Always specify exactly how the response should be structured — sections, formats, headings, bullet points, code blocks, tables, etc. Define what a great response looks like.

6. CONSTRAINTS & QUALITY BOUNDARIES (from RISEN)
   Add scope limitations, what to include/exclude, quality criteria, length guidance, and any "do not" instructions that prevent common failure modes.

7. SELF-VERIFICATION INSTRUCTION
   Add: "Before finalizing your response, verify that you have addressed all requirements and check your work for accuracy and completeness."

8. CLARIFYING QUESTIONS FOOTER
   Always end with an instruction asking the AI to ask clarifying questions before proceeding. Tailor the question areas to the task type.

═══════════════════════════════════════
ENHANCEMENT STYLE: ${style.toUpperCase()}
═══════════════════════════════════════
${styleConfig.instruction}
Target: ${styleConfig.wordTarget}

═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════
1. Output ONLY the enhanced prompt — no meta-commentary, no "Here's your enhanced prompt:", no explanations before or after.
2. PRESERVE all code blocks, URLs, specific data, names, technical terms, and quoted text from the original exactly as-is.
3. NEVER fabricate facts, data, or context the user didn't state or clearly imply.
4. ALWAYS enhance heavily — even well-written prompts benefit from better structure, explicit output format, role assignment, and verification steps. Do not hold back.
5. The enhanced prompt must be immediately copy-paste ready — the user will paste it directly into an AI chat.
6. ALWAYS end the enhanced prompt with a variation of: "Before you begin, ask me as many clarifying questions as you need to deliver the best possible output. Focus especially on: ${config.clarifyingFocus}."
7. Match the original prompt's language — if the user writes in Spanish, enhance in Spanish. If English, enhance in English.
8. Do NOT add generic filler. Every added sentence must provide specific value — a clearer objective, useful context, better structure, or meaningful constraint.

═══════════════════════════════════════
ORIGINAL PROMPT TO ENHANCE:
═══════════════════════════════════════
"${prompt}"`;
}

// ══════════════════════════════════════════════════════════════
// CLOUD FUNCTION: /enhance
// ══════════════════════════════════════════════════════════════

exports.enhance = onRequest(
  { cors: true, maxInstances: 50, timeoutSeconds: 30, secrets: ["GEMINI_API_KEY"] },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Auth check
    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { prompt, platform = "other", style = "balanced" } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({ error: "Prompt too long (max 10,000 characters)" });
    }

    try {
      const model = getGeminiModel();
      const trimmedPrompt = prompt.trim();
      const useCase = detectUseCase(trimmedPrompt);
      const metaPrompt = buildMetaPrompt(trimmedPrompt, platform, style);

      const result = await model.generateContent(metaPrompt);
      const enhanced = result.response.text().trim();

      if (!enhanced) {
        return res.status(500).json({ error: "AI returned empty response" });
      }

      // Save to Firestore (async, don't block response)
      const historyEntry = {
        original: trimmedPrompt,
        enhanced,
        platform,
        style,
        useCase,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      // Fire-and-forget: save to user's history and increment count
      const userRef = db.collection("users").doc(user.uid);
      Promise.all([
        userRef.collection("history").add(historyEntry),
        userRef.set(
          {
            email: user.email || "",
            enhanceCount: admin.firestore.FieldValue.increment(1),
            lastActive: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        )
      ]).catch((e) => console.error("Firestore write failed:", e));

      return res.status(200).json({ enhanced });
    } catch (error) {
      console.error("Enhancement failed:", error);
      return res.status(500).json({ error: "Enhancement failed. Please try again." });
    }
  }
);

// ══════════════════════════════════════════════════════════════
// CLOUD FUNCTION: /history
// ══════════════════════════════════════════════════════════════

exports.history = onRequest(
  { cors: true, maxInstances: 10 },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const snapshot = await db
        .collection("users")
        .doc(user.uid)
        .collection("history")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toMillis() || null
      }));

      return res.status(200).json({ history, total: history.length });
    } catch (error) {
      console.error("History fetch failed:", error);
      return res.status(500).json({ error: "Failed to fetch history" });
    }
  }
);

// ══════════════════════════════════════════════════════════════
// CLOUD FUNCTION: /user (get user stats)
// ══════════════════════════════════════════════════════════════

exports.user = onRequest(
  { cors: true, maxInstances: 10 },
  async (req, res) => {
    if (handleCors(req, res)) return;

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      const data = userDoc.exists ? userDoc.data() : {};

      return res.status(200).json({
        email: user.email,
        enhanceCount: data.enhanceCount || 0,
        lastActive: data.lastActive?.toDate()?.toISOString() || null
      });
    } catch (error) {
      console.error("User fetch failed:", error);
      return res.status(500).json({ error: "Failed to fetch user data" });
    }
  }
);
