// background.js — Prompt Genius: Gemini AI-powered enhancement with template fallback

// ── Gemini API Enhancement ──────────────────────────────────────

async function enhanceWithGemini(prompt, platform, style, apiKey) {
  const styleGuide = {
    concise: 'Keep the enhanced prompt brief and focused. No unnecessary verbosity.',
    balanced: 'Add moderate structure and detail. Balance clarity with brevity.',
    detailed: 'Be comprehensive. Add thorough structure, edge cases, and detailed instructions.'
  };

  const systemPrompt = `You are an expert prompt engineer. Your job is to take a user's raw prompt and enhance it to get better results from AI models.

Rules:
- Maintain the original intent and meaning completely
- Add structure, clarity, and specificity
- Add a relevant role/persona assignment if appropriate
- Add output format guidance if helpful
- Style preference: ${styleGuide[style] || styleGuide.balanced}
- The user is writing this prompt for: ${platform}
- Return ONLY the enhanced prompt text, ready to paste
- Do NOT add meta-commentary, explanations, or wrap in quotes
- Do NOT use markdown headers (##) or bold (**) formatting — output plain text`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

// ── Template-Based Enhancement (fallback) ───────────────────────

const USE_CASES = {
  code_generation: {
    keywords: ['write code', 'create a function', 'implement', 'build a', 'generate code', 'code for', 'script that', 'program that', 'write a script', 'create an app', 'develop a', 'write me a'],
    role: 'a senior software engineer with 15+ years of experience',
    sections: ['Requirements', 'Technical Constraints', 'Expected Output Format', 'Edge Cases to Handle'],
    suffix: 'Please specify the programming language, framework version, error handling expectations, and deployment environment.'
  },
  code_debugging: {
    keywords: ['bug', 'error', 'fix', 'debug', 'not working', 'broken', 'crash', 'exception', 'issue with', 'fails', "doesn't work", 'troubleshoot', 'stack trace'],
    role: 'a senior debugging specialist and software reliability engineer',
    sections: ['Problem Description', 'Expected vs Actual Behavior', 'Environment Details', 'Steps to Reproduce'],
    suffix: 'Please share the full error message/stack trace, when the issue started, what changed recently, and your environment (OS, runtime version).'
  },
  code_review: {
    keywords: ['review', 'refactor', 'optimize', 'improve code', 'clean up', 'code quality', 'best practices', 'performance', 'make it better'],
    role: 'a principal engineer specializing in clean architecture and performance optimization',
    sections: ['Code Context', 'Optimization Goals', 'Quality Criteria', 'Constraints'],
    suffix: 'Please clarify the primary goal (readability, performance, maintainability), coding standards, and backward compatibility constraints.'
  },
  creative_writing: {
    keywords: ['story', 'poem', 'write a', 'creative', 'fiction', 'narrative', 'character', 'dialogue', 'screenplay', 'novel', 'essay', 'blog post', 'article'],
    role: 'an award-winning author and creative writing professor',
    sections: ['Creative Brief', 'Tone & Style', 'Target Audience', 'Key Elements to Include'],
    suffix: 'Please clarify the target audience, desired emotional impact, length/format, themes to include/avoid, and any reference styles.'
  },
  marketing_copy: {
    keywords: ['marketing', 'ad copy', 'slogan', 'tagline', 'social media', 'campaign', 'brand', 'copywriting', 'headline', 'landing page', 'SEO'],
    role: 'a senior marketing strategist and conversion copywriter',
    sections: ['Campaign Objective', 'Target Audience', 'Brand Voice', 'Call to Action'],
    suffix: 'Please specify the target demographic, brand guidelines, platform/channel, key differentiators, and desired audience action.'
  },
  business_strategy: {
    keywords: ['strategy', 'business', 'analyze', 'market', 'ROI', 'KPI', 'revenue', 'competitive', 'forecast', 'growth', 'startup', 'plan', 'roadmap'],
    role: 'a senior management consultant with 20 years of corporate strategy experience',
    sections: ['Strategic Objective', 'Context & Constraints', 'Success Metrics', 'Timeline'],
    suffix: 'Please provide the industry context, company stage/size, available data, timeline, and how success will be measured.'
  },
  email_communication: {
    keywords: ['email', 'message', 'reply', 'respond to', 'draft', 'letter', 'communication', 'memo', 'proposal', 'outreach', 'follow up', 'cold email'],
    role: 'a professional communications specialist',
    sections: ['Purpose', 'Recipient Context', 'Key Points', 'Desired Outcome'],
    suffix: 'Please clarify the recipient and your relationship, the desired outcome, tone (formal/casual), and any sensitive topics.'
  },
  research_academic: {
    keywords: ['research', 'study', 'paper', 'literature', 'methodology', 'hypothesis', 'academic', 'journal', 'thesis', 'cite', 'sources', 'evidence'],
    role: 'a research professor and published academic',
    sections: ['Research Question', 'Scope & Methodology', 'Expected Depth', 'Citation Requirements'],
    suffix: 'Please specify the academic field, research scope, required depth, citation style (APA, MLA), and existing literature.'
  },
  data_analysis: {
    keywords: ['data', 'dataset', 'statistics', 'visualization', 'trend', 'correlation', 'regression', 'chart', 'dashboard', 'SQL', 'pandas', 'analyze data', 'insights'],
    role: 'a senior data scientist and analytics engineer',
    sections: ['Analysis Objective', 'Data Description', 'Methods & Tools', 'Output Format'],
    suffix: 'Please describe the data source/format, specific questions to answer, preferred tools (Python, R, SQL), and audience for results.'
  },
  education_learning: {
    keywords: ['explain', 'teach', 'learn', 'beginner', 'concept', 'understand', 'how does', 'what is', 'tutorial', 'guide', 'course', 'lesson', 'help me understand'],
    role: 'an expert educator who excels at breaking down complex concepts',
    sections: ['Learning Objective', 'Current Knowledge Level', 'Preferred Explanation Style', 'Practical Application'],
    suffix: 'Please share your current knowledge level, areas of confusion, preferred learning style (examples, analogies, hands-on), and goals.'
  },
  brainstorming: {
    keywords: ['brainstorm', 'ideas', 'suggest', 'come up with', 'possibilities', 'alternatives', 'options', 'creative solutions', 'innovate', 'what if'],
    role: 'an innovation strategist and design thinking facilitator',
    sections: ['Problem Space', 'Constraints', 'Evaluation Criteria', 'Scope (wild vs practical)'],
    suffix: 'Please describe the problem constraints, what has been tried, criteria for evaluating ideas, and timeline for implementation.'
  },
  summarization: {
    keywords: ['summarize', 'summary', 'condense', 'key points', 'TLDR', 'brief', 'overview', 'highlight', 'main ideas', 'recap'],
    role: 'an expert analyst who distills complex information into clear summaries',
    sections: ['Source Material', 'Summary Format', 'Priority Areas', 'Audience'],
    suffix: 'Please specify desired length/format, audience expertise level, which aspects to prioritize, and purpose of the summary.'
  },
  translation_language: {
    keywords: ['translate', 'translation', 'grammar', 'proofread', 'rewrite in', 'convert to', 'rephrase', 'paraphrase', 'language', 'tone change'],
    role: 'a professional linguist and translator',
    sections: ['Source Text', 'Target Language/Style', 'Context', 'Preservation Requirements'],
    suffix: 'Please specify the target language/dialect, formality level, whether to prioritize accuracy or flow, and domain terminology.'
  },
  math_logic: {
    keywords: ['calculate', 'solve', 'equation', 'math', 'proof', 'theorem', 'logic', 'algorithm', 'formula', 'probability', 'derive', 'compute'],
    role: 'a mathematics professor and computational expert',
    sections: ['Problem Statement', 'Known Variables', 'Required Method', 'Solution Detail Level'],
    suffix: 'Please specify the mathematical domain, detail needed in steps, whether you need proof/derivation or just the answer, and tools to use.'
  }
};

const GENERAL_CASE = {
  role: 'a knowledgeable expert who adapts depth and approach to match the task',
  sections: ['Objective', 'Context', 'Requirements', 'Output Format'],
  suffix: 'Before you begin, ask me any clarifying questions you need to deliver the best possible output.'
};

function detectUseCase(prompt) {
  const lower = prompt.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const [category, config] of Object.entries(USE_CASES)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.split(' ').length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  return bestMatch ? USE_CASES[bestMatch] : GENERAL_CASE;
}

function enhancePromptTemplate(prompt, platform = 'other', style = 'balanced') {
  const useCase = detectUseCase(prompt);

  let depth;
  if (style === 'concise') {
    depth = { intro: true, sections: false, verify: false };
  } else if (style === 'detailed') {
    depth = { intro: true, sections: true, verify: true };
  } else {
    depth = { intro: true, sections: true, verify: false };
  }

  let enhanced = '';
  enhanced += `Act as ${useCase.role}.\n\n`;
  enhanced += `## Task\n${prompt.trim()}\n\n`;

  if (depth.sections) {
    enhanced += `## Instructions\n`;
    enhanced += `- Think through this step-by-step before responding.\n`;
    enhanced += `- Provide specific, actionable answers rather than generic advice.\n`;
    enhanced += `- Use concrete examples where helpful.\n`;
    enhanced += `- Structure your response with clear headings and formatting.\n\n`;

    enhanced += `## Expected Response Structure\n`;
    for (const section of useCase.sections) {
      enhanced += `- **${section}**: Address this clearly.\n`;
    }
    enhanced += `\n`;
  }

  enhanced += `## Constraints\n`;
  enhanced += `- Be thorough but avoid filler — every sentence should add value.\n`;
  enhanced += `- If you're unsure about something, say so rather than guessing.\n`;
  if (style === 'concise') {
    enhanced += `- Keep the response concise and focused.\n`;
  } else if (style === 'detailed') {
    enhanced += `- Be comprehensive — cover all angles and edge cases.\n`;
  }
  enhanced += `\n`;

  if (depth.verify) {
    enhanced += `Before finalizing your response, verify that you have addressed all requirements and check your work for accuracy and completeness.\n\n`;
  }

  enhanced += `${useCase.suffix}`;
  return enhanced;
}

// ── Message Handler ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENHANCE_PROMPT') {
    chrome.storage.sync.get(
      { enhancementStyle: 'balanced', enhanceCount: 0, geminiApiKey: '', enhancementMode: 'template' },
      async (s) => {
        try {
          let enhanced;

          if (s.enhancementMode === 'gemini' && s.geminiApiKey) {
            enhanced = await enhanceWithGemini(message.prompt, message.platform, s.enhancementStyle, s.geminiApiKey);
          } else {
            enhanced = enhancePromptTemplate(message.prompt, message.platform, s.enhancementStyle);
          }

          const newCount = (s.enhanceCount || 0) + 1;
          chrome.storage.sync.set({ enhanceCount: newCount });

          saveToLocalHistory({
            original: message.prompt,
            enhanced,
            platform: message.platform,
            style: s.enhancementStyle,
            mode: s.enhancementMode === 'gemini' && s.geminiApiKey ? 'gemini' : 'template',
            timestamp: Date.now()
          });

          sendResponse({ success: true, enhanced });
        } catch (error) {
          console.error('[PromptGenius] Enhancement failed:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
    );
    return true;
  }

  if (message.type === 'GET_HISTORY') {
    handleGetHistory(message.limit, message.offset).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get({
      enhancementStyle: 'balanced',
      enhanceCount: 0,
      enhancementMode: 'template',
      geminiApiKey: ''
    }, sendResponse);
    return true;
  }

  if (message.type === 'VALIDATE_API_KEY') {
    validateGeminiKey(message.apiKey).then(sendResponse);
    return true;
  }
});

// ── API Key Validation ──────────────────────────────────────────

async function validateGeminiKey(apiKey) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "ok"' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      }
    );
    if (response.ok) return { success: true };
    const err = await response.text();
    return { success: false, error: `API returned ${response.status}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Local History ───────────────────────────────────────────────

async function saveToLocalHistory(entry) {
  try {
    const { promptHistory = [] } = await chrome.storage.local.get('promptHistory');
    promptHistory.unshift(entry);
    if (promptHistory.length > 200) {
      promptHistory.length = 200;
    }
    await chrome.storage.local.set({ promptHistory });
  } catch (e) {
    console.error('[PromptGenius] Failed to save history:', e);
  }
}

async function handleGetHistory(limit = 50, offset = 0) {
  try {
    const { promptHistory = [] } = await chrome.storage.local.get('promptHistory');
    return {
      success: true,
      history: promptHistory.slice(offset, offset + limit),
      total: promptHistory.length
    };
  } catch (e) {
    return { success: false, error: e.message, history: [] };
  }
}
