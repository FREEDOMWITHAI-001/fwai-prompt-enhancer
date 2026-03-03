// popup.js — Auth flow + dashboard logic (uses Firebase REST API)

document.addEventListener('DOMContentLoaded', () => {
  // ── Elements ─────────────────────────────────────────────
  const loadingView = document.getElementById('loadingView');
  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const authForm = document.getElementById('authForm');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const authError = document.getElementById('authError');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authSubmitText = document.getElementById('authSubmitText');
  const authLoader = document.getElementById('authLoader');
  const userEmailEl = document.getElementById('userEmail');
  const enhanceCountEl = document.getElementById('enhanceCount');
  const signOutBtn = document.getElementById('signOutBtn');
  const historyBtn = document.getElementById('historyBtn');
  const styleGroup = document.getElementById('styleGroup');

  const authSuccess = document.getElementById('authSuccess');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');

  let isSignUp = false;

  // ── Firebase REST Auth Helpers ───────────────────────────

  const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';
  const TOKEN_URL = 'https://securetoken.googleapis.com/v1/token';

  function getApiKey() {
    return FWAI_CONFIG.firebase.apiKey;
  }

  async function firebaseSignUp(email, password) {
    const res = await fetch(`${AUTH_BASE}:signUp?key=${getApiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await res.json();
    if (data.error) throw new Error(formatAuthError(data.error.message));
    return data;
  }

  async function firebaseSignIn(email, password) {
    const res = await fetch(`${AUTH_BASE}:signInWithPassword?key=${getApiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await res.json();
    if (data.error) throw new Error(formatAuthError(data.error.message));
    return data;
  }

  async function refreshIdToken(refreshToken) {
    const res = await fetch(`${TOKEN_URL}?key=${getApiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    const data = await res.json();
    if (data.error) throw new Error('Session expired. Please sign in again.');
    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  function formatAuthError(code) {
    const errors = {
      'EMAIL_EXISTS': 'This email is already registered. Try signing in.',
      'INVALID_EMAIL': 'Please enter a valid email address.',
      'WEAK_PASSWORD : Password should be at least 6 characters': 'Password must be at least 6 characters.',
      'EMAIL_NOT_FOUND': 'No account found with this email.',
      'INVALID_PASSWORD': 'Incorrect password.',
      'INVALID_LOGIN_CREDENTIALS': 'Invalid email or password.',
      'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many attempts. Please try again later.',
      'USER_DISABLED': 'This account has been disabled.'
    };
    return errors[code] || 'Something went wrong. Please try again.';
  }

  async function sendPasswordReset(email) {
    const res = await fetch(`${AUTH_BASE}:sendOobCode?key=${getApiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
    });
    const data = await res.json();
    if (data.error) throw new Error(formatAuthError(data.error.message));
    return data;
  }

  // ── Auth State Management ────────────────────────────────

  async function saveAuthState(authData) {
    const expiresAt = Date.now() + (parseInt(authData.expiresIn || '3600') * 1000);
    await chrome.storage.local.set({
      auth: {
        idToken: authData.idToken,
        refreshToken: authData.refreshToken,
        email: authData.email,
        uid: authData.localId,
        expiresAt
      }
    });
  }

  async function getAuthState() {
    const { auth } = await chrome.storage.local.get('auth');
    if (!auth) return null;

    // Token expired — try refreshing
    if (Date.now() >= auth.expiresAt - 60000) {
      try {
        const refreshed = await refreshIdToken(auth.refreshToken);
        auth.idToken = refreshed.idToken;
        auth.refreshToken = refreshed.refreshToken;
        auth.expiresAt = Date.now() + (parseInt(refreshed.expiresIn || '3600') * 1000);
        await chrome.storage.local.set({ auth });
      } catch (e) {
        await chrome.storage.local.remove('auth');
        return null;
      }
    }

    return auth;
  }

  async function clearAuthState() {
    await chrome.storage.local.remove('auth');
  }

  // ── View Switching ───────────────────────────────────────

  function showView(view) {
    loadingView.style.display = 'none';
    authView.style.display = 'none';
    dashboardView.style.display = 'none';
    view.style.display = 'block';
  }

  // ── Initialize ───────────────────────────────────────────

  async function init() {
    const auth = await getAuthState();
    if (auth) {
      await showDashboard(auth);
    } else {
      showView(authView);
    }
  }

  async function showDashboard(auth) {
    userEmailEl.textContent = auth.email;

    // Load settings
    const settings = await chrome.storage.sync.get({
      enhancementStyle: 'balanced',
      enhanceCount: 0
    });

    enhanceCountEl.textContent = settings.enhanceCount || 0;
    setActiveButton(styleGroup, settings.enhancementStyle);

    showView(dashboardView);
  }

  // ── Auth Tab Switching ───────────────────────────────────

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      isSignUp = tab.dataset.tab === 'signup';
      authSubmitText.textContent = isSignUp ? 'Create Account' : 'Sign In';
      passwordInput.autocomplete = isSignUp ? 'new-password' : 'current-password';
      authError.textContent = '';
    });
  });

  // ── Auth Form Submit ─────────────────────────────────────

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      authError.textContent = 'Please fill in all fields.';
      return;
    }

    // Show loading
    authSubmitBtn.disabled = true;
    authSubmitText.style.display = 'none';
    authLoader.style.display = 'block';

    try {
      const authData = isSignUp
        ? await firebaseSignUp(email, password)
        : await firebaseSignIn(email, password);

      await saveAuthState(authData);
      await showDashboard({
        email: authData.email,
        uid: authData.localId
      });
    } catch (err) {
      authError.textContent = err.message;
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitText.style.display = 'inline';
      authLoader.style.display = 'none';
    }
  });

  // ── Sign Out ─────────────────────────────────────────────

  signOutBtn.addEventListener('click', async () => {
    await clearAuthState();
    emailInput.value = '';
    passwordInput.value = '';
    authError.textContent = '';
    showView(authView);
  });

  // ── Enhancement Style ────────────────────────────────────

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

  // ── History Button ───────────────────────────────────────

  historyBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  // ── Live Count Updates ───────────────────────────────────

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enhanceCount) {
      enhanceCountEl.textContent = changes.enhanceCount.newValue || 0;
    }
  });

  // ── Forgot Password ─────────────────────────────────────

  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    authError.textContent = '';
    authSuccess.textContent = '';

    if (!email) {
      authError.textContent = 'Enter your email above, then click Forgot password.';
      return;
    }

    try {
      await sendPasswordReset(email);
      authSuccess.textContent = 'Password reset email sent! Check your inbox.';
    } catch (err) {
      authError.textContent = err.message;
    }
  });

  // ── Start ────────────────────────────────────────────────
  init();
});
