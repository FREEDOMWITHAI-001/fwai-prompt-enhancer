// ai-enhancer.js — AI-powered prompt enhancement (optional, requires API key)

const META_PROMPT = `You are a prompt engineering expert. Your job is to take a basic user prompt and transform it into a structured, expert-level prompt using the CO-STAR framework combined with RISEN principles.

CO-STAR Framework:
- Context: Background information for the task
- Objective: The clear task/goal
- Style: The writing style or approach
- Tone: The attitude or feeling
- Audience: Who the output is for
- Response: The desired output format

RISEN Principles:
- Role: Define an expert persona
- Instructions: Clear, specific steps
- Steps: Logical sequence
- End goal: What success looks like
- Narrowing: Constraints and boundaries

Rules:
1. Start with a clear expert role/persona
2. Add relevant context about the request
3. Structure the task with clear bullet points when helpful
4. Specify the desired output format
5. Add appropriate constraints
6. ALWAYS end with exactly this line: "Ask me as many questions as you need for you to give me the best output."
7. Do NOT include any preamble like "Here's the enhanced prompt:" — output ONLY the enhanced prompt itself
8. Preserve any code blocks from the original prompt intact
9. If the prompt is already well-structured, make minimal improvements

Transform the following prompt:`;

export async function aiEnhancePrompt(prompt, settings = {}) {
  const { apiKey, apiProvider = 'openai', enhancementStyle = 'balanced' } = settings;

  if (!apiKey) {
    throw new Error('API key is required for AI enhancement');
  }

  const styleInstruction = {
    concise: 'Keep the enhanced prompt concise and focused. Avoid unnecessary elaboration.',
    balanced: 'Create a balanced enhanced prompt — thorough but not excessive.',
    detailed: 'Create a comprehensive, detailed enhanced prompt that covers all angles.'
  }[enhancementStyle] || '';

  const fullMetaPrompt = `${META_PROMPT}\n\n${styleInstruction}\n\n"${prompt}"`;

  try {
    if (apiProvider === 'anthropic') {
      return await callAnthropic(fullMetaPrompt, apiKey);
    }
    return await callOpenAI(fullMetaPrompt, apiKey);
  } catch (error) {
    console.error('[Prompt Enhancer] AI enhancement failed:', error.message);
    throw error;
  }
}

async function callOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a prompt engineering expert. Output only the enhanced prompt, nothing else.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropic(prompt, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || '';
}
