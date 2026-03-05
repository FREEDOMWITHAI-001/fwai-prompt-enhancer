// content.js — Prompt Genius: DOM detection, button injection, platform-aware enhancement

(function () {
  'use strict';

  if (window.__promptGeniusLoaded) return;
  window.__promptGeniusLoaded = true;

  // ── State ─────────────────────────────────────────────────
  let activeInput = null;
  let enhanceButton = null;
  let isEnhancing = false;
  let hideTimeout = null;
  let lastOriginalText = null;

  // ── Platform Detection ────────────────────────────────────
  const PLATFORMS = {
    'chatgpt.com': {
      name: 'chatgpt',
      selectors: ['#prompt-textarea', 'div[contenteditable="true"][id="prompt-textarea"]']
    },
    'chat.openai.com': {
      name: 'chatgpt',
      selectors: ['#prompt-textarea', 'div[contenteditable="true"][id="prompt-textarea"]']
    },
    'claude.ai': {
      name: 'claude',
      selectors: ['.ProseMirror[contenteditable="true"]', 'div[contenteditable="true"].ProseMirror']
    },
    'gemini.google.com': {
      name: 'gemini',
      selectors: ['.ql-editor[contenteditable="true"]', 'rich-textarea [contenteditable="true"]', '.text-input-area [contenteditable="true"]']
    },
    'copilot.microsoft.com': {
      name: 'copilot',
      selectors: ['textarea', '[contenteditable="true"]']
    },
    'poe.com': {
      name: 'poe',
      selectors: ['textarea', '[contenteditable="true"]']
    },
    'perplexity.ai': {
      name: 'perplexity',
      selectors: ['textarea', '[contenteditable="true"]']
    },
    'you.com': {
      name: 'you',
      selectors: ['textarea', '[contenteditable="true"]']
    }
  };

  const GENERIC_SELECTORS = ['textarea', '[contenteditable="true"]', '[role="textbox"]'];

  function getHostname() {
    return window.location.hostname.replace(/^www\./, '');
  }

  function detectPlatform() {
    const hostname = getHostname();
    for (const [domain, platform] of Object.entries(PLATFORMS)) {
      if (hostname.includes(domain)) return platform;
    }
    return { name: 'other', selectors: [] };
  }

  function getInputSelectors() {
    const platform = detectPlatform();
    return [...platform.selectors, ...GENERIC_SELECTORS];
  }

  function isMatchingInput(element) {
    if (!element || element.nodeType !== 1) return false;
    const selectors = getInputSelectors();
    for (const selector of selectors) {
      try { if (element.matches(selector)) return true; } catch (e) {}
    }
    return false;
  }

  // ── Read / Write Input ────────────────────────────────────
  function readInput(element) {
    if (!element) return '';
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value || '';
    }
    return element.innerText || '';
  }

  function writeInput(element, text) {
    if (!element) return;
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const nativeSet = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value'
      )?.set;
      if (nativeSet) { nativeSet.call(element, text); } else { element.value = text; }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, text);
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: text
    }));
  }

  // ── Clean Markdown ────────────────────────────────────────
  function cleanMarkdown(text) {
    if (!text) return text;
    return text
      .replace(/^#{1,6}\s+(.+)$/gm, (_, h) => h.trim().toUpperCase())
      .replace(/\*\*([^*]+)\*\*/g, (_, c) => c.trim().toUpperCase())
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
      .replace(/^\s*[\*\-]\s+/gm, '- ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ── Floating Button ───────────────────────────────────────
  const STAR_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`;
  const UNDO_SVG = `<svg class="fwai-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
  const REDO_SVG = `<svg class="fwai-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;

  function createButton() {
    if (enhanceButton) return enhanceButton;

    const btn = document.createElement('div');
    btn.id = 'fwai-enhance-btn';
    btn.innerHTML = `
      <div class="fwai-btn-inner">
        <svg class="fwai-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        <span class="fwai-label">Enhance</span>
      </div>
      <div class="fwai-actions">
        <div class="fwai-expand-actions">
          <button class="fwai-action-btn fwai-undo-btn">${UNDO_SVG} Undo</button>
          <span class="fwai-divider"></span>
          <button class="fwai-action-btn fwai-redo-btn">${REDO_SVG} Redo</button>
          <span class="fwai-divider"></span>
        </div>
        <button class="fwai-star-trigger">${STAR_SVG}</button>
      </div>
    `;
    btn.style.display = 'none';
    document.body.appendChild(btn);

    // Prevent focus steal
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Main button click (enhance)
    btn.querySelector('.fwai-btn-inner').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleEnhanceClick();
    });

    // Undo button
    btn.querySelector('.fwai-undo-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleUndo();
    });

    // Redo button
    btn.querySelector('.fwai-redo-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleReEnhance();
    });

    // Star trigger = re-enhance
    btn.querySelector('.fwai-star-trigger').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleReEnhance();
    });

    enhanceButton = btn;
    return btn;
  }

  function positionButton() {
    if (!enhanceButton) return;
    // Fixed at bottom-right corner of viewport — does not scroll with page
    enhanceButton.style.bottom = '24px';
    enhanceButton.style.right = '24px';
    enhanceButton.style.top = '';
    enhanceButton.style.left = '';
  }

  function showButton() {
    if (!enhanceButton || isEnhancing) return;
    clearTimeout(hideTimeout);
    enhanceButton.style.display = 'block';
    requestAnimationFrame(positionButton);
  }

  function hideButton(delay = 0) {
    clearTimeout(hideTimeout);
    if (enhanceButton && !isEnhancing && !enhanceButton.classList.contains('fwai-post-enhance')) {
      if (delay === 0) {
        enhanceButton.style.display = 'none';
      } else {
        hideTimeout = setTimeout(() => {
          if (enhanceButton && !isEnhancing && !enhanceButton.classList.contains('fwai-post-enhance')) {
            enhanceButton.style.display = 'none';
          }
        }, delay);
      }
    }
  }

  function setButtonState(state) {
    if (!enhanceButton) return;
    const label = enhanceButton.querySelector('.fwai-label');

    enhanceButton.classList.remove('fwai-loading', 'fwai-success', 'fwai-error', 'fwai-post-enhance');

    switch (state) {
      case 'loading':
        enhanceButton.classList.add('fwai-loading');
        label.textContent = 'Enhancing...';
        isEnhancing = true;
        break;
      case 'success':
        enhanceButton.classList.add('fwai-success');
        label.textContent = 'Enhanced!';
        isEnhancing = false;
        setTimeout(() => showPostEnhanceActions(), 800);
        break;
      case 'error':
        enhanceButton.classList.add('fwai-error');
        label.textContent = 'Error';
        isEnhancing = false;
        setTimeout(() => setButtonState('idle'), 2000);
        break;
      case 'auth_required':
        enhanceButton.classList.add('fwai-error');
        label.textContent = 'Sign in first';
        isEnhancing = false;
        setTimeout(() => setButtonState('idle'), 2500);
        break;
      case 'idle':
      default:
        label.textContent = 'Enhance';
        isEnhancing = false;
        break;
    }
  }

  function showPostEnhanceActions() {
    if (!enhanceButton || !lastOriginalText) return;
    enhanceButton.classList.remove('fwai-loading', 'fwai-success', 'fwai-error');
    enhanceButton.classList.add('fwai-post-enhance');
    enhanceButton.style.display = 'block';
    clearTimeout(hideTimeout);
    requestAnimationFrame(positionButton);
  }

  function dismissPostEnhance() {
    if (!enhanceButton) return;
    enhanceButton.classList.remove('fwai-post-enhance');
    setButtonState('idle');
    if (activeInput) {
      const text = readInput(activeInput).trim();
      if (text.length >= 3) { showButton(); } else { hideButton(0); }
    } else {
      hideButton(0);
    }
  }

  // ── Extension Context Check ─────────────────────────────────
  function isExtensionContextValid() {
    try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }

  function showRefreshMessage() {
    setButtonState('error');
    const label = enhanceButton?.querySelector('.fwai-label');
    if (label) label.textContent = 'Refresh page';
    isEnhancing = false;
    setTimeout(() => setButtonState('idle'), 3000);
  }

  // ── Enhancement Handler ───────────────────────────────────
  async function handleEnhanceClick() {
    if (!activeInput || isEnhancing) return;
    const text = readInput(activeInput).trim();
    if (!text) return;

    if (!isExtensionContextValid()) { showRefreshMessage(); return; }

    lastOriginalText = text;
    const platform = detectPlatform().name;
    setButtonState('loading');

    try {
      if (!chrome?.runtime?.sendMessage) { showRefreshMessage(); return; }

      const response = await chrome.runtime.sendMessage({
        type: 'ENHANCE_PROMPT', prompt: text, platform: platform
      });

      if (response?.error === 'not_authenticated') { setButtonState('auth_required'); return; }

      if (response?.success && response.enhanced) {
        writeInput(activeInput, cleanMarkdown(response.enhanced));
        setButtonState('success');
      } else {
        console.error('[PromptGenius]', response?.error || 'Unknown error');
        setButtonState('error');
      }
    } catch (error) {
      console.error('[PromptGenius] Message failed:', error);
      if (error.message?.includes('Extension context invalidated') ||
          error.message?.includes('sendMessage') ||
          error.message?.includes('runtime')) {
        showRefreshMessage();
      } else {
        setButtonState('error');
      }
    }
  }

  function handleUndo() {
    if (!activeInput || !lastOriginalText) return;
    writeInput(activeInput, lastOriginalText);
    lastOriginalText = null;
    dismissPostEnhance();
  }

  async function handleReEnhance() {
    if (!activeInput || !lastOriginalText) return;
    writeInput(activeInput, lastOriginalText);
    dismissPostEnhance();
    await new Promise(r => setTimeout(r, 50));
    handleEnhanceClick();
  }

  // ── Input Tracking ────────────────────────────────────────
  function onFocusIn(e) {
    if (isMatchingInput(e.target)) {
      activeInput = e.target;
      checkAndShowButton();
    }
  }

  function onFocusOut() {
    // Persistent — don't hide on focus loss
  }

  function onInputChange(e) {
    if (e.target === activeInput) {
      checkAndShowButton();
    }
  }

  function checkAndShowButton() {
    if (!activeInput) return;
    if (enhanceButton?.classList.contains('fwai-post-enhance')) return;
    const text = readInput(activeInput).trim();
    if (text.length >= 3) { showButton(); } else { hideButton(0); }
  }

  // ── Scroll / Resize (no-op — button is fixed at bottom-right) ──
  function onScrollOrResize() {}

  // ── MutationObserver ──────────────────────────────────────
  function setupObserver() {
    const observer = new MutationObserver(() => {
      if (activeInput && !document.body.contains(activeInput)) {
        activeInput = null;
        hideButton(0);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Keyboard Shortcut ─────────────────────────────────────
  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      e.stopPropagation();
      if (!activeInput && document.activeElement && isMatchingInput(document.activeElement)) {
        activeInput = document.activeElement;
      }
      if (activeInput) {
        const text = readInput(activeInput).trim();
        if (text.length >= 1) handleEnhanceClick();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (enhanceButton?.classList.contains('fwai-post-enhance') && lastOriginalText) {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
      }
    }
  }

  // ── Initialize ────────────────────────────────────────────
  function init() {
    createButton();
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('input', onInputChange, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    setupObserver();

    if (document.activeElement && isMatchingInput(document.activeElement)) {
      activeInput = document.activeElement;
      checkAndShowButton();
    }
  }

  init();
})();
