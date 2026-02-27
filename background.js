// background.js — Service worker: message routing, storage, enhancement orchestration

import { enhancePrompt } from './enhancer.js';
import { aiEnhancePrompt } from './ai-enhancer.js';

// Default settings
const DEFAULTS = {
  enhancementStyle: 'balanced',
  enhancementMode: 'local',
  apiKey: '',
  apiProvider: 'openai',
  enabled: true,
  enhanceCount: 0
};

// Load settings from storage
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (result) => {
      resolve(result);
    });
  });
}

// Increment enhance counter
async function incrementCount() {
  const { enhanceCount } = await getSettings();
  const newCount = (enhanceCount || 0) + 1;
  await chrome.storage.sync.set({ enhanceCount: newCount });
  return newCount;
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENHANCE_PROMPT') {
    handleEnhancement(message.prompt, message.useAI).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_ENABLED') {
    getSettings().then((settings) => {
      sendResponse({ enabled: settings.enabled });
    });
    return true;
  }
});

async function handleEnhancement(prompt, useAI = false) {
  try {
    const settings = await getSettings();

    if (!settings.enabled) {
      return { success: false, error: 'Extension is disabled' };
    }

    let enhanced;

    if (useAI && settings.apiKey) {
      try {
        enhanced = await aiEnhancePrompt(prompt, {
          apiKey: settings.apiKey,
          apiProvider: settings.apiProvider,
          enhancementStyle: settings.enhancementStyle
        });
      } catch (aiError) {
        // Fallback to local enhancement
        console.warn('[Prompt Enhancer] AI failed, falling back to local:', aiError.message);
        enhanced = enhancePrompt(prompt, settings.enhancementStyle);
      }
    } else {
      enhanced = enhancePrompt(prompt, settings.enhancementStyle);
    }

    if (enhanced && enhanced !== prompt) {
      await incrementCount();
    }

    return { success: true, enhanced };
  } catch (error) {
    console.error('[Prompt Enhancer] Enhancement failed:', error);
    return { success: false, error: error.message };
  }
}
