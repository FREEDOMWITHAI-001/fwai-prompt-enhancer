// background.js — Prompt Genius service worker: auth-aware message routing + API calls

// ── Auth Helpers ──────────────────────────────────────────────

async function getAuth() {
  const { auth } = await chrome.storage.local.get('auth');
  if (!auth || !auth.idToken) return null;

  // Refresh if token is expiring within 1 minute
  if (Date.now() >= auth.expiresAt - 60000) {
    try {
      const { firebase } = await getConfig();
      const res = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${firebase.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: auth.refreshToken
          })
        }
      );
      const data = await res.json();
      if (data.error) {
        await chrome.storage.local.remove('auth');
        return null;
      }
      auth.idToken = data.id_token;
      auth.refreshToken = data.refresh_token;
      auth.expiresAt = Date.now() + (parseInt(data.expires_in || '3600') * 1000);
      await chrome.storage.local.set({ auth });
    } catch (e) {
      await chrome.storage.local.remove('auth');
      return null;
    }
  }

  return auth;
}

async function getConfig() {
  // Config is loaded synchronously via importScripts in service worker
  // But we need to handle the case where it might not be available
  if (typeof FWAI_CONFIG !== 'undefined') {
    return FWAI_CONFIG;
  }
  return {
    firebase: { apiKey: '', projectId: '' },
    functions: { enhance: '', history: '', user: '' },
    app: { defaultStyle: 'balanced' }
  };
}

// ── Import config ────────────────────────────────────────────
try {
  importScripts('config.js');
} catch (e) {
  console.error('[PromptGenius] Failed to load config.js:', e);
}

// ── Message Handler ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENHANCE_PROMPT') {
    handleEnhancement(message.prompt, message.platform).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_HISTORY') {
    handleGetHistory(message.limit, message.offset).then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_AUTH') {
    getAuth().then(auth => {
      sendResponse({ authenticated: !!auth, email: auth?.email });
    });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get({
      enhancementStyle: 'balanced',
      enhanceCount: 0
    }, sendResponse);
    return true;
  }
});

// ── Enhancement ──────────────────────────────────────────────

async function handleEnhancement(prompt, platform = 'other') {
  try {
    const auth = await getAuth();
    if (!auth) {
      return { success: false, error: 'not_authenticated' };
    }

    const settings = await new Promise(resolve => {
      chrome.storage.sync.get({ enhancementStyle: 'balanced', enhanceCount: 0 }, resolve);
    });

    const config = await getConfig();
    const enhanceUrl = config.functions?.enhance;
    if (!enhanceUrl || enhanceUrl.startsWith('YOUR_')) {
      return { success: false, error: 'Extension not configured. Please set up the backend.' };
    }

    // Call Cloud Function
    const res = await fetch(enhanceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.idToken}`
      },
      body: JSON.stringify({
        prompt,
        platform,
        style: settings.enhancementStyle
      })
    });

    if (res.status === 401) {
      await chrome.storage.local.remove('auth');
      return { success: false, error: 'not_authenticated' };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `Server error: ${res.status}` };
    }

    const data = await res.json();

    if (data.enhanced) {
      // Increment local counter
      const newCount = (settings.enhanceCount || 0) + 1;
      await chrome.storage.sync.set({ enhanceCount: newCount });

      // Save to local history
      await saveToLocalHistory({
        original: prompt,
        enhanced: data.enhanced,
        platform,
        style: settings.enhancementStyle,
        timestamp: Date.now()
      });

      return { success: true, enhanced: data.enhanced };
    }

    return { success: false, error: 'No enhanced text returned' };
  } catch (error) {
    console.error('[PromptGenius] Enhancement failed:', error);
    return { success: false, error: error.message };
  }
}

// ── Local History ────────────────────────────────────────────

async function saveToLocalHistory(entry) {
  try {
    const { promptHistory = [] } = await chrome.storage.local.get('promptHistory');
    promptHistory.unshift(entry);
    // Keep last 200 entries
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
