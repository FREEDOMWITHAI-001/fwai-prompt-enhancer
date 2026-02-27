// enhancer.js — Local template-based prompt enhancement engine (CO-STAR + RISEN)

const SUFFIX = '\n\nAsk me as many questions as you need for you to give me the best output.';

// ── Category Keywords (weighted) ──────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  coding: {
    high: ['code', 'function', 'bug', 'debug', 'api', 'database', 'sql', 'html', 'css', 'javascript', 'python', 'typescript', 'react', 'vue', 'angular', 'node', 'backend', 'frontend', 'fullstack', 'algorithm', 'deploy', 'docker', 'git', 'regex', 'script', 'endpoint', 'component', 'class', 'method', 'variable', 'loop', 'array', 'object', 'json', 'xml', 'graphql', 'rest', 'crud', 'authentication', 'authorization'],
    medium: ['build', 'create', 'implement', 'develop', 'program', 'app', 'application', 'website', 'page', 'server', 'client', 'test', 'unit', 'integration', 'error', 'fix', 'refactor', 'optimize', 'performance', 'responsive', 'mobile', 'framework', 'library', 'package', 'module', 'import', 'export'],
    low: ['tool', 'system', 'automate', 'process', 'setup', 'install', 'configure', 'run', 'compile', 'generate']
  },
  writing: {
    high: ['write', 'essay', 'article', 'blog', 'story', 'poem', 'script', 'copy', 'content', 'headline', 'tagline', 'slogan', 'draft', 'edit', 'proofread', 'rewrite', 'paraphrase', 'summarize', 'newsletter', 'press release', 'speech', 'letter', 'email draft', 'caption'],
    medium: ['tone', 'voice', 'audience', 'persuasive', 'narrative', 'paragraph', 'sentence', 'word', 'grammar', 'style', 'creative writing', 'fiction', 'nonfiction', 'memoir', 'novel', 'chapter'],
    low: ['describe', 'explain', 'outline', 'text', 'message', 'post', 'comment']
  },
  analysis: {
    high: ['analyze', 'analysis', 'compare', 'evaluate', 'assess', 'review', 'research', 'study', 'data', 'statistics', 'metrics', 'trends', 'insights', 'findings', 'report', 'audit', 'benchmark', 'survey', 'pros and cons', 'swot'],
    medium: ['measure', 'track', 'monitor', 'investigate', 'examine', 'interpret', 'correlate', 'hypothesis', 'conclusion', 'evidence', 'criteria', 'framework'],
    low: ['check', 'look at', 'figure out', 'understand', 'break down', 'overview']
  },
  creative: {
    high: ['brainstorm', 'idea', 'creative', 'design', 'brand', 'logo', 'illustration', 'art', 'music', 'song', 'video', 'animation', 'game', 'character', 'world-building', 'concept', 'mood board', 'aesthetic', 'visual'],
    medium: ['inspire', 'imagine', 'innovate', 'unique', 'original', 'experiment', 'prototype', 'mockup', 'wireframe', 'sketch', 'storyboard', 'theme', 'palette'],
    low: ['new', 'different', 'interesting', 'fun', 'cool', 'fresh', 'twist']
  },
  business: {
    high: ['business', 'strategy', 'marketing', 'sales', 'revenue', 'profit', 'roi', 'kpi', 'startup', 'pitch', 'investor', 'funding', 'budget', 'forecast', 'proposal', 'plan', 'roadmap', 'okr', 'stakeholder', 'competitive', 'market research', 'go-to-market'],
    medium: ['customer', 'client', 'product', 'service', 'launch', 'growth', 'scale', 'hire', 'team', 'management', 'leadership', 'operations', 'supply chain', 'pricing', 'negotiation'],
    low: ['company', 'work', 'project', 'meeting', 'presentation', 'report', 'goal', 'target']
  },
  learning: {
    high: ['explain', 'teach', 'learn', 'tutorial', 'course', 'lesson', 'understand', 'how does', 'what is', 'why does', 'guide', 'walkthrough', 'step by step', 'beginner', 'advanced', 'intermediate', 'curriculum', 'syllabus'],
    medium: ['concept', 'theory', 'principle', 'fundamentals', 'basics', 'introduction', 'overview', 'deep dive', 'example', 'practice', 'exercise', 'quiz', 'flashcard'],
    low: ['help', 'show', 'tell', 'know', 'mean', 'difference', 'between', 'versus', 'vs']
  }
};

const WEIGHTS = { high: 3, medium: 2, low: 1 };

// ── Specialty Detection ───────────────────────────────────────────────────────
const SPECIALTIES = {
  coding: {
    'react': ['react', 'jsx', 'tsx', 'component', 'hooks', 'usestate', 'useeffect', 'redux', 'next.js', 'nextjs'],
    'python': ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'pip', 'pytorch', 'tensorflow'],
    'javascript': ['javascript', 'js', 'node', 'npm', 'express', 'vanilla js', 'dom', 'es6'],
    'typescript': ['typescript', 'ts', 'type', 'interface', 'generic'],
    'css': ['css', 'tailwind', 'sass', 'scss', 'flexbox', 'grid', 'responsive', 'animation'],
    'html': ['html', 'semantic', 'accessibility', 'a11y', 'wcag', 'dom'],
    'database': ['sql', 'database', 'postgres', 'mysql', 'mongodb', 'redis', 'query', 'schema', 'migration'],
    'api': ['api', 'rest', 'graphql', 'endpoint', 'request', 'response', 'fetch', 'axios'],
    'devops': ['docker', 'kubernetes', 'ci/cd', 'aws', 'azure', 'gcp', 'deploy', 'terraform', 'nginx']
  },
  writing: {
    'blog post': ['blog', 'blog post', 'article'],
    'email': ['email', 'newsletter', 'subject line'],
    'social media': ['social media', 'tweet', 'post', 'caption', 'instagram', 'linkedin', 'twitter', 'tiktok'],
    'academic': ['essay', 'thesis', 'research paper', 'academic', 'citation', 'bibliography'],
    'marketing copy': ['copy', 'ad', 'headline', 'tagline', 'slogan', 'landing page', 'cta', 'conversion'],
    'fiction': ['story', 'novel', 'fiction', 'character', 'plot', 'narrative', 'scene', 'dialogue']
  },
  business: {
    'marketing': ['marketing', 'campaign', 'seo', 'social media', 'content marketing', 'brand'],
    'finance': ['finance', 'budget', 'revenue', 'profit', 'forecast', 'investment', 'roi'],
    'strategy': ['strategy', 'roadmap', 'vision', 'mission', 'okr', 'swot', 'competitive'],
    'sales': ['sales', 'pipeline', 'lead', 'conversion', 'pitch', 'deal', 'crm', 'outreach']
  }
};

// ── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATES = {
  coding: (prompt, specialty, style) => {
    const specialtyLabel = specialty ? ` and ${specialty} specialist` : '';
    const taskBullets = buildTaskBullets(prompt, 'coding', style);
    return [
      `You are an expert software engineer${specialtyLabel} with deep experience in building production-grade applications.`,
      '',
      `Context: A developer needs help with a ${specialty || 'programming'} task. The request involves building or modifying code that should be clean, efficient, and follow best practices.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('coding', style),
      '',
      formatConstraints('coding', style),
    ].join('\n');
  },

  writing: (prompt, specialty, style) => {
    const contentType = specialty || 'content';
    const taskBullets = buildTaskBullets(prompt, 'writing', style);
    return [
      `You are an expert writer and content strategist with years of experience crafting compelling ${contentType}.`,
      '',
      `Context: I need high-quality ${contentType} that engages the target audience, communicates clearly, and achieves its intended purpose.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('writing', style),
      '',
      formatConstraints('writing', style),
    ].join('\n');
  },

  analysis: (prompt, specialty, style) => {
    const taskBullets = buildTaskBullets(prompt, 'analysis', style);
    return [
      `You are a senior analyst and critical thinker with expertise in breaking down complex topics and providing data-driven insights.`,
      '',
      `Context: I need a thorough and well-structured analysis that examines the topic from multiple angles and delivers actionable conclusions.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('analysis', style),
      '',
      formatConstraints('analysis', style),
    ].join('\n');
  },

  creative: (prompt, specialty, style) => {
    const taskBullets = buildTaskBullets(prompt, 'creative', style);
    return [
      `You are a creative director and innovative thinker with a talent for generating original, impactful ideas.`,
      '',
      `Context: I need creative output that is original, engaging, and pushes beyond the obvious. Think outside the box while keeping the output practical and usable.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('creative', style),
      '',
      formatConstraints('creative', style),
    ].join('\n');
  },

  business: (prompt, specialty, style) => {
    const focusArea = specialty || 'business';
    const taskBullets = buildTaskBullets(prompt, 'business', style);
    return [
      `You are an experienced ${focusArea} consultant and strategist who has helped companies of all sizes achieve their goals.`,
      '',
      `Context: I need professional, actionable ${focusArea} guidance that considers real-world constraints, market dynamics, and practical implementation.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('business', style),
      '',
      formatConstraints('business', style),
    ].join('\n');
  },

  learning: (prompt, specialty, style) => {
    const taskBullets = buildTaskBullets(prompt, 'learning', style);
    return [
      `You are a world-class educator and subject matter expert known for making complex topics accessible and engaging.`,
      '',
      `Context: I want to deeply understand a topic. Please teach it in a way that builds intuition, uses clear examples, and progresses logically from fundamentals to deeper concepts.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('learning', style),
      '',
      formatConstraints('learning', style),
    ].join('\n');
  },

  general: (prompt, specialty, style) => {
    const taskBullets = buildTaskBullets(prompt, 'general', style);
    return [
      `You are a knowledgeable and versatile assistant with expertise across many domains.`,
      '',
      `Context: I have a request that requires careful thought and a well-structured response.`,
      '',
      `Task: ${capitalize(prompt)}`,
      ...taskBullets,
      '',
      formatOutput('general', style),
      '',
      formatConstraints('general', style),
    ].join('\n');
  }
};

// ── Output Format by Category ─────────────────────────────────────────────────
function formatOutput(category, style) {
  const formats = {
    coding: {
      concise: 'Output Format: Provide clean, well-commented code.',
      balanced: 'Output Format: Provide complete, well-commented code with brief explanations of key decisions.',
      detailed: 'Output Format: Provide complete, well-commented code with detailed explanations, alternative approaches considered, and suggestions for further improvement.'
    },
    writing: {
      concise: 'Output Format: Provide the finished text, ready to use.',
      balanced: 'Output Format: Provide the finished text with a brief note on tone and structure choices.',
      detailed: 'Output Format: Provide the finished text along with notes on tone, structure, audience considerations, and optional variations.'
    },
    analysis: {
      concise: 'Output Format: Provide key findings and conclusions in a concise summary.',
      balanced: 'Output Format: Structure the analysis with clear sections, key findings, and actionable recommendations.',
      detailed: 'Output Format: Provide a comprehensive analysis with an executive summary, detailed sections with supporting evidence, methodology notes, and prioritized recommendations.'
    },
    creative: {
      concise: 'Output Format: Present the creative output directly.',
      balanced: 'Output Format: Present the creative output with a brief rationale for the creative direction.',
      detailed: 'Output Format: Present multiple creative directions with rationale, mood/tone descriptions, and recommendations for iteration.'
    },
    business: {
      concise: 'Output Format: Provide actionable recommendations in bullet points.',
      balanced: 'Output Format: Structure the response with context, recommendations, and next steps.',
      detailed: 'Output Format: Provide a professional deliverable with executive summary, detailed analysis, implementation roadmap, risk considerations, and success metrics.'
    },
    learning: {
      concise: 'Output Format: Explain clearly with a practical example.',
      balanced: 'Output Format: Explain the concept with examples, then provide a summary of key takeaways.',
      detailed: 'Output Format: Build the explanation progressively from fundamentals, include multiple examples, common pitfalls, practice exercises, and further learning resources.'
    },
    general: {
      concise: 'Output Format: Provide a clear, direct response.',
      balanced: 'Output Format: Provide a well-structured response with key points clearly organized.',
      detailed: 'Output Format: Provide a comprehensive response organized with clear sections, examples where helpful, and a summary of key points.'
    }
  };
  return (formats[category] || formats.general)[style] || formats[category].balanced;
}

// ── Constraints by Category ───────────────────────────────────────────────────
function formatConstraints(category, style) {
  const constraints = {
    coding: 'Constraints: Follow best practices and established conventions. Write clean, maintainable, and well-tested code. Consider edge cases and error handling.',
    writing: 'Constraints: Maintain a consistent tone and voice throughout. Ensure clarity, correct grammar, and engaging flow. Target the appropriate reading level for the audience.',
    analysis: 'Constraints: Base conclusions on evidence and logical reasoning. Acknowledge limitations and assumptions. Maintain objectivity and consider multiple perspectives.',
    creative: 'Constraints: Balance originality with feasibility. Ensure the creative output serves its intended purpose. Stay coherent and purposeful.',
    business: 'Constraints: Ensure recommendations are practical and actionable. Consider budget, timeline, and resource constraints. Back claims with reasoning or data where possible.',
    learning: 'Constraints: Use accurate information and verify key facts. Avoid jargon unless defined. Progress from simple to complex. Include concrete examples.',
    general: 'Constraints: Be accurate, clear, and helpful. Structure the response logically. Prioritize the most important information.'
  };
  return constraints[category] || constraints.general;
}

// ── Task Bullet Points ────────────────────────────────────────────────────────
function buildTaskBullets(prompt, category, style) {
  if (style === 'concise') return [];

  const bullets = {
    coding: [
      '- Write clean, readable code following established conventions',
      '- Include error handling and edge case considerations',
      '- Add helpful comments where the logic is not self-evident'
    ],
    writing: [
      '- Use a tone and style appropriate for the target audience',
      '- Structure the content for maximum readability and engagement',
      '- Ensure the writing achieves its intended purpose'
    ],
    analysis: [
      '- Examine the topic from multiple angles',
      '- Support findings with evidence and reasoning',
      '- Provide actionable conclusions and recommendations'
    ],
    creative: [
      '- Push beyond the obvious while keeping it practical',
      '- Consider the audience and intended impact',
      '- Provide options or variations where appropriate'
    ],
    business: [
      '- Consider real-world constraints and market dynamics',
      '- Provide specific, actionable recommendations',
      '- Include implementation considerations'
    ],
    learning: [
      '- Start with the fundamentals and build progressively',
      '- Use clear, relatable examples',
      '- Highlight common misconceptions and pitfalls'
    ],
    general: [
      '- Address all aspects of the request thoroughly',
      '- Organize the response logically',
      '- Prioritize clarity and usefulness'
    ]
  };

  const categoryBullets = bullets[category] || bullets.general;

  if (style === 'detailed') {
    return ['Consider the following:', ...categoryBullets];
  }
  // balanced: just the first two bullets
  return ['Consider the following:', ...categoryBullets.slice(0, 2)];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function containsCodeBlock(text) {
  return /```[\s\S]*```/.test(text);
}

function isAlreadyEnhanced(text) {
  const markers = [
    'you are an expert',
    'you are a senior',
    'you are a world-class',
    'you are a knowledgeable',
    'you are an experienced',
    'output format:',
    'constraints:',
    'ask me as many questions as you need'
  ];
  const lower = text.toLowerCase();
  let matchCount = 0;
  for (const marker of markers) {
    if (lower.includes(marker)) matchCount++;
  }
  return matchCount >= 2;
}

// ── Category Detection ────────────────────────────────────────────────────────
function detectCategory(prompt) {
  const lower = prompt.toLowerCase();
  const scores = {};

  for (const [category, tiers] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = 0;
    for (const [tier, keywords] of Object.entries(tiers)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          scores[category] += WEIGHTS[tier];
        }
      }
    }
  }

  let best = 'general';
  let bestScore = 0;
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  // Require a minimum score to avoid false classification
  return bestScore >= 2 ? best : 'general';
}

// ── Specialty Detection ───────────────────────────────────────────────────────
function detectSpecialty(prompt, category) {
  const specialtyMap = SPECIALTIES[category];
  if (!specialtyMap) return null;

  const lower = prompt.toLowerCase();
  let best = null;
  let bestCount = 0;

  for (const [specialty, keywords] of Object.entries(specialtyMap)) {
    let count = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = specialty;
    }
  }

  return bestCount > 0 ? best : null;
}

// ── Main Enhancement Function ─────────────────────────────────────────────────
export function enhancePrompt(prompt, style = 'balanced') {
  if (!prompt || typeof prompt !== 'string') return prompt;

  const trimmed = prompt.trim();
  if (!trimmed) return prompt;

  // Already enhanced — return unchanged
  if (isAlreadyEnhanced(trimmed)) {
    return trimmed;
  }

  // Very short prompts (1-2 words): light general wrapper
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 2) {
    return [
      `You are a knowledgeable and versatile assistant.`,
      '',
      `Task: Help me with the following: ${trimmed}`,
      '',
      `Output Format: Provide a clear, well-structured response.`,
      SUFFIX
    ].join('\n');
  }

  // Detect category and specialty
  const category = detectCategory(trimmed);
  const specialty = detectSpecialty(trimmed, category);

  // Long prompts (50+ words): light wrapping that preserves the original
  if (wordCount >= 50) {
    const template = TEMPLATES[category] || TEMPLATES.general;
    // For long prompts, use the original text as-is in the task section
    const role = category === 'coding'
      ? `You are an expert software engineer${specialty ? ` and ${specialty} specialist` : ''}.`
      : category === 'writing'
      ? `You are an expert writer and content strategist.`
      : category === 'analysis'
      ? `You are a senior analyst and critical thinker.`
      : category === 'business'
      ? `You are an experienced business consultant and strategist.`
      : category === 'learning'
      ? `You are a world-class educator and subject matter expert.`
      : category === 'creative'
      ? `You are a creative director and innovative thinker.`
      : `You are a knowledgeable and versatile assistant.`;

    // Preserve code blocks intact
    const hasCode = containsCodeBlock(trimmed);
    const taskContent = hasCode
      ? `\nTask:\n${trimmed}`
      : `\nTask: ${trimmed}`;

    return [
      role,
      taskContent,
      '',
      formatOutput(category, style),
      '',
      formatConstraints(category, style),
      SUFFIX
    ].join('\n');
  }

  // Standard enhancement: full template
  const template = TEMPLATES[category] || TEMPLATES.general;
  const enhanced = template(trimmed, specialty, style);
  return enhanced + SUFFIX;
}

// Export for testing
export { detectCategory, detectSpecialty, isAlreadyEnhanced };
