// content.js — Prompt Genius: universal input detection, button injection, AI-powered enhancement

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

  // ── Prompt Input Detection ──────────────────────────────────
  // The manifest restricts which sites the script runs on.
  // This function filters for actual AI prompt inputs vs other textareas
  // (settings, feedback forms, search bars, etc.) on those sites.
  function isPromptInput(element) {
    if (!element || element.nodeType !== 1) return false;

    const isTextArea = element.tagName === 'TEXTAREA';
    const isContentEditable = element.getAttribute('contenteditable') === 'true';
    if (!isTextArea && !isContentEditable) return false;

    // Skip hidden/tiny elements
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.width < 150) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    // Skip elements inside traditional HTML forms (login, feedback, settings, etc.)
    const parentForm = element.closest('form');
    if (parentForm && parentForm.getAttribute('action')) return false;

    // Skip single-line search-like inputs
    if (isTextArea && element.rows <= 1 && rect.height < 50) {
      const ph = (element.placeholder || '').toLowerCase();
      if (!ph.includes('message') && !ph.includes('prompt') && !ph.includes('ask') && !ph.includes('chat') && !ph.includes('type')) {
        return false;
      }
    }

    // Skip inputs with roles/types that indicate non-prompt usage
    const role = (element.getAttribute('role') || '').toLowerCase();
    if (role === 'search' || role === 'searchbox') return false;

    const type = (element.getAttribute('type') || '').toLowerCase();
    if (type === 'search' || type === 'email' || type === 'password' || type === 'url') return false;

    return true;
  }

  function detectPlatformName() {
    const hostname = window.location.hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    // e.g. "chatgpt.com" → "chatgpt", "claude.ai" → "claude", "chat.deepseek.com" → "deepseek"
    return parts.length >= 2 ? parts[parts.length - 2] : hostname;
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
    if (!activeInput || !document.body.contains(activeInput)) {
      enhanceButton.style.top = '';
      enhanceButton.style.left = '';
      enhanceButton.style.bottom = '80px';
      enhanceButton.style.right = '24px';
      return;
    }
    const rect = activeInput.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      enhanceButton.style.top = '';
      enhanceButton.style.left = '';
      enhanceButton.style.bottom = '80px';
      enhanceButton.style.right = '24px';
      return;
    }
    const btnHeight = 30;
    const btnWidth = 95;
    const padding = 8;
    let top = rect.bottom - btnHeight - padding;
    let left = rect.right - btnWidth - padding;
    top = Math.max(4, Math.min(top, window.innerHeight - btnHeight - 4));
    left = Math.max(4, Math.min(left, window.innerWidth - btnWidth - 4));
    enhanceButton.style.top = top + 'px';
    enhanceButton.style.left = left + 'px';
    enhanceButton.style.bottom = '';
    enhanceButton.style.right = '';
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
    const platform = detectPlatformName();
    setButtonState('loading');

    try {
      if (!chrome?.runtime?.sendMessage) { showRefreshMessage(); return; }

      const response = await chrome.runtime.sendMessage({
        type: 'ENHANCE_PROMPT', prompt: text, platform: platform
      });

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

  // ── ResizeObserver — reposition when input box grows/shrinks ──
  let resizeObserver = null;

  function observeInputResize(element) {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(() => {
      if (enhanceButton && enhanceButton.style.display !== 'none') {
        requestAnimationFrame(positionButton);
      }
    });
    resizeObserver.observe(element);
    if (element.parentElement) {
      resizeObserver.observe(element.parentElement);
    }
  }

  // ── Input Tracking ────────────────────────────────────────
  function onFocusIn(e) {
    if (isPromptInput(e.target)) {
      activeInput = e.target;
      observeInputResize(activeInput);
      checkAndShowButton();
    } else {
      // Check if the focused element is inside a contenteditable
      const match = e.target.closest('[contenteditable="true"]');
      if (match && isPromptInput(match)) {
        activeInput = match;
        observeInputResize(activeInput);
        checkAndShowButton();
      }
    }
  }

  function onFocusOut() {
    // Persistent — don't hide on focus loss
  }

  function onInputChange(e) {
    if (activeInput && (e.target === activeInput || activeInput.contains(e.target))) {
      checkAndShowButton();
      setTimeout(() => requestAnimationFrame(positionButton), 50);
    }
  }

  function checkAndShowButton() {
    if (!activeInput) return;
    if (enhanceButton?.classList.contains('fwai-post-enhance')) return;
    const text = readInput(activeInput).trim();
    if (text.length >= 3) { showButton(); } else { hideButton(0); }
  }

  // ── Scroll / Resize — reposition button to follow input ──
  function onScrollOrResize() {
    if (enhanceButton && enhanceButton.style.display !== 'none') {
      requestAnimationFrame(positionButton);
    }
  }

  // ── Auto-detect Input ────────────────────────────────────
  function tryAutoDetectInput() {
    const candidates = document.querySelectorAll('textarea, [contenteditable="true"]');
    for (const el of candidates) {
      if (isPromptInput(el)) {
        activeInput = el;
        checkAndShowButton();
        return true;
      }
    }
    return false;
  }

  // ── MutationObserver ──────────────────────────────────────
  function setupObserver() {
    const observer = new MutationObserver(() => {
      if (activeInput && !document.body.contains(activeInput)) {
        activeInput = null;
        hideButton(0);
      }
      if (!activeInput) {
        tryAutoDetectInput();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Keyboard Shortcut ─────────────────────────────────────
  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      e.stopPropagation();
      if (!activeInput && document.activeElement && isPromptInput(document.activeElement)) {
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

    if (document.activeElement && isPromptInput(document.activeElement)) {
      activeInput = document.activeElement;
      checkAndShowButton();
    } else {
      tryAutoDetectInput();
    }

    // Periodic fallback: re-scan every 2s for late-loaded inputs (SPAs)
    setInterval(() => {
      if (!activeInput || !document.body.contains(activeInput)) {
        activeInput = null;
        tryAutoDetectInput();
      }
    }, 2000);
  }

  init();
})();
