// content.js — Content script: DOM detection, button injection, read/write

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__promptEnhancerLoaded) return;
  window.__promptEnhancerLoaded = true;

  // ── State ─────────────────────────────────────────────────────────────────
  let activeInput = null;
  let enhanceButton = null;
  let isEnhancing = false;
  let hideTimeout = null;
  let hasApiKey = false;
  let isEnabled = true;

  // ── Platform Detection ────────────────────────────────────────────────────
  const PLATFORM_SELECTORS = {
    'chatgpt.com': [
      '#prompt-textarea',
      'div[contenteditable="true"][id="prompt-textarea"]'
    ],
    'chat.openai.com': [
      '#prompt-textarea',
      'div[contenteditable="true"][id="prompt-textarea"]'
    ],
    'claude.ai': [
      '.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"].ProseMirror'
    ],
    'gemini.google.com': [
      '.ql-editor[contenteditable="true"]',
      'rich-textarea [contenteditable="true"]',
      '.text-input-area [contenteditable="true"]'
    ],
    'pup.com': [
      'textarea',
      '[contenteditable="true"]'
    ],
    'lexity.com': [
      'textarea',
      '[contenteditable="true"]'
    ]
  };

  const GENERIC_SELECTORS = [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]'
  ];

  function getHostname() {
    return window.location.hostname.replace(/^www\./, '');
  }

  function getInputSelectors() {
    const hostname = getHostname();
    for (const [domain, selectors] of Object.entries(PLATFORM_SELECTORS)) {
      if (hostname.includes(domain)) {
        return [...selectors, ...GENERIC_SELECTORS];
      }
    }
    return GENERIC_SELECTORS;
  }

  function isMatchingInput(element) {
    if (!element || element.nodeType !== 1) return false;
    const selectors = getInputSelectors();
    for (const selector of selectors) {
      try {
        if (element.matches(selector)) return true;
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return false;
  }

  // ── Read/Write Input ──────────────────────────────────────────────────────
  function readInput(element) {
    if (!element) return '';
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }
    // contenteditable
    return element.innerText || '';
  }

  function writeInput(element, text) {
    if (!element) return;

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      // React-compatible: use native property descriptor setter
      const nativeSet = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value'
      )?.set;

      if (nativeSet) {
        nativeSet.call(element, text);
      } else {
        element.value = text;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // contenteditable (ProseMirror, Quill, etc.)
    element.focus();

    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    // Use execCommand for maximum framework compatibility
    document.execCommand('insertText', false, text);

    // Dispatch events to notify frameworks
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
  }

  // ── Floating Button ───────────────────────────────────────────────────────
  function createButton() {
    if (enhanceButton) return enhanceButton;

    const btn = document.createElement('div');
    btn.id = 'prompt-enhancer-btn';
    btn.innerHTML = `
      <div class="pe-btn-inner">
        <svg class="pe-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        <span class="pe-label">Enhance</span>
      </div>
    `;
    btn.style.display = 'none';
    document.body.appendChild(btn);

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleEnhanceClick(false);
    });

    enhanceButton = btn;
    return btn;
  }

  function positionButton() {
    if (!activeInput || !enhanceButton) return;

    const rect = activeInput.getBoundingClientRect();
    const btnRect = enhanceButton.getBoundingClientRect();

    // Position at bottom-right of the input, inside the boundary
    let top = rect.bottom - btnRect.height - 8;
    let left = rect.right - btnRect.width - 8;

    // Ensure button stays within viewport
    top = Math.max(4, Math.min(top, window.innerHeight - btnRect.height - 4));
    left = Math.max(4, Math.min(left, window.innerWidth - btnRect.width - 4));

    enhanceButton.style.top = `${top}px`;
    enhanceButton.style.left = `${left}px`;
  }

  function showButton() {
    if (!enhanceButton || isEnhancing || !isEnabled) return;
    clearTimeout(hideTimeout);
    enhanceButton.style.display = 'block';
    requestAnimationFrame(positionButton);
  }

  function hideButton(delay = 200) {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (enhanceButton && !isEnhancing) {
        enhanceButton.style.display = 'none';
      }
    }, delay);
  }

  function setButtonState(state) {
    if (!enhanceButton) return;
    const inner = enhanceButton.querySelector('.pe-btn-inner');
    const label = enhanceButton.querySelector('.pe-label');

    enhanceButton.classList.remove('pe-loading', 'pe-success', 'pe-error');

    switch (state) {
      case 'loading':
        enhanceButton.classList.add('pe-loading');
        label.textContent = 'Enhancing...';
        isEnhancing = true;
        break;
      case 'success':
        enhanceButton.classList.add('pe-success');
        label.textContent = 'Enhanced!';
        isEnhancing = false;
        setTimeout(() => {
          setButtonState('idle');
          hideButton(0);
        }, 1500);
        break;
      case 'error':
        enhanceButton.classList.add('pe-error');
        label.textContent = 'Error';
        isEnhancing = false;
        setTimeout(() => setButtonState('idle'), 2000);
        break;
      case 'idle':
      default:
        label.textContent = 'Enhance';
        isEnhancing = false;
        break;
    }
  }

  // ── Enhancement Handler ───────────────────────────────────────────────────
  async function handleEnhanceClick(useAI = false) {
    if (!activeInput || isEnhancing) return;

    const text = readInput(activeInput).trim();
    if (!text) return;

    setButtonState('loading');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ENHANCE_PROMPT',
        prompt: text,
        useAI: useAI
      });

      if (response?.success && response.enhanced) {
        writeInput(activeInput, response.enhanced);
        setButtonState('success');
      } else {
        console.error('[Prompt Enhancer]', response?.error || 'Unknown error');
        setButtonState('error');
      }
    } catch (error) {
      console.error('[Prompt Enhancer] Message failed:', error);
      setButtonState('error');
    }
  }

  // ── Input Tracking ────────────────────────────────────────────────────────
  function onFocusIn(e) {
    const target = e.target;
    if (isMatchingInput(target)) {
      activeInput = target;
      checkAndShowButton();
    }
  }

  function onFocusOut(e) {
    // Delay hide to allow button click
    hideButton(200);
  }

  function onInputChange(e) {
    if (e.target === activeInput) {
      checkAndShowButton();
    }
  }

  function checkAndShowButton() {
    if (!activeInput || !isEnabled) return;
    const text = readInput(activeInput).trim();
    if (text.length >= 3) {
      showButton();
    } else {
      hideButton(0);
    }
  }

  // ── Scroll/Resize Repositioning ───────────────────────────────────────────
  let repositionRAF = null;
  function onScrollOrResize() {
    if (!enhanceButton || enhanceButton.style.display === 'none') return;
    if (repositionRAF) cancelAnimationFrame(repositionRAF);
    repositionRAF = requestAnimationFrame(positionButton);
  }

  // ── MutationObserver for dynamic inputs ───────────────────────────────────
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      // If active input was removed, clear it
      if (activeInput && !document.body.contains(activeInput)) {
        activeInput = null;
        hideButton(0);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ── Keyboard Shortcut ──────────────────────────────────────────────────────
  function onKeyDown(e) {
    // Ctrl+Shift+E (or Cmd+Shift+E on Mac) to enhance
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      e.stopPropagation();

      // If no active input, try the currently focused element
      if (!activeInput && document.activeElement && isMatchingInput(document.activeElement)) {
        activeInput = document.activeElement;
      }

      if (activeInput) {
        const text = readInput(activeInput).trim();
        if (text.length >= 1) {
          handleEnhanceClick(false);
        }
      }
    }
  }

  // ── Initialization ────────────────────────────────────────────────────────
  async function init() {
    // Check if extension is enabled (non-blocking — use defaults if background isn't ready)
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_ENABLED' });
      isEnabled = response?.enabled !== false;
    } catch (e) {
      // Background not ready — assume enabled, will sync later via storage listener
      isEnabled = true;
    }

    // Check if API key is configured (non-blocking)
    try {
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      hasApiKey = !!(settings?.apiKey);
    } catch (e) {
      // Ignore — will sync later
    }

    // Create the button
    createButton();

    // Event listeners
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('input', onInputChange, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    // MutationObserver for dynamic content
    setupObserver();

    // Check if there's already a focused input
    if (document.activeElement && isMatchingInput(document.activeElement)) {
      activeInput = document.activeElement;
      checkAndShowButton();
    }
  }

  // Listen for settings changes
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        isEnabled = changes.enabled.newValue !== false;
        if (!isEnabled) hideButton(0);
      }
      if (changes.apiKey) {
        hasApiKey = !!changes.apiKey.newValue;
      }
    });
  }

  init();
})();
