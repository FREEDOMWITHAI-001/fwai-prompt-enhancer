// history.js — Prompt History Page Logic

document.addEventListener('DOMContentLoaded', () => {
  const historyList = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyState');
  const totalCount = document.getElementById('totalCount');
  const searchInput = document.getElementById('searchInput');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const loadMoreSection = document.getElementById('loadMore');

  let allHistory = [];
  let displayedCount = 0;
  const PAGE_SIZE = 20;

  // ── Load History ─────────────────────────────────────────

  async function loadHistory() {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_HISTORY',
      limit: 200,
      offset: 0
    });

    if (response?.success) {
      allHistory = response.history || [];
      totalCount.textContent = `${allHistory.length} prompt${allHistory.length !== 1 ? 's' : ''}`;
      renderHistory(allHistory);
    }
  }

  // ── Render ───────────────────────────────────────────────

  function renderHistory(entries) {
    historyList.innerHTML = '';
    displayedCount = 0;

    if (entries.length === 0) {
      emptyState.style.display = 'block';
      loadMoreSection.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    appendEntries(entries, PAGE_SIZE);
  }

  function appendEntries(entries, count) {
    const end = Math.min(displayedCount + count, entries.length);

    for (let i = displayedCount; i < end; i++) {
      historyList.appendChild(createEntryElement(entries[i], i));
    }

    displayedCount = end;
    loadMoreSection.style.display = displayedCount < entries.length ? 'block' : 'none';
  }

  function createEntryElement(entry, index) {
    const div = document.createElement('div');
    div.className = 'history-entry';

    const platformClass = `platform-${entry.platform || 'other'}`;
    const platformName = (entry.platform || 'other').charAt(0).toUpperCase() + (entry.platform || 'other').slice(1);
    const timeStr = formatTime(entry.timestamp);

    const originalTruncated = entry.original.length > 200;
    const enhancedTruncated = entry.enhanced.length > 300;

    div.innerHTML = `
      <div class="entry-header">
        <div class="entry-meta">
          <span class="platform-badge ${platformClass}">${platformName}</span>
          <span class="entry-time">${timeStr}</span>
        </div>
        <div class="entry-actions">
          <button class="btn-icon copy-btn" data-text="${escapeAttr(entry.enhanced)}" title="Copy enhanced prompt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="btn-icon delete-btn" data-index="${index}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="entry-body">
        <div class="entry-section original">
          <div class="entry-label">Original</div>
          <div class="entry-text ${originalTruncated ? 'truncated' : ''}" data-full="${escapeAttr(entry.original)}">${escapeHtml(entry.original)}</div>
          ${originalTruncated ? '<button class="btn-expand">Show more</button>' : ''}
        </div>
        <div class="entry-section enhanced">
          <div class="entry-label">Enhanced</div>
          <div class="entry-text ${enhancedTruncated ? 'truncated' : ''}" data-full="${escapeAttr(entry.enhanced)}">${escapeHtml(entry.enhanced)}</div>
          ${enhancedTruncated ? '<button class="btn-expand">Show more</button>' : ''}
        </div>
      </div>
    `;

    return div;
  }

  // ── Event Delegation ─────────────────────────────────────

  historyList.addEventListener('click', async (e) => {
    // Copy button
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      const text = copyBtn.dataset.text;
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 1500);
      return;
    }

    // Delete button
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.index);
      await deleteEntry(index);
      return;
    }

    // Expand button
    const expandBtn = e.target.closest('.btn-expand');
    if (expandBtn) {
      const textEl = expandBtn.previousElementSibling;
      if (textEl.classList.contains('truncated')) {
        textEl.classList.remove('truncated');
        expandBtn.textContent = 'Show less';
      } else {
        textEl.classList.add('truncated');
        expandBtn.textContent = 'Show more';
      }
      return;
    }
  });

  // ── Delete Entry ─────────────────────────────────────────

  async function deleteEntry(index) {
    allHistory.splice(index, 1);
    await chrome.storage.local.set({ promptHistory: allHistory });
    totalCount.textContent = `${allHistory.length} prompt${allHistory.length !== 1 ? 's' : ''}`;
    renderHistory(filterHistory(searchInput.value));
  }

  // ── Clear All ────────────────────────────────────────────

  clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Clear all prompt history? This cannot be undone.')) return;
    allHistory = [];
    await chrome.storage.local.set({ promptHistory: [] });
    totalCount.textContent = '0 prompts';
    renderHistory([]);
  });

  // ── Search ───────────────────────────────────────────────

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderHistory(filterHistory(searchInput.value));
    }, 200);
  });

  function filterHistory(query) {
    if (!query.trim()) return allHistory;
    const lower = query.toLowerCase();
    return allHistory.filter(entry =>
      entry.original.toLowerCase().includes(lower) ||
      entry.enhanced.toLowerCase().includes(lower)
    );
  }

  // ── Load More ────────────────────────────────────────────

  loadMoreBtn.addEventListener('click', () => {
    const filtered = filterHistory(searchInput.value);
    appendEntries(filtered, PAGE_SIZE);
  });

  // ── Helpers ──────────────────────────────────────────────

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Init ─────────────────────────────────────────────────
  loadHistory();
});
