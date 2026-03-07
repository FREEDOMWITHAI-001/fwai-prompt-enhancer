// popup.js — Prompt Genius dashboard

document.addEventListener('DOMContentLoaded', () => {
  const enhanceCountEl = document.getElementById('enhanceCount');
  const historyBtn = document.getElementById('historyBtn');
  const styleGroup = document.getElementById('styleGroup');
  const modeGroup = document.getElementById('modeGroup');
  const apiKeySection = document.getElementById('apiKeySection');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const aiStudioLink = document.getElementById('aiStudioLink');

  // ── Load Settings ─────────────────────────────────────────
  chrome.storage.sync.get({
    enhancementStyle: 'balanced',
    enhancementMode: 'template',
    enhanceCount: 0,
    geminiApiKey: ''
  }, (settings) => {
    enhanceCountEl.textContent = settings.enhanceCount || 0;
    setActiveButton(styleGroup, settings.enhancementStyle);
    setActiveButton(modeGroup, settings.enhancementMode);

    if (settings.enhancementMode === 'gemini') {
      apiKeySection.style.display = '';
    }
    if (settings.geminiApiKey) {
      apiKeyInput.value = settings.geminiApiKey;
      apiKeyStatus.textContent = 'Key saved';
      apiKeyStatus.className = 'api-key-status status-success';
    }
  });

  // ── Button Group Helper ────────────────────────────────────
  function setActiveButton(group, value) {
    group.querySelectorAll('.btn-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  // ── Enhancement Style ─────────────────────────────────────
  styleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-option');
    if (!btn) return;
    setActiveButton(styleGroup, btn.dataset.value);
    chrome.storage.sync.set({ enhancementStyle: btn.dataset.value });
  });

  // ── Enhancement Mode ──────────────────────────────────────
  modeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-option');
    if (!btn) return;
    const mode = btn.dataset.value;
    setActiveButton(modeGroup, mode);
    chrome.storage.sync.set({ enhancementMode: mode });
    apiKeySection.style.display = mode === 'gemini' ? '' : 'none';
  });

  // ── Save API Key ──────────────────────────────────────────
  saveKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      apiKeyStatus.textContent = 'Please enter an API key';
      apiKeyStatus.className = 'api-key-status status-error';
      return;
    }

    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = '...';
    apiKeyStatus.textContent = 'Validating...';
    apiKeyStatus.className = 'api-key-status';

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'VALIDATE_API_KEY',
        apiKey: key
      });

      if (result.success) {
        chrome.storage.sync.set({ geminiApiKey: key });
        apiKeyStatus.textContent = 'Key saved and verified';
        apiKeyStatus.className = 'api-key-status status-success';
      } else {
        apiKeyStatus.textContent = 'Invalid key: ' + (result.error || 'check your key');
        apiKeyStatus.className = 'api-key-status status-error';
      }
    } catch (err) {
      apiKeyStatus.textContent = 'Validation failed: ' + err.message;
      apiKeyStatus.className = 'api-key-status status-error';
    }

    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = 'Save';
  });

  // ── AI Studio Link ────────────────────────────────────────
  aiStudioLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://aistudio.google.com/apikey' });
  });

  // ── History Button ────────────────────────────────────────
  historyBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  // ── Live Count Updates ────────────────────────────────────
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enhanceCount) {
      enhanceCountEl.textContent = changes.enhanceCount.newValue || 0;
    }
  });
});
