// popup.js — Prompt Genius dashboard (no auth required)

document.addEventListener('DOMContentLoaded', () => {
  const enhanceCountEl = document.getElementById('enhanceCount');
  const historyBtn = document.getElementById('historyBtn');
  const styleGroup = document.getElementById('styleGroup');

  // ── Load Settings ─────────────────────────────────────────
  chrome.storage.sync.get({
    enhancementStyle: 'balanced',
    enhanceCount: 0
  }, (settings) => {
    enhanceCountEl.textContent = settings.enhanceCount || 0;
    setActiveButton(styleGroup, settings.enhancementStyle);
  });

  // ── Enhancement Style ─────────────────────────────────────
  function setActiveButton(group, value) {
    group.querySelectorAll('.btn-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  styleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-option');
    if (!btn) return;
    setActiveButton(styleGroup, btn.dataset.value);
    chrome.storage.sync.set({ enhancementStyle: btn.dataset.value });
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
