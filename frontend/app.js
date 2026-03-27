// ─── connect supabase ───
const supabaseUrl = "https://njtoptrbskaklunzavzr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdG9wdHJic2tha2x1bnphdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDY0OTAsImV4cCI6MjA5MDE4MjQ5MH0.CJXWm6VFxymxsIfAd58KCs1p_4S04979vJUy9xH4gr0";

const supabaseClient = window.__perfectSandSupabaseClient
  || (window.__perfectSandSupabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey));
const REMOTE_API_BASE = 'https://perfectsand.onrender.com';
const INTERVENTION_DURATION_SECONDS = 600;
const INTERVENTION_FALLBACK_MESSAGE = 'Stay with it. This will pass.';
const SESSION_SAVE_MAX_ATTEMPTS = 2;
const INTERVENTION_INSERT_DEFAULTS = {
  trigger: 'alone in room',
  emotion: 'tempted',
  resisted: false,
};

let interventionInterval = null;
let interventionSessionId = 0;
let activeOsaAudio = null;
let activeOsaAudioPlaybackId = 0;

function getApiUrl(path) {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${REMOTE_API_BASE}${normalisedPath}`;
}

async function postJson(path, payload) {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(task) {
  let lastError = null;

  for (let attempt = 1; attempt <= SESSION_SAVE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt < SESSION_SAVE_MAX_ATTEMPTS) {
        await wait(250);
      }
    }
  }

  throw lastError || new Error('Request failed.');
}

function getVoiceEnabled() {
  return document.getElementById('voiceToggle')?.checked ?? true;
}

function getVoiceVolume() {
  const slider = document.getElementById('voiceVolume');
  const value = slider ? Number(slider.value) : 0.85;
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.85;
}

function updateVoiceVolumeLabel() {
  const label = document.getElementById('voiceVolumeValue');
  if (label) {
    label.textContent = `${Math.round(getVoiceVolume() * 100)}%`;
  }
}

function stopOsaAudio() {
  if (!activeOsaAudio) return;
  activeOsaAudio.pause();
  activeOsaAudio.currentTime = 0;
  activeOsaAudio = null;
}

async function playOsaAudio(audioBase64, { force = false } = {}) {
  if (!audioBase64 || (!force && !getVoiceEnabled())) return;

  activeOsaAudioPlaybackId += 1;
  const playbackId = activeOsaAudioPlaybackId;
  stopOsaAudio();

  const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
  audio.volume = getVoiceVolume();
  activeOsaAudio = audio;

  audio.addEventListener('ended', () => {
    if (playbackId === activeOsaAudioPlaybackId) {
      activeOsaAudio = null;
    }
  }, { once: true });

  try {
    await audio.play();
  } catch (error) {
    if (playbackId === activeOsaAudioPlaybackId) {
      activeOsaAudio = null;
    }
    console.error('Unable to play Osa audio:', error);
  }
}

function initVoiceControls() {
  const toggle = document.getElementById('voiceToggle');
  const slider = document.getElementById('voiceVolume');
  if (!toggle || !slider || toggle.dataset.bound === 'true') return;

  const storedEnabled = localStorage.getItem('osaVoiceEnabled');
  const storedVolume = parseFloat(localStorage.getItem('osaVoiceVolume') || '0.85');

  toggle.checked = storedEnabled !== 'false';
  slider.value = Number.isFinite(storedVolume) ? String(storedVolume) : '0.85';
  updateVoiceVolumeLabel();

  toggle.addEventListener('change', () => {
    localStorage.setItem('osaVoiceEnabled', String(toggle.checked));
    if (!toggle.checked) {
      stopOsaAudio();
    }
  });

  slider.addEventListener('input', () => {
    localStorage.setItem('osaVoiceVolume', slider.value);
    if (activeOsaAudio) {
      activeOsaAudio.volume = getVoiceVolume();
    }
    updateVoiceVolumeLabel();
  });

  toggle.dataset.bound = 'true';
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Show inline feedback (red = error, green = success info)
function showAuthMessage(msg, isSuccess = false) {
  const wrap = document.getElementById('auth-error');
  const text = document.getElementById('auth-error-text');
  text.textContent = msg;
  wrap.className = isSuccess
    ? 'bg-green-950/40 border border-green-800/50 rounded-xl px-4 py-2.5 mb-4'
    : 'bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-2.5 mb-4';
  text.className = isSuccess
    ? 'text-green-400 text-xs text-center leading-relaxed'
    : 'text-red-400 text-xs text-center leading-relaxed';
  wrap.classList.remove('hidden');
}

function setButtonLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
  btn.textContent = label;
}

// Enter the app — hide auth screen and boot dashboard
function enterApp() {
  const screen = document.getElementById('auth-screen');
  screen.style.pointerEvents = 'none';
  screen.style.transition = 'opacity 0.35s ease';
  screen.style.opacity = '0';
  setTimeout(() => screen.classList.add('hidden'), 350);
  initApp();
}

// ─── login ────────────────────────────────────────────────────────────────────

async function login(email, password) {
  const btn = document.getElementById('loginBtn');
  setButtonLoading(btn, true, 'Signing in...');
  document.getElementById('auth-error').classList.add('hidden');

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    console.error('Login error:', error);
    showAuthMessage(error.message);
    setButtonLoading(btn, false, 'Sign In');
  } else {
    enterApp();
  }
}

// ─── signup with profile ──────────────────────────────────────────────────────

function populateDayDropdownSignup() {
  const daySelect = document.getElementById('su-dob-day');
  if (daySelect.options.length > 1) return;
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    daySelect.appendChild(opt);
  }
}

function calcAgeSignup() {
  const month = parseInt(document.getElementById('su-dob-month').value);
  const day   = parseInt(document.getElementById('su-dob-day').value);
  const year  = parseInt(document.getElementById('su-dob-year').value);
  const el    = document.getElementById('su-age-display');
  if (!month || !day || !year || year < 1920 || year > new Date().getFullYear()) {
    el.textContent = '—'; return;
  }
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  el.textContent = age >= 0 ? age : '—';
}

function showSignupMessage(msg, isSuccess = false) {
  const wrap = document.getElementById('su-error');
  const text = document.getElementById('su-error-text');
  text.textContent = msg;
  wrap.className = isSuccess
    ? 'bg-green-950/40 border border-green-800/50 rounded-xl px-4 py-2.5 mb-4'
    : 'bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-2.5 mb-4';
  text.className = isSuccess
    ? 'text-green-400 text-xs text-center leading-relaxed'
    : 'text-red-400 text-xs text-center leading-relaxed';
  wrap.classList.remove('hidden');
}

async function signupWithProfile() {
  const fullName = document.getElementById('su-fullname').value.trim();
  const codeName = document.getElementById('su-codename').value.trim();
  const mobile   = document.getElementById('su-mobile').value.trim();
  const month    = document.getElementById('su-dob-month').value;
  const day      = document.getElementById('su-dob-day').value;
  const year     = document.getElementById('su-dob-year').value.trim();
  const gender   = document.getElementById('su-gender').value;
  const location = document.getElementById('su-location').value.trim();
  const email    = document.getElementById('su-email').value.trim();
  const password = document.getElementById('su-password').value;

  document.getElementById('su-error').classList.add('hidden');

  if (!fullName || !codeName || !month || !day || !year || !gender || !email || !password) {
    showSignupMessage('Please fill in all required fields.');
    return;
  }

  if (password.length < 6) {
    showSignupMessage('Password must be at least 6 characters.');
    return;
  }

  const btn = document.getElementById('su-btn');
  setButtonLoading(btn, true, 'Creating account...');

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    console.error('Signup error:', error);
    showSignupMessage(error.message);
    setButtonLoading(btn, false, 'Create Account');
    return;
  }

  const userId = data.user.id;

  const today = new Date();
  let age = today.getFullYear() - parseInt(year);
  if (today.getMonth() + 1 < parseInt(month) ||
     (today.getMonth() + 1 === parseInt(month) && today.getDate() < parseInt(day))) age--;

  const dob = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  const { error: profileError } = await supabaseClient.from('profiles').upsert({
    user_id:       userId,
    full_name:     fullName,
    code_name:     codeName,
    mobile:        mobile,
    date_of_birth: dob,
    age:           age,
    gender:        gender,
    location:      location
  }, { onConflict: 'user_id' });

  if (profileError) {
    console.error('Profile save error (non-fatal):', profileError);
  }

  if (data.session) {
    enterApp();
    return;
  }

  setButtonLoading(btn, false, 'Create Account');
  showSignupMessage('Account created! Check your email to confirm, then sign in.', true);
}

// ─── logout ───────────────────────────────────────────────────────────────────

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

// ─── Profile Setup ────────────────────────────────────────────────────────────

function populateDayDropdown() {
  const daySelect = document.getElementById('profile-dob-day');
  daySelect.innerHTML = '<option value="" disabled selected>Day</option>';
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    daySelect.appendChild(opt);
  }
}

function calcAge() {
  const month = parseInt(document.getElementById('profile-dob-month').value);
  const day   = parseInt(document.getElementById('profile-dob-day').value);
  const year  = parseInt(document.getElementById('profile-dob-year').value);
  const el    = document.getElementById('profile-age-display');

  if (!month || !day || !year || year < 1920 || year > new Date().getFullYear()) {
    el.textContent = '—'; return;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  el.textContent = age >= 0 ? age : '—';
}

function showProfileScreen() {
  const screen = document.getElementById('profile-screen');
  screen.classList.remove('hidden');

  populateDayDropdown();

  if (screen.dataset.bound === 'true') {
    return;
  }

  document.getElementById('profile-dob-month').addEventListener('change', calcAge);
  document.getElementById('profile-dob-day').addEventListener('change', calcAge);
  document.getElementById('profile-dob-year').addEventListener('input', calcAge);
  document.getElementById('profile-save-btn').addEventListener('click', saveProfile);
  screen.dataset.bound = 'true';
}

async function saveProfile() {
  const fullName = document.getElementById('profile-fullname').value.trim();
  const codeName = document.getElementById('profile-codename').value.trim();
  const mobile   = document.getElementById('profile-mobile').value.trim();
  const month    = document.getElementById('profile-dob-month').value;
  const day      = document.getElementById('profile-dob-day').value;
  const year     = document.getElementById('profile-dob-year').value.trim();
  const gender   = document.getElementById('profile-gender').value;
  const location = document.getElementById('profile-location').value.trim();

  const errEl = document.getElementById('profile-error');
  const errText = document.getElementById('profile-error-text');

  if (!fullName || !codeName || !month || !day || !year || !gender) {
    errText.textContent = 'Please fill in all required fields.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('profile-save-btn');
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.textContent = 'Saving...';
  errEl.classList.add('hidden');

  // Calculate age from DOB
  const today = new Date();
  let age = today.getFullYear() - parseInt(year);
  if (today.getMonth() + 1 < parseInt(month) ||
     (today.getMonth() + 1 === parseInt(month) && today.getDate() < parseInt(day))) age--;

  const dob = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  const { data: { user } } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient
    .from('profiles')
    .upsert({
      user_id:       user.id,
      full_name:     fullName,
      code_name:     codeName,
      mobile:        mobile,
      date_of_birth: dob,
      age:           age,
      gender:        gender,
      location:      location
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Profile save error:', error);
    errText.textContent = error.message;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = 'Save & Enter Dashboard';
    return;
  }

  document.getElementById('profile-screen').classList.add('hidden');
}

async function checkProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data } = await supabaseClient
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) showProfileScreen();
}

// ─── App init (runs once after login) ─────────────────────────────────────────

let _appInited = false;

function initApp() {
  if (_appInited) return;
  _appInited = true;

  document.getElementById('logout-btn').classList.remove('hidden');
  initVoiceControls();
  initTrial();
  initDayStart();
  initOnboarding();
  showTab('dashboard');
  renderStreak();
  renderStats();
  document.getElementById('token-count').textContent = getTokens();
  renderTrialBanner();
  startDayCountdown();
  if (Notification.permission !== 'granted') Notification.requestPermission();
  startNotificationSchedule();
  checkProfile();
}

// ─── Auth init (runs on page load) ────────────────────────────────────────────

async function initAuth() {
  // Check for existing session — hide auth instantly if already logged in
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    document.getElementById('auth-screen').classList.add('hidden');
    initApp();
  }

  // Toggle: login → signup
  document.getElementById('showSignupBtn').addEventListener('click', () => {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('signup-view').classList.remove('hidden');
    populateDayDropdownSignup();
    document.getElementById('su-dob-month').addEventListener('change', calcAgeSignup);
    document.getElementById('su-dob-day').addEventListener('change', calcAgeSignup);
    document.getElementById('su-dob-year').addEventListener('input', calcAgeSignup);
  });

  // Toggle: signup → login
  document.getElementById('showLoginBtn').addEventListener('click', () => {
    document.getElementById('signup-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
  });

  // Login button
  document.getElementById('loginBtn').addEventListener('click', () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) { showAuthMessage('Please enter your email and password.'); return; }
    login(email, password);
  });

  // Signup button
  document.getElementById('su-btn').addEventListener('click', signupWithProfile);

  // Enter key navigation in login form
  document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
  document.getElementById('email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('password').focus();
  });
}
// ─── Urge Journal ─────────────────────────────────────────────────────────────

function getUrgeLog() {
  return JSON.parse(localStorage.getItem('urgeLog')) || [];
}

function saveUrgeLog(log) {
  localStorage.setItem('urgeLog', JSON.stringify(log));
}

function createInterventionState() {
  return {
    id: null,
    trigger: INTERVENTION_INSERT_DEFAULTS.trigger,
    emotion: INTERVENTION_INSERT_DEFAULTS.emotion,
    action: null,
    insertPromise: null,
    startTime: null,
    resisted: false,
    logged: false,
  };
}

// Active intervention state
let currentUrge = createInterventionState();

// ─── Stats ────────────────────────────────────────────────────────────────────

function getStats() {
  return JSON.parse(localStorage.getItem('osaStats')) || { urges: 0, resisted: 0, slips: 0 };
}

function saveStats(s) {
  localStorage.setItem('osaStats', JSON.stringify(s));
}

function getControlLevel(rate) {
  if (rate === null) return { label: '—', color: 'text-osa-accent' };
  if (rate <= 30)  return { label: 'Unstable',         color: 'text-red-400' };
  if (rate <= 60)  return { label: 'Building Control', color: 'text-yellow-400' };
  if (rate <= 80)  return { label: 'Disciplined',      color: 'text-green-400' };
  return               { label: 'Mastery',           color: 'text-osa-accent' };
}

function applyStatsToDashboard(s) {
  document.getElementById('stat-urges').textContent = s.urges;
  document.getElementById('stat-resisted').textContent = s.resisted;

  const rate = s.urges > 0 ? Math.round((s.resisted / s.urges) * 100) : null;
  document.getElementById('stat-rate').textContent = rate !== null ? rate + '%' : '—';

  const level = getControlLevel(rate);
  const levelEl = document.getElementById('control-level');
  if (levelEl) {
    levelEl.textContent = level.label;
    levelEl.className = `text-sm font-bold ${level.color}`;
  }
}

async function fetchRemoteStats() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return getStats();

  const [totalResponse, resistedResponse] = await Promise.all([
    supabaseClient
      .from('urges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabaseClient
      .from('urges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resisted', true),
  ]);

  if (totalResponse.error) throw totalResponse.error;
  if (resistedResponse.error) throw resistedResponse.error;

  const cached = getStats();
  return {
    urges: totalResponse.count || 0,
    resisted: resistedResponse.count || 0,
    slips: cached.slips || 0,
  };
}

async function renderStats() {
  const cached = getStats();
  applyStatsToDashboard(cached);

  try {
    const remoteStats = await fetchRemoteStats();
    saveStats(remoteStats);
    applyStatsToDashboard(remoteStats);
  } catch (error) {
    console.error('Unable to refresh stats from Supabase:', error);
  }
}

function setState(label) {
  const el = document.getElementById('user-state');
  if (el) el.textContent = label;
}

function recordSlip() {
  const s = getStats();
  s.slips += 1;
  saveStats(s);
  showToast('Recorded. Honesty is the first step back.');
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

function getTokens() {
  return parseInt(localStorage.getItem('osaTokens') ?? '10');
}

function saveTokens(n) {
  localStorage.setItem('osaTokens', n);
  document.getElementById('token-count').textContent = n;
}

function useToken() {
  const t = getTokens();
  if (t <= 0) { showToast('No tokens left. Buy more to continue.'); return false; }
  saveTokens(t - 1);
  return true;
}

function showTokenInfo() {
  const t = getTokens();
  showToast(`${t} token${t === 1 ? '' : 's'} remaining.`);
}

// ─── Trial ────────────────────────────────────────────────────────────────────

function initTrial() {
  if (!localStorage.getItem('osaTrialStart')) {
    localStorage.setItem('osaTrialStart', new Date().toISOString());
  }
}

function getTrialDaysUsed() {
  const start = new Date(localStorage.getItem('osaTrialStart'));
  return Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
}

function isTrialActive() { return getTrialDaysUsed() <= 14; }
function getTrialDaysLeft() { return Math.max(0, 14 - getTrialDaysUsed()); }

function checkTrialGate() {
  if (isTrialActive()) return true;
  const s = getStats();
  showPaywall(s, getStreak());
  return false;
}

function showPaywall(stats, streak) {
  const existing = document.getElementById('paywall-overlay');
  if (existing) existing.remove();

  const o = document.createElement('div');
  o.id = 'paywall-overlay';
  o.className = 'fixed inset-0 bg-black/97 z-50 flex flex-col items-center justify-center px-6 text-center';
  o.innerHTML = `
    <p class="text-osa-muted text-xs uppercase tracking-widest mb-4">Your Free Access Has Ended</p>
    <h2 class="text-white text-2xl font-bold mb-6 max-w-xs leading-tight">You've built real control.</h2>
    <div class="grid grid-cols-3 gap-3 mb-6 w-full max-w-xs">
      <div class="bg-osa-card border border-osa-border rounded-2xl py-3">
        <p class="text-red-400 text-xl font-bold">${stats.urges}</p>
        <p class="text-osa-muted text-xs mt-0.5">Urges felt</p>
      </div>
      <div class="bg-osa-card border border-osa-border rounded-2xl py-3">
        <p class="text-green-400 text-xl font-bold">${stats.resisted}</p>
        <p class="text-osa-muted text-xs mt-0.5">Resisted</p>
      </div>
      <div class="bg-osa-card border border-osa-border rounded-2xl py-3">
        <p class="text-osa-accent text-xl font-bold">${streak}</p>
        <p class="text-osa-muted text-xs mt-0.5">Day streak</p>
      </div>
    </div>
    <p class="text-osa-muted text-sm mb-8 max-w-xs">Don't lose this progress. Continue your journey.</p>
    <div class="space-y-3 w-full max-w-xs">
      <button onclick="showToast('Payment coming soon.')" class="w-full py-3.5 rounded-2xl bg-osa-accent text-black font-bold text-sm">50 Tokens — ₦1,000</button>
      <button onclick="showToast('Payment coming soon.')" class="w-full py-3.5 rounded-2xl border border-osa-accent text-osa-accent font-bold text-sm">200 Tokens — ₦3,000</button>
      <button onclick="document.getElementById('paywall-overlay').remove()" class="text-osa-muted text-xs underline mt-2">Not now</button>
    </div>`;
  document.body.appendChild(o);
}

// ─── Streak ───────────────────────────────────────────────────────────────────

function getStreak() { return parseInt(localStorage.getItem('osa_streak') || '0'); }
function getLastMarked() { return localStorage.getItem('osa_last_marked') || null; }

function renderStreak() {
  const streak = getStreak();
  const last = getLastMarked();
  document.getElementById('streak-count').textContent = streak;

  const lastEl = document.getElementById('last-marked');
  const todayEl = document.getElementById('completed-today');
  if (!last) { lastEl.textContent = 'No days marked yet.'; todayEl.textContent = ''; return; }

  const lastDate = new Date(last);
  const isToday = lastDate.toDateString() === new Date().toDateString();
  lastEl.textContent = `Last marked: ${lastDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;

  if (isToday) {
    todayEl.textContent = 'Today is complete. Stay strong.';
    todayEl.className = 'text-xs text-green-400 mt-1';
  } else {
    todayEl.textContent = 'Mark today when you are ready.';
    todayEl.className = 'text-xs text-osa-muted mt-1';
  }
}

function markDayComplete() {
  const today = new Date();
  const last = getLastMarked();

  if (last) {
    const lastDate = new Date(last);
    if (lastDate.toDateString() === today.toDateString()) {
      showToast('Already marked today. Keep going.');
      return;
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    localStorage.setItem('osa_streak', lastDate.toDateString() === yesterday.toDateString() ? getStreak() + 1 : 1);
  } else {
    localStorage.setItem('osa_streak', 1);
  }

  localStorage.setItem('osa_last_marked', today.toISOString());
  renderStreak();
  setState('Locked In');
  showToast(`Day locked. ${getStreak()} day streak.`);
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-osa-accent', 'text-black');
    btn.classList.add('text-osa-muted');
  });
  document.getElementById(`tab-content-${name}`).classList.remove('hidden');
  const btn = document.getElementById(`tab-${name}`);
  btn.classList.add('bg-osa-accent', 'text-black');
  btn.classList.remove('text-osa-muted');

  if (name === 'history') {
    renderHistory();
    renderInsights();
  }
}

// ─── Urge Flow ────────────────────────────────────────────────────────────────

function formatTime(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function getLiveInterventionContext() {
  const savedTrigger = localStorage.getItem('userTrigger')?.trim();
  const hour = new Date().getHours();

  return {
    trigger: savedTrigger || (hour >= 22 || hour < 5 ? 'night habit' : INTERVENTION_INSERT_DEFAULTS.trigger),
    emotion: hour >= 22 || hour < 5 ? 'restless' : INTERVENTION_INSERT_DEFAULTS.emotion,
  };
}

function getFallbackUrgeEntries(limit = null) {
  const localEntries = getUrgeLog()
    .map((entry, index) => ({
      id: `local-${index}`,
      trigger: entry.trigger || INTERVENTION_INSERT_DEFAULTS.trigger,
      emotion: entry.emotion || INTERVENTION_INSERT_DEFAULTS.emotion,
      resisted: Boolean(entry.resisted),
      created_at: entry.time || new Date().toISOString(),
      duration: entry.duration || 0,
      action: entry.action || null,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return limit ? localEntries.slice(0, limit) : localEntries;
}

async function loadUrgeEntries(limit = null) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return getFallbackUrgeEntries(limit);

  let query = supabaseClient
    .from('urges')
    .select('id, trigger, emotion, resisted, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    return getFallbackUrgeEntries(limit);
  }

  return data.map(entry => ({
    id: entry.id,
    trigger: entry.trigger || INTERVENTION_INSERT_DEFAULTS.trigger,
    emotion: entry.emotion || INTERVENTION_INSERT_DEFAULTS.emotion,
    resisted: Boolean(entry.resisted),
    created_at: entry.created_at || new Date().toISOString(),
    duration: null,
    action: null,
  }));
}

async function getUserHistory() {
  try {
    const entries = await loadUrgeEntries(10);
    return entries.map(({ trigger, emotion, resisted, created_at }) => ({
      trigger,
      emotion,
      resisted,
      created_at,
    }));
  } catch (error) {
    console.error('Unable to load urge history:', error);
    return getFallbackUrgeEntries(10).map(({ trigger, emotion, resisted, created_at }) => ({
      trigger,
      emotion,
      resisted,
      created_at,
    }));
  }
}

function setInterventionStatus(text, tone = 'loading') {
  const statusEl = document.getElementById('intervention-status');
  if (!statusEl) return;

  statusEl.textContent = text;
  statusEl.className = 'mb-5 text-xs uppercase tracking-[0.28em]';

  if (tone === 'success') {
    statusEl.classList.add('text-green-400');
    return;
  }

  if (tone === 'ready') {
    statusEl.classList.add('text-red-300');
    return;
  }

  if (tone === 'error') {
    statusEl.classList.add('text-red-500');
    return;
  }

  statusEl.classList.add('text-red-400', 'intervention-status-loading');
}

function setInterventionMessage(message) {
  const messageEl = document.getElementById('urge-message');
  if (!messageEl) return;

  messageEl.style.opacity = '0';
  setTimeout(() => {
    messageEl.textContent = message;
    messageEl.style.opacity = '1';
  }, 140);
}

function setInterventionVisible(visible) {
  const overlay = document.getElementById('urge-mode');
  if (!overlay) return;

  overlay.classList.toggle('hidden', !visible);
  document.body.classList.toggle('intervention-active', visible);
  setBattleMode(visible);

  if (visible) {
    document.getElementById('resistBtn')?.focus();
  }
}

function resetInterventionUI() {
  const titleEl = document.getElementById('intervention-title');
  const timerEl = document.getElementById('urge-timer');
  const resistBtn = document.getElementById('resistBtn');
  const dismissBtn = document.getElementById('dismissInterventionBtn');

  if (titleEl) titleEl.textContent = '⚠️ You are under pressure';
  if (timerEl) timerEl.textContent = formatTime(INTERVENTION_DURATION_SECONDS);
  if (resistBtn) {
    resistBtn.disabled = false;
    resistBtn.textContent = 'I stayed in control';
    resistBtn.style.opacity = '1';
  }
  if (dismissBtn) dismissBtn.disabled = false;

  setInterventionStatus('Connecting to Osa...', 'loading');
  const messageEl = document.getElementById('urge-message');
  if (messageEl) {
    messageEl.textContent = INTERVENTION_FALLBACK_MESSAGE;
    messageEl.style.opacity = '1';
  }
}

function clearInterventionTimer() {
  clearInterval(interventionInterval);
  interventionInterval = null;
}

function finishInterventionCountdown() {
  clearInterventionTimer();

  const titleEl = document.getElementById('intervention-title');
  if (titleEl) titleEl.textContent = 'You made it. Control won.';

  document.getElementById('urge-timer').textContent = '00:00';
  setInterventionStatus('Mark the win when you are ready.', 'success');
  setInterventionMessage('You made it. Control won.');
}

function startInterventionTimer() {
  let remaining = INTERVENTION_DURATION_SECONDS;
  document.getElementById('urge-timer').textContent = formatTime(remaining);
  clearInterventionTimer();

  interventionInterval = setInterval(() => {
    remaining -= 1;
    const safeRemaining = Math.max(remaining, 0);
    document.getElementById('urge-timer').textContent = formatTime(safeRemaining);

    if (safeRemaining <= 0) {
      finishInterventionCountdown();
    }
  }, 1000);
}

function buildInterventionRequest(userId) {
  return {
    user_id: userId,
    trigger: currentUrge.trigger || INTERVENTION_INSERT_DEFAULTS.trigger,
    emotion: currentUrge.emotion || INTERVENTION_INSERT_DEFAULTS.emotion,
    resisted: false,
  };
}

async function requestInterventionMessage({ userId, trigger, emotion }) {
  const data = await postJson('/chat', {
    userId,
    trigger,
    emotion,
  });

  return {
    message: data?.message?.trim() || data?.reply?.trim() || INTERVENTION_FALLBACK_MESSAGE,
    audio: data?.audio || null,
  };
}

function applyInterventionRecord(record, sessionId = interventionSessionId) {
  if (!record || sessionId !== interventionSessionId) {
    return;
  }

  currentUrge.id = record.id || null;
  currentUrge.logged = Boolean(record.id);
  currentUrge.resisted = Boolean(record.resisted);
}

async function insertInterventionUrge(userId, resisted = false, sessionId = interventionSessionId) {
  const urgePayload = {
    user_id: userId,
    trigger: currentUrge.trigger || INTERVENTION_INSERT_DEFAULTS.trigger,
    emotion: currentUrge.emotion || INTERVENTION_INSERT_DEFAULTS.emotion,
    resisted: Boolean(resisted),
    created_at: new Date().toISOString(),
  };

  const insertPromise = runWithRetry(async () => {
    const { data, error } = await supabaseClient
      .from('urges')
      .insert([urgePayload])
      .select('id, trigger, emotion, resisted, created_at')
      .single();

    if (error) throw error;
    return data;
  }).then((insertedUrge) => {
    applyInterventionRecord(insertedUrge, sessionId);
    return insertedUrge;
  }).finally(() => {
    if (sessionId === interventionSessionId && currentUrge.insertPromise === insertPromise) {
      currentUrge.insertPromise = null;
    }
  });

  if (sessionId === interventionSessionId) {
    currentUrge.insertPromise = insertPromise;
  }

  return insertPromise;
}

async function ensureInterventionUrge(userId, sessionId = interventionSessionId) {
  if (currentUrge.id) {
    return currentUrge.id;
  }

  if (currentUrge.insertPromise) {
    const insertedUrge = await currentUrge.insertPromise;
    return insertedUrge?.id || null;
  }

  const insertedUrge = await insertInterventionUrge(userId, false, sessionId);
  await renderStats();
  return insertedUrge?.id || null;
}

async function updateLatestUrgeResisted(userId, sessionId = interventionSessionId) {
  const urgeId = await ensureInterventionUrge(userId, sessionId);

  if (!urgeId) {
    const fallbackUrge = await insertInterventionUrge(userId, true, sessionId);
    currentUrge.resisted = true;
    return fallbackUrge;
  }

  const updatedUrge = await runWithRetry(async () => {
    const { data, error } = await supabaseClient
      .from('urges')
      .update({ resisted: true })
      .eq('id', urgeId)
      .eq('user_id', userId)
      .select('id, trigger, emotion, resisted, created_at')
      .single();

    if (error) throw error;
    return data;
  });

  applyInterventionRecord(updatedUrge || { id: urgeId, resisted: true }, sessionId);
  return updatedUrge;
}

async function syncInterventionState(userId, sessionId) {
  const urge = buildInterventionRequest(userId);

  try {
    await insertInterventionUrge(userId, false, sessionId);
    if (sessionId !== interventionSessionId) return;
    await renderStats();
  } catch (error) {
    if (sessionId !== interventionSessionId) return;
    console.error('Unable to create intervention urge:', error);
  }

  try {
    const response = await requestInterventionMessage({
      userId,
      trigger: urge.trigger,
      emotion: urge.emotion,
    });
    if (sessionId !== interventionSessionId) return;

    setInterventionStatus('Osa is with you now.', 'ready');
    setInterventionMessage(response.message);
    await playOsaAudio(response.audio, { force: true });
  } catch (error) {
    if (sessionId !== interventionSessionId) return;

    console.error('Unable to sync intervention state:', error);
    setInterventionStatus('Hold the line.', 'ready');
    setInterventionMessage(INTERVENTION_FALLBACK_MESSAGE);
  }
}

async function startBattleMode() {
  if (interventionInterval || document.body.classList.contains('intervention-active')) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    showToast('Please sign in again to start intervention mode.');
    return;
  }

  interventionSessionId += 1;
  currentUrge = {
    ...createInterventionState(),
    ...getLiveInterventionContext(),
    startTime: Date.now(),
  };

  resetInterventionUI();
  setInterventionVisible(true);
  setState('Under Pressure');
  startInterventionTimer();

  void syncInterventionState(user.id, interventionSessionId);
}

async function dismissIntervention() {
  clearInterventionTimer();

  if (currentUrge.startTime) {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user && !currentUrge.id) {
        await ensureInterventionUrge(user.id, interventionSessionId);
      }
    } catch (error) {
      console.error('Unable to save intervention session:', error);
    }
  }

  interventionSessionId += 1;
  stopOsaAudio();
  setInterventionVisible(false);
  resetInterventionUI();
  currentUrge = createInterventionState();
  setState('Recovering');
  await renderStats();
  renderHistory();
  renderInsights();
}

async function resistIntervention() {
  const resistBtn = document.getElementById('resistBtn');
  const dismissBtn = document.getElementById('dismissInterventionBtn');
  if (!resistBtn || resistBtn.disabled) return;

  clearInterventionTimer();
  resistBtn.disabled = true;
  resistBtn.style.opacity = '0.7';
  resistBtn.textContent = 'Saving...';
  if (dismissBtn) dismissBtn.disabled = true;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('No user available to update the urge.');

    await updateLatestUrgeResisted(user.id, interventionSessionId);
    setState('In Control');
    setInterventionStatus('You stayed in control.', 'success');
    setInterventionMessage('You stayed in control.');
    showToast('You stayed in control.');
  } catch (error) {
    console.error('Unable to mark urge as resisted:', error);
    setState('In Control');
    setInterventionStatus('You stayed in control.', 'success');
    setInterventionMessage('You stayed in control.');
    showToast('You stayed in control.');
  } finally {
    await renderStats();
    renderHistory();
    renderInsights();

    setTimeout(() => {
      interventionSessionId += 1;
      stopOsaAudio();
      setInterventionVisible(false);
      resetInterventionUI();
      currentUrge = createInterventionState();
    }, 700);
  }
}

function stopUrgeMode(resisted = false) {
  if (resisted) {
    void resistIntervention();
    return;
  }

  void dismissIntervention();
}

// ─── History Rendering ────────────────────────────────────────────────────────

async function renderHistory() {
  const container = document.getElementById('history-list');
  const emptyMsg = document.getElementById('history-empty');
  let entries = [];

  try {
    entries = await loadUrgeEntries(100);
  } catch (error) {
    console.error('Unable to render history from Supabase:', error);
    entries = getFallbackUrgeEntries(100);
  }

  if (entries.length === 0) {
    emptyMsg.classList.remove('hidden');
    container.innerHTML = '';
    container.appendChild(emptyMsg);
    return;
  }

  emptyMsg.classList.add('hidden');

  // Group by date
  const groups = {};
  entries.forEach(entry => {
    const d = new Date(entry.created_at);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  });

  container.innerHTML = '';
  Object.entries(groups).forEach(([label, items]) => {
    const groupEl = document.createElement('div');
    groupEl.innerHTML = `<p class="text-osa-muted text-xs uppercase tracking-widest mb-2">${label}</p>`;

    items.forEach(entry => {
      const d = new Date(entry.created_at);
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const resistedColor = entry.resisted ? 'text-green-400' : 'text-red-400';
      const resistedLabel = entry.resisted ? 'Resisted' : 'Recorded';
      const triggerLabel = entry.trigger || INTERVENTION_INSERT_DEFAULTS.trigger;
      const emotionLabel = entry.emotion || INTERVENTION_INSERT_DEFAULTS.emotion;

      const card = document.createElement('div');
      card.className = 'bg-osa-card border border-osa-border rounded-2xl p-4 mb-2 text-sm';
      card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="text-osa-muted text-xs">${time}</span>
          <span class="text-xs font-semibold ${resistedColor}">${resistedLabel}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><span class="text-osa-muted">Trigger </span><span class="text-osa-text">${triggerLabel}</span></div>
          <div><span class="text-osa-muted">Emotion </span><span class="text-osa-text">${emotionLabel}</span></div>
          <div><span class="text-osa-muted">Logged </span><span class="text-osa-text">${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
          <div><span class="text-osa-muted">State </span><span class="text-osa-text">${resistedLabel}</span></div>
        </div>`;
      groupEl.appendChild(card);
    });

    container.appendChild(groupEl);
  });
}

function getDateLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

async function clearHistory() {
  if (!confirm('Clear all journal entries? This cannot be undone.')) return;
  let clearedRemotely = true;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const { error } = await supabaseClient
        .from('urges')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    }
  } catch (error) {
    clearedRemotely = false;
    console.error('Unable to clear Supabase urge history:', error);
  }

  localStorage.removeItem('urgeLog');
  await renderStats();
  renderHistory();
  renderInsights();
  showToast(clearedRemotely ? 'Journal cleared.' : 'Cloud history could not be cleared.');
}

// ─── Insights ────────────────────────────────────────────────────────────────

async function renderInsights() {
  const container = document.getElementById('insights-content');
  let log = [];

  try {
    log = await loadUrgeEntries(100);
  } catch (error) {
    console.error('Unable to render insights from Supabase:', error);
    log = getFallbackUrgeEntries(100);
  }

  if (log.length < 2) {
    container.innerHTML = '<p class="text-osa-muted text-xs">Log a few urges to see your patterns.</p>';
    return;
  }

  // Count triggers
  const triggers = {};
  log.forEach(e => {
    const trigger = e.trigger || INTERVENTION_INSERT_DEFAULTS.trigger;
    triggers[trigger] = (triggers[trigger] || 0) + 1;
  });
  const topTrigger = Object.entries(triggers).sort((a, b) => b[1] - a[1])[0][0];

  // Count hour buckets
  const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  log.forEach(e => {
    const h = new Date(e.created_at).getHours();
    if (h >= 5 && h < 12) buckets.Morning++;
    else if (h >= 12 && h < 17) buckets.Afternoon++;
    else if (h >= 17 && h < 22) buckets.Evening++;
    else buckets.Night++;
  });
  const peakTime = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0];

  // Control rate
  const resistedCount = log.filter(entry => entry.resisted).length;
  const rate = log.length > 0 ? Math.round((resistedCount / log.length) * 100) : 0;
  const recentCount = log.filter(entry => Date.now() - new Date(entry.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000).length;

  container.innerHTML = `
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-black/30 rounded-xl p-3">
        <p class="text-osa-muted mb-1">Top trigger</p>
        <p class="text-osa-text font-semibold">${topTrigger}</p>
      </div>
      <div class="bg-black/30 rounded-xl p-3">
        <p class="text-osa-muted mb-1">Danger time</p>
        <p class="text-osa-text font-semibold">${peakTime}</p>
      </div>
      <div class="bg-black/30 rounded-xl p-3">
        <p class="text-osa-muted mb-1">Control score</p>
        <p class="text-osa-accent font-bold text-base">${rate}%</p>
      </div>
      <div class="bg-black/30 rounded-xl p-3">
        <p class="text-osa-muted mb-1">Last 7 days</p>
        <p class="text-osa-text font-semibold">${recentCount} urges</p>
      </div>
    </div>
    <p class="text-osa-muted text-xs mt-3">Based on ${log.length} logged urge${log.length === 1 ? '' : 's'}.</p>`;
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

async function generateAIInsights() {
  let log = [];

  try {
    log = await loadUrgeEntries(50);
  } catch (error) {
    console.error('Unable to load urge logs for AI insights:', error);
    log = getFallbackUrgeEntries(50);
  }

  if (log.length === 0) { showToast('Log some urges first.'); return; }

  const btn = document.getElementById('ai-insights-btn');
  btn.textContent = 'Analysing...';
  btn.disabled = true;

  try {
    const data = await postJson('/insights', { logs: log });
    document.getElementById('ai-insight-text').textContent = data.insight;
    document.getElementById('ai-insight-box').classList.remove('hidden');
  } catch {
    document.getElementById('ai-insight-text').textContent = 'Stay consistent. Every logged urge is progress.';
    document.getElementById('ai-insight-box').classList.remove('hidden');
  } finally {
    btn.textContent = 'Ask Osa';
    btn.disabled = false;
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

const onboardSteps = [
  {
    title: 'Voice of Osa',
    text: 'You are not weak.\nYou just need control.',
    btn: 'I\'m ready',
  },
  {
    title: 'Understand yourself',
    text: 'Urges come from patterns — not your identity.\nWhen you understand your triggers, you own them.',
    btn: 'Continue',
  },
  {
    title: 'How Osa works',
    text: 'Track every urge. Resist with a timer. Talk to Osa. Build your streak.\nThis is your behavioral operating system.',
    btn: 'Continue',
  },
  {
    title: 'One last thing',
    text: null, // Setup screen
    btn: 'Start my journey',
  },
];

let onboardStep = 0;

function initOnboarding() {
  if (localStorage.getItem('osa_onboarded') === 'true') return;
  document.getElementById('onboarding').classList.remove('hidden');
  renderOnboardStep();
}

function renderOnboardStep() {
  const step = onboardSteps[onboardStep];
  document.getElementById('onboard-title').textContent = step.title;
  document.getElementById('onboard-btn').textContent = step.btn;

  const textEl = document.getElementById('onboard-text');
  const setupEl = document.getElementById('onboard-setup');

  if (step.text) {
    textEl.textContent = step.text;
    textEl.classList.remove('hidden');
    setupEl.classList.add('hidden');
  } else {
    textEl.classList.add('hidden');
    setupEl.classList.remove('hidden');
  }

  // Progress dots
  document.querySelectorAll('.onboard-dot').forEach((dot, i) => {
    dot.classList.toggle('bg-osa-accent', i === onboardStep);
    dot.classList.toggle('bg-osa-border', i !== onboardStep);
  });
}

function nextOnboard() {
  onboardStep++;
  if (onboardStep < onboardSteps.length) {
    renderOnboardStep();
  } else {
    finishOnboarding();
  }
}

function finishOnboarding() {
  const trigger = document.getElementById('onboard-trigger')?.value || 'Unknown';
  localStorage.setItem('userTrigger', trigger);
  localStorage.setItem('osa_onboarded', 'true');
  document.getElementById('onboarding').classList.add('hidden');
}

// ─── Emergency Mode ───────────────────────────────────────────────────────────

const emergencyMessages = [
  'Stop. Right now. Do not move.',
  'You are not your urges. Not today.',
  'This is the moment that defines you. Hold.',
  'Every second you wait, the urge gets weaker.',
];

function triggerEmergency() {
  const msg = emergencyMessages[Math.floor(Math.random() * emergencyMessages.length)];
  document.getElementById('emergency-message').textContent = msg;
  document.getElementById('emergency-mode').classList.remove('hidden');
  speak(msg);
}

function closeEmergency() {
  document.getElementById('emergency-mode').classList.add('hidden');
  window.speechSynthesis.cancel();
}

// ─── Voice ────────────────────────────────────────────────────────────────────

function speak(text) {
  window.speechSynthesis.cancel();
  const s = new SpeechSynthesisUtterance(text);
  s.rate = 0.9; s.pitch = 1; s.lang = 'en-US';
  const voices = speechSynthesis.getVoices();
  if (voices.length) s.voice = voices[0];
  window.speechSynthesis.speak(s);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

let isSending = false;

function appendMessage(text, sender) {
  const container = document.getElementById('chat-messages');
  const wrapper = document.createElement('div');
  wrapper.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} message-enter`;
  const bubble = document.createElement('div');

  if (sender === 'user') {
    bubble.className = 'bg-osa-user text-osa-text rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs text-sm leading-relaxed border border-blue-900/30';
    bubble.textContent = text;
  } else {
    bubble.className = 'bg-osa-bot border border-osa-border text-osa-text rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs text-sm leading-relaxed';
    const label = document.createElement('span');
    label.className = 'block text-osa-accent text-xs font-semibold mb-1 tracking-wide uppercase';
    label.textContent = 'Osa';

    const body = document.createElement('span');
    body.className = 'whitespace-pre-line';
    body.textContent = text;

    bubble.append(label, body);
  }

  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
  return wrapper;
}

function setInputLocked(locked) {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chatSendBtn');
  if (!input || !btn) return;
  input.disabled = locked;
  btn.disabled = locked;
  btn.style.opacity = locked ? '0.5' : '1';
}

async function sendMessage() {
  if (isSending) return;
  if (!checkTrialGate()) return;
  if (!useToken()) return;

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) { saveTokens(getTokens() + 1); return; }

  isSending = true;
  appendMessage(text, 'user');
  input.value = '';
  setInputLocked(true);

  const loadingWrapper = appendMessage('Osa is thinking...', 'osa');
  loadingWrapper.querySelector('div').style.opacity = '0.5';

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const context = getLiveInterventionContext();
    const data = await postJson('/chat', {
      userId: user?.id,
      trigger: context.trigger,
      emotion: text || context.emotion,
    });
    loadingWrapper.remove();

    const reply = data.reply || data.message;
    if (reply) {
      appendMessage(reply, 'osa');
      await playOsaAudio(data.audio, { force: false });
    } else throw new Error('no reply');
  } catch (error) {
    console.error('Unable to send message to Osa:', error);
    loadingWrapper.remove();
    appendMessage(INTERVENTION_FALLBACK_MESSAGE, 'osa');
  } finally {
    isSending = false;
    setInputLocked(false);
    input.focus();
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-osa-card border border-osa-border text-osa-text text-sm px-5 py-3 rounded-full shadow-xl z-50 transition-all duration-300 whitespace-nowrap';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2800);
}

// ─── 24hr Day Countdown + Reward System ──────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function initDayStart() {
  const stored = localStorage.getItem('dayStart');
  // Reset if a full 24h cycle has already expired and reward was given
  if (stored && Date.now() - parseInt(stored) >= DAY_MS && localStorage.getItem('rewardGiven')) {
    localStorage.setItem('dayStart', Date.now());
    localStorage.removeItem('rewardGiven');
  }
  if (!localStorage.getItem('dayStart')) {
    localStorage.setItem('dayStart', Date.now());
  }
}

function getRemainingTime() {
  const start = parseInt(localStorage.getItem('dayStart'));
  const remaining = DAY_MS - (Date.now() - start);
  if (remaining <= 0) return null; // signals complete
  const h = Math.floor(remaining / (1000 * 60 * 60));
  const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((remaining % (1000 * 60)) / 1000);
  return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}

function getElapsedPercent() {
  const start = parseInt(localStorage.getItem('dayStart'));
  return Math.min(((Date.now() - start) / DAY_MS) * 100, 100);
}

function isDayComplete() {
  const start = parseInt(localStorage.getItem('dayStart'));
  return Date.now() - start >= DAY_MS;
}

const battleEncouragements = [
  "You're still in control.",
  'Hold your ground.',
  'This moment will pass.',
  "Stay with it. Don't break.",
  'Every second is a win.',
];

let encourageInterval = null;

function setBattleMode(active) {
  if (active) {
    document.body.classList.add('battle');
    encourageInterval = setInterval(() => {
      const msg = battleEncouragements[Math.floor(Math.random() * battleEncouragements.length)];
      showToast(msg);
    }, 90000); // every 90s
  } else {
    document.body.classList.remove('battle');
    clearInterval(encourageInterval);
    encourageInterval = null;
  }
}

function checkDayReward() {
  if (isDayComplete() && !localStorage.getItem('rewardGiven')) {
    localStorage.setItem('rewardGiven', 'true');
    showDayReward();
  }
}

const rewardMessages = [
  'You are building control.',
  'This is what discipline looks like.',
  'You did not break.',
  'You are becoming stronger.',
];

function showDayReward() {
  const stats = getStats();
  const msg = rewardMessages[Math.floor(Math.random() * rewardMessages.length)];

  // Award 5 bonus tokens
  const newTokens = getTokens() + 5;
  saveTokens(newTokens);

  // Flash green background
  document.body.style.background = 'radial-gradient(circle at center, #052e16, #0d0d0d)';
  setTimeout(() => { document.body.style.background = ''; }, 2000);

  const popup = document.getElementById('reward-popup');
  document.getElementById('reward-message').textContent = msg;
  document.getElementById('reward-resisted').textContent = stats.resisted;
  popup.classList.remove('hidden');
}

function closeReward() {
  document.getElementById('reward-popup').classList.add('hidden');
  // Reset for next day
  localStorage.setItem('dayStart', Date.now());
  localStorage.removeItem('rewardGiven');
  updateDayCountdown();
}

function updateDayCountdown() {
  const countdownEl = document.getElementById('day-countdown');
  const barEl = document.getElementById('day-progress-bar');
  if (!countdownEl) return;

  const remaining = getRemainingTime();

  if (!remaining) {
    countdownEl.textContent = 'Day complete';
    if (barEl) { barEl.style.width = '100%'; barEl.classList.replace('bg-osa-accent', 'bg-green-500'); }
    checkDayReward();
  } else {
    countdownEl.textContent = remaining;
    const pct = getElapsedPercent();
    if (barEl) barEl.style.width = pct + '%';
  }
}

function startDayCountdown() {
  updateDayCountdown();
  setInterval(updateDayCountdown, 1000);
}

// ─── Notifications ────────────────────────────────────────────────────────────

function getSmartMessage() {
  const stats = getStats();
  const streak = getStreak();
  const daysLeft = getTrialDaysLeft();
  if (!isTrialActive()) return null;
  if (daysLeft === 2) return '2 days of free access left.';
  if (daysLeft === 0) return 'Free access ends today.';
  if (stats.urges > 3) return "You've been tested today. Stay alert.";
  if (streak >= 7) return `${streak} days strong. Don't stop now.`;
  if (streak <= 3 && streak > 0) return 'Early days are the hardest. Keep going.';
  const pool = ['Stay grounded. This will pass.', 'Control your mind, control your life.', "Don't trade discipline for a moment."];
  return pool[Math.floor(Math.random() * pool.length)];
}

function sendNotification(msg) {
  if (Notification.permission === 'granted' && msg) {
    new Notification('Voice of Osa', { body: msg, icon: 'https://cdn-icons-png.flaticon.com/512/747/747376.png' });
  }
}

function startNotificationSchedule() {
  setInterval(() => {
    const h = new Date().getHours();
    if (h === 22 || h === 0 || h === 6) sendNotification(getSmartMessage());
  }, 60000);
}

// ─── Trial Banner ─────────────────────────────────────────────────────────────

function renderTrialBanner() {
  if (!isTrialActive()) return;
  const daysLeft = getTrialDaysLeft();
  if (daysLeft > 7) return;
  const existing = document.getElementById('trial-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'trial-banner';
  banner.className = 'mx-4 mb-3 px-4 py-2.5 rounded-xl bg-yellow-950/40 border border-yellow-800/40 flex items-center justify-between';
  banner.innerHTML = `
    <span class="text-yellow-400 text-xs">${daysLeft === 0 ? 'Free access ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} of free access left`}</span>
    <button onclick="showToast('Payment coming soon.')" class="text-yellow-400 text-xs font-bold underline underline-offset-2">Upgrade</button>`;
  document.querySelector('nav').after(banner);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
