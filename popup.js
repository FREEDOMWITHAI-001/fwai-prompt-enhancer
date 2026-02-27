// popup.js — Popup logic & settings management

document.addEventListener('DOMContentLoaded', () => {
  const styleGroup = document.getElementById('styleGroup');
  const modeGroup = document.getElementById('modeGroup');
  const providerGroup = document.getElementById('providerGroup');
  const apiSection = document.getElementById('apiSection');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const apiHint = document.getElementById('apiHint');
  const enhanceCountEl = document.getElementById('enhanceCount');
  const enableToggle = document.getElementById('enableToggle');

  const DEFAULTS = {
    enhancementStyle: 'balanced',
    enhancementMode: 'local',
    apiKey: '',
    apiProvider: 'openai',
    enabled: true,
    enhanceCount: 0
  };

  // ── Load Settings ───────────────────────────────────────────────────────
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    // Style
    setActiveButton(styleGroup, settings.enhancementStyle);

    // Mode
    setActiveButton(modeGroup, settings.enhancementMode);
    apiSection.style.display = settings.enhancementMode === 'ai' ? 'block' : 'none';

    // Provider
    setActiveButton(providerGroup, settings.apiProvider);

    // API Key
    if (settings.apiKey) {
      apiKeyInput.placeholder = 'Key saved (click Save to update)';
    }

    // Count
    enhanceCountEl.textContent = settings.enhanceCount || 0;

    // Enable toggle
    enableToggle.checked = settings.enabled !== false;
  });

  // ── Button Group Handlers ───────────────────────────────────────────────
  function setupButtonGroup(group, storageKey, onChange) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-option');
      if (!btn) return;

      const value = btn.dataset.value;

      // Update UI
      setActiveButton(group, value);

      // Save to storage
      chrome.storage.sync.set({ [storageKey]: value });

      if (onChange) onChange(value);
    });
  }

  function setActiveButton(group, value) {
    group.querySelectorAll('.btn-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  setupButtonGroup(styleGroup, 'enhancementStyle');

  setupButtonGroup(modeGroup, 'enhancementMode', (value) => {
    apiSection.style.display = value === 'ai' ? 'block' : 'none';
  });

  setupButtonGroup(providerGroup, 'apiProvider');

  // ── Save API Key ────────────────────────────────────────────────────────
  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showHint('Please enter an API key', 'error');
      return;
    }

    chrome.storage.sync.set({ apiKey: key }, () => {
      apiKeyInput.value = '';
      apiKeyInput.placeholder = 'Key saved (click Save to update)';
      showHint('API key saved successfully', 'success');
    });
  });

  function showHint(text, type = '') {
    apiHint.textContent = text;
    apiHint.className = 'api-hint' + (type ? ` ${type}` : '');
    setTimeout(() => {
      apiHint.textContent = '';
      apiHint.className = 'api-hint';
    }, 3000);
  }

  // ── Enable/Disable Toggle ──────────────────────────────────────────────
  enableToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: enableToggle.checked });
  });

  // ── Live Count Updates ─────────────────────────────────────────────────
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enhanceCount) {
      enhanceCountEl.textContent = changes.enhanceCount.newValue || 0;
    }
  });
});
