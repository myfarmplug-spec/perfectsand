// ─── connect supabase ───
const supabaseUrl = "https://njtoptrbskaklunzavzr.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdG9wdHJic2tha2x1bnphdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDY0OTAsImV4cCI6MjA5MDE4MjQ5MH0.CJXWm6VFxymxsIfAd58KCs1p_4S04979vJUy9xH4gr0";

const supabaseClient = window.__perfectSandSupabaseClient
  || (window.__perfectSandSupabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey));
const REMOTE_API_BASE = 'https://perfectsand.onrender.com';
const INTERVENTION_DURATION_SECONDS = 600;
const INTERVENTION_FALLBACK_MESSAGE = 'Stay with it. This will pass.';
const SESSION_SAVE_MAX_ATTEMPTS = 2;
const FREE_TOKEN_BALANCE = 50;
const DAILY_MISSION_KEYS = ['morning', 'work', 'night'];
const FOCUS_BLOCK_DURATION_MS = 90 * 60 * 1000;
const MISSION_ITEM_GROUPS = {
  morning: ['morning-phone', 'morning-water', 'morning-silence'],
  night: ['night-review', 'night-screens', 'night-sleep'],
};
const INTERVENTION_INSERT_DEFAULTS = {
  trigger: 'alone in room',
  emotion: 'tempted',
  resisted: false,
};

let interventionInterval = null;
let interventionSessionId = 0;
let activeOsaAudio = null;
let activeOsaAudioPlaybackId = 0;
let focusBlockInterval = null;

// ─── Habit Stats Cache ────────────────────────────────────────────────────────

let _cachedHabitStats = null;

function cacheHabitStats(stats) {
  _cachedHabitStats = stats;
  try { localStorage.setItem('osa_habit_stats', JSON.stringify(stats)); } catch {}
}

function getCachedHabitStats() {
  if (_cachedHabitStats) return _cachedHabitStats;
  try {
    const stored = localStorage.getItem('osa_habit_stats');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

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

function getBannerStack() {
  return document.getElementById('banner-stack');
}

function placeBanner(banner) {
  const stack = getBannerStack();
  if (stack) {
    stack.appendChild(banner);
    return;
  }

  const header = document.querySelector('header');
  if (header) {
    header.after(banner);
  }
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
  await renderUserProfileSummary(user, {
    full_name: fullName,
    code_name: codeName,
    age,
  });
}

async function checkProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data } = await supabaseClient
    .from('profiles')
    .select('full_name, code_name, age')
    .eq('user_id', user.id)
    .maybeSingle();

  await renderUserProfileSummary(user, data || null);
}

function getUserFirstName(profile, user) {
  const fullName = profile?.full_name || profile?.code_name || user?.user_metadata?.full_name || user?.email || 'Prince';
  return fullName.split('@')[0].trim().split(' ')[0] || 'Prince';
}

function getUserInitials(profile, user) {
  const source = profile?.code_name || profile?.full_name || user?.email || 'Perfect Sand';
  const tokens = source.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'PS';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function getUserLevel(stats = getStats()) {
  const resisted = stats.resisted || 0;
  const level = Math.max(1, Math.min(10, Math.floor(resisted / 12) + 1));
  const levelStart = (level - 1) * 12;
  const levelProgress = Math.min(100, Math.round(((resisted - levelStart) / 12) * 100));
  return {
    level,
    progress: Math.max(0, levelProgress),
  };
}

async function renderUserProfileSummary(user = null, profile = null) {
  let resolvedUser = user;
  let resolvedProfile = profile;

  if (!resolvedUser) {
    const { data: authData } = await supabaseClient.auth.getUser();
    resolvedUser = authData.user;
  }

  if (!resolvedProfile && resolvedUser) {
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('full_name, code_name, age')
        .eq('user_id', resolvedUser.id)
        .maybeSingle();
      resolvedProfile = data || null;
    } catch {
      resolvedProfile = null;
    }
  }

  const firstName = getUserFirstName(resolvedProfile, resolvedUser);
  const initials = getUserInitials(resolvedProfile, resolvedUser);
  const stats = getCachedHabitStats() || getStats();
  const level = getUserLevel(stats);

  const avatar = document.getElementById('user-avatar-text');
  if (avatar) avatar.textContent = initials;

  const meUserName = document.getElementById('me-user-name');
  if (meUserName) meUserName.textContent = firstName;

  const levelLabel = document.getElementById('me-level-label');
  if (levelLabel) levelLabel.textContent = `Sand Guardian Level ${level.level}`;

  const heroLevelBadge = document.getElementById('hero-level-badge');
  if (heroLevelBadge) heroLevelBadge.textContent = `Sand Guardian Lv ${level.level}`;

  const progressText = document.getElementById('me-level-progress-text');
  if (progressText) progressText.textContent = `${level.progress}%`;

  const progressBar = document.getElementById('me-level-progress-bar');
  if (progressBar) progressBar.style.width = `${level.progress}%`;

  const chatMessages = document.getElementById('chat-messages');
  const firstBubble = chatMessages?.querySelector('div div');
  if (firstBubble && chatMessages.children.length === 1) {
    firstBubble.innerHTML = `
      <span class="block text-osa-accent text-xs font-semibold mb-1 tracking-wide uppercase">Osa</span>
      I dey here, ${firstName}. Wetin dey happen? Talk to me.
    `;
  }
}

// ─── App init (runs once after login) ─────────────────────────────────────────

let _appInited = false;

function initApp() {
  if (_appInited) return;
  _appInited = true;

  document.getElementById('logout-btn').classList.remove('hidden');
  initVoiceControls();
  initTokens();
  initTrial();
  initDayStart();
  initOnboarding();
  showTab('dashboard');
  renderStreak();
  renderStats();
  renderTrialBanner();
  renderMissionProgress();
  renderFocusBlock();
  startDayCountdown();
  if (Notification.permission !== 'granted') Notification.requestPermission();
  startNotificationSchedule();
  void checkProfile();

  initPassivePresence();

  supabaseClient.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    fetchRemoteStats().then(stats => {
      saveStats(stats);
      applyStatsToDashboard(stats);
      renderHabitStats(stats);
    }).catch(console.error);
    checkDailyEngagement(user.id);
    loadUserPlan(user.id).then(() => {
      // Predictive check runs after plan is known (premium gate inside)
      runPredictiveCheck(user.id, { force: true });
    });

    // Re-check when tab becomes visible again (user returns to app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        runPredictiveCheck(user.id);
      }
    });

    // Idle check: if user stays on dashboard without interaction for 5 min
    let idleTimer = null;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!document.body.classList.contains('intervention-active')) {
          runPredictiveCheck(user.id);
        }
      }, 5 * 60 * 1000);
    };
    ['click', 'touchstart', 'keydown'].forEach(ev => {
      document.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();
  });
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
  const rateText = rate !== null ? `${rate}%` : '0%';
  document.getElementById('stat-rate').textContent = rateText;
  const urgesWinEl = document.getElementById('dashboard-win-urges');
  if (urgesWinEl) urgesWinEl.textContent = String(s.resisted);

  const level = getControlLevel(rate);
  const levelEl = document.getElementById('control-level');
  if (levelEl) {
    levelEl.textContent = rate !== null ? (rate >= 70 ? 'Strong today 🔥' : 'You’re building momentum') : 'You’re building momentum';
    levelEl.className = `mt-1 text-lg font-semibold ${level.color}`;
  }

  const ringMessage = document.getElementById('control-ring-message');
  if (ringMessage) {
    ringMessage.textContent = rate !== null
      ? (rate >= 70 ? 'Strong today 🔥' : 'You’re building momentum')
      : 'You’re building momentum';
  }

  const ring = document.getElementById('control-ring');
  if (ring) {
    ring.style.setProperty('--progress', `${Math.max(rate ?? 0, 4)}%`);
  }

  const ringPercent = document.getElementById('control-ring-percent');
  if (ringPercent) {
    ringPercent.textContent = rateText;
  }

  const meTotalResisted = document.getElementById('me-total-resisted');
  if (meTotalResisted) {
    meTotalResisted.textContent = String(s.resisted || 0);
  }
}

async function fetchRemoteStats() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return getStats();

  const [totalResponse, resistedResponse, habitResponse] = await Promise.all([
    supabaseClient
      .from('urges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabaseClient
      .from('urges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resisted', true),
    supabaseClient
      .from('user_stats')
      .select('current_streak, longest_streak, last_resisted_date')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (totalResponse.error) throw totalResponse.error;
  if (resistedResponse.error) throw resistedResponse.error;

  const cached = getStats();
  const totalUrges = totalResponse.count || 0;
  const totalResisted = resistedResponse.count || 0;
  const controlRate = totalUrges > 0 ? Math.round((totalResisted / totalUrges) * 100) : null;
  const habitData = habitResponse.data;

  const stats = {
    urges: totalUrges,
    resisted: totalResisted,
    slips: cached.slips || 0,
    current_streak: habitData?.current_streak || 0,
    longest_streak: habitData?.longest_streak || 0,
    controlRate,
  };

  cacheHabitStats(stats);
  return stats;
}

async function renderStats() {
  const cached = getStats();
  applyStatsToDashboard(cached);
  renderHabitStats();
  void renderTodayPressureSummary();

  try {
    const remoteStats = await fetchRemoteStats();
    saveStats(remoteStats);
    applyStatsToDashboard(remoteStats);
    renderHabitStats(remoteStats);
    await renderTodayPressureSummary();
  } catch (error) {
    console.error('Unable to refresh stats from Supabase:', error);
  }
}

// (checkShareMoment is called directly from resistIntervention, not here,
//  to avoid triggering it on every stats refresh)

function setState(label) {
  const el = document.getElementById('user-state');
  if (el) el.textContent = label;
}

function recordSlip() {
  const s = getStats();
  s.slips += 1;
  saveStats(s);
  showToast('Recorded honestly. Tomorrow is another chance. You are not your urges.');
  supabaseClient.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      syncUserStats(user.id, { resisted: false })
        .then(() => renderStats())
        .catch(console.error);
    }
  });
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

function getTokens() {
  return parseInt(localStorage.getItem('osaTokens') ?? String(FREE_TOKEN_BALANCE), 10);
}

function initTokens() {
  if (localStorage.getItem('osaTokens') === null) {
    localStorage.setItem('osaTokens', String(FREE_TOKEN_BALANCE));
  }
  syncTokenDisplays();
}

function saveTokens(n) {
  localStorage.setItem('osaTokens', n);
  syncTokenDisplays();
}

function syncTokenDisplays() {
  const tokenValue = String(getTokens());
  ['token-count', 'chat-token-balance', 'pricing-token-count'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = tokenValue;
  });
}

function useToken() {
  const t = getTokens();
  if (t <= 0) { showToast('No tokens left. Buy more to continue.'); return false; }
  saveTokens(t - 1);
  if (t - 1 > 0 && t - 1 <= 3) {
    showToast(`You have ${t - 1} token${t - 1 === 1 ? '' : 's'} left. Osa is here when you need her most.`);
  }
  return true;
}

function showTokenInfo() {
  showUpgradeModal();
}

function getFreeChatCredits() {
  return parseInt(localStorage.getItem('osa_free_chat_credits') || '0', 10);
}

function addFreeChatCredit(amount = 1) {
  localStorage.setItem('osa_free_chat_credits', String(getFreeChatCredits() + amount));
}

function consumeFreeChatCredit() {
  const nextValue = Math.max(0, getFreeChatCredits() - 1);
  localStorage.setItem('osa_free_chat_credits', String(nextValue));
}

function getMissionItemsState() {
  try {
    const raw = JSON.parse(localStorage.getItem('osa_mission_items') || '{}');
    if (raw.date !== getTodayKey()) {
      return {
        date: getTodayKey(),
        'morning-phone': false,
        'morning-water': false,
        'morning-silence': false,
        'night-review': false,
        'night-screens': false,
        'night-sleep': false,
      };
    }

    return {
      date: getTodayKey(),
      'morning-phone': Boolean(raw['morning-phone']),
      'morning-water': Boolean(raw['morning-water']),
      'morning-silence': Boolean(raw['morning-silence']),
      'night-review': Boolean(raw['night-review']),
      'night-screens': Boolean(raw['night-screens']),
      'night-sleep': Boolean(raw['night-sleep']),
    };
  } catch {
    return {
      date: getTodayKey(),
      'morning-phone': false,
      'morning-water': false,
      'morning-silence': false,
      'night-review': false,
      'night-screens': false,
      'night-sleep': false,
    };
  }
}

function saveMissionItemsState(state) {
  localStorage.setItem('osa_mission_items', JSON.stringify(state));
}

function isMissionGroupComplete(key, itemsState = getMissionItemsState()) {
  const keys = MISSION_ITEM_GROUPS[key];
  if (!keys) return false;
  return keys.every((itemKey) => Boolean(itemsState[itemKey]));
}

function setMissionGroupItems(key, complete) {
  const keys = MISSION_ITEM_GROUPS[key];
  if (!keys) return;
  const itemsState = getMissionItemsState();
  keys.forEach((itemKey) => {
    itemsState[itemKey] = complete;
  });
  saveMissionItemsState(itemsState);
}

function getFocusBlockState() {
  try {
    const raw = JSON.parse(localStorage.getItem('osa_focus_blocks') || '{}');
    if (raw.date !== getTodayKey()) {
      return {
        date: getTodayKey(),
        count: 0,
        activeUntil: null,
      };
    }

    return {
      date: getTodayKey(),
      count: Number(raw.count) || 0,
      activeUntil: raw.activeUntil || null,
    };
  } catch {
    return {
      date: getTodayKey(),
      count: 0,
      activeUntil: null,
    };
  }
}

function saveFocusBlockState(state) {
  localStorage.setItem('osa_focus_blocks', JSON.stringify(state));
}

function getMissionState() {
  try {
    const raw = JSON.parse(localStorage.getItem('osa_daily_missions') || '{}');
    const itemsState = getMissionItemsState();
    const focusState = getFocusBlockState();
    if (raw.date !== getTodayKey()) {
      return {
        date: getTodayKey(),
        morning: isMissionGroupComplete('morning', itemsState),
        work: focusState.count >= 2 || Boolean(raw.work),
        night: isMissionGroupComplete('night', itemsState),
      };
    }

    return {
      date: getTodayKey(),
      morning: isMissionGroupComplete('morning', itemsState) || Boolean(raw.morning),
      work: focusState.count >= 2 || Boolean(raw.work),
      night: isMissionGroupComplete('night', itemsState) || Boolean(raw.night),
    };
  } catch {
    const itemsState = getMissionItemsState();
    const focusState = getFocusBlockState();
    return {
      date: getTodayKey(),
      morning: isMissionGroupComplete('morning', itemsState),
      work: focusState.count >= 2,
      night: isMissionGroupComplete('night', itemsState),
    };
  }
}

function saveMissionState(state) {
  localStorage.setItem('osa_daily_missions', JSON.stringify(state));
}

function getMissionCount(state = getMissionState()) {
  return DAILY_MISSION_KEYS.reduce((count, key) => count + (state[key] ? 1 : 0), 0);
}

function renderMissionProgress() {
  const state = getMissionState();
  const itemsState = getMissionItemsState();
  const focusState = getFocusBlockState();
  const completeCount = getMissionCount(state);
  const percent = Math.round((completeCount / DAILY_MISSION_KEYS.length) * 100);

  const bar = document.getElementById('mission-progress-bar');
  if (bar) {
    bar.style.width = `${percent}%`;
  }

  const percentLabel = document.getElementById('mission-progress-percent');
  if (percentLabel) {
    percentLabel.textContent = `${percent}%`;
  }

  const progressText = document.getElementById('mission-progress-text');
  if (progressText) {
    progressText.textContent = `${completeCount} of ${DAILY_MISSION_KEYS.length} locked in`;
  }

  const todayRoutineCount = document.getElementById('dashboard-win-routines');
  if (todayRoutineCount) {
    todayRoutineCount.textContent = `${completeCount}/3`;
  }

  DAILY_MISSION_KEYS.forEach((key) => {
    const complete = state[key];
    const statusEl = document.getElementById(`mission-status-${key}`);
    const toggleEl = document.getElementById(`mission-toggle-${key}`);
    const cardEl = document.getElementById(`mission-card-${key}`);
    const pillEl = document.getElementById(`dashboard-mission-${key}`);

    if (statusEl) {
      statusEl.textContent = complete ? 'Complete' : 'Pending';
      statusEl.classList.toggle('is-complete', complete);
    }

    if (toggleEl) {
      if (key === 'work') {
        toggleEl.textContent = focusState.activeUntil ? 'Block Running' : (complete ? 'Done' : 'Start 90-min Block');
      } else {
        toggleEl.textContent = complete ? 'Done' : `Complete ${key}`;
      }
      toggleEl.classList.toggle('is-complete', complete);
    }

    if (cardEl) {
      cardEl.classList.toggle('is-complete', complete);
    }

    if (pillEl) {
      pillEl.classList.toggle('is-complete', complete);
    }
  });

  Object.entries(itemsState).forEach(([key, complete]) => {
    if (key === 'date') return;
    const itemEl = document.getElementById(`mission-item-${key}`);
    if (!itemEl) return;
    itemEl.textContent = complete ? 'Done ✓' : 'Done';
    itemEl.classList.toggle('is-complete', complete);
  });

  const statusLabel = document.getElementById('focus-block-progress-text');
  if (statusLabel) {
    statusLabel.textContent = `${focusState.count}/2 blocks completed`;
  }
}

function toggleMission(key) {
  if (!DAILY_MISSION_KEYS.includes(key)) return;

  const state = getMissionState();
  const nextValue = !state[key];

  if (MISSION_ITEM_GROUPS[key]) {
    setMissionGroupItems(key, nextValue);
    state[key] = nextValue;
  } else {
    state[key] = nextValue;
  }

  saveMissionState({ date: getTodayKey(), ...state });
  renderMissionProgress();

  if (nextValue) {
    const completeCount = getMissionCount(state);
    showToast(completeCount === DAILY_MISSION_KEYS.length
      ? 'Mission complete. Clean work.'
      : 'Mission step locked in.');
  }
}

function toggleMissionItem(itemKey) {
  const itemsState = getMissionItemsState();
  if (!(itemKey in itemsState)) return;
  itemsState[itemKey] = !itemsState[itemKey];
  saveMissionItemsState(itemsState);

  const groupKey = itemKey.startsWith('morning') ? 'morning' : 'night';
  const state = getMissionState();
  state[groupKey] = isMissionGroupComplete(groupKey, itemsState);
  saveMissionState({ date: getTodayKey(), ...state });
  renderMissionProgress();

  if (itemsState[itemKey]) {
    showToast('You held body. Respect.');
  }
}

function formatFocusTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function completeFocusBlock() {
  const state = getFocusBlockState();
  if (!state.activeUntil) return;

  state.activeUntil = null;
  state.count = Math.min(2, state.count + 1);
  saveFocusBlockState(state);

  const missionState = getMissionState();
  missionState.work = state.count >= 2;
  saveMissionState({ date: getTodayKey(), ...missionState });
  renderFocusBlock();
  renderMissionProgress();
  showToast(state.count >= 2 ? 'Focus blocks complete. You held body today!' : 'One deep work block complete.');
}

function renderFocusBlock() {
  const state = getFocusBlockState();
  const statusEl = document.getElementById('focus-block-status');
  const buttonEl = document.getElementById('mission-toggle-work');
  const missionState = getMissionState();

  clearInterval(focusBlockInterval);
  focusBlockInterval = null;

  if (!statusEl || !buttonEl) return;

  if (state.activeUntil) {
    const remainingMs = new Date(state.activeUntil).getTime() - Date.now();
    if (remainingMs <= 0) {
      completeFocusBlock();
      return;
    }

    statusEl.textContent = `Focus block running — ${formatFocusTime(remainingMs)} remaining`;
    buttonEl.textContent = 'Block Running';
    buttonEl.disabled = true;
    buttonEl.style.opacity = '0.7';

    focusBlockInterval = setInterval(() => {
      renderFocusBlock();
    }, 1000);
    return;
  }

  if (state.count >= 2 || missionState.work) {
    statusEl.textContent = '2 deep work blocks complete. Strong work.';
    buttonEl.textContent = 'Done';
    buttonEl.disabled = true;
    buttonEl.style.opacity = '0.7';
    return;
  }

  statusEl.textContent = state.count === 0
    ? 'Ready to begin your first block.'
    : 'One block done. Start your second 90-min block.';
  buttonEl.textContent = 'Start 90-min Block';
  buttonEl.disabled = false;
  buttonEl.style.opacity = '1';
}

function startFocusBlock() {
  const state = getFocusBlockState();
  if (state.activeUntil) {
    showToast('Focus block already running.');
    return;
  }
  if (state.count >= 2) {
    showToast('You already finished both focus blocks.');
    return;
  }

  state.activeUntil = new Date(Date.now() + FOCUS_BLOCK_DURATION_MS).toISOString();
  saveFocusBlockState(state);
  renderFocusBlock();
  renderMissionProgress();
  showToast('90-min block started. Protect your attention.');
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
    <p class="text-osa-muted text-sm mb-8 max-w-xs">Don't lose this progress. Continue your journey with deeper Osa support.</p>
    <div class="space-y-3 w-full max-w-xs">
      <button onclick="showToast('Payment coming soon.')" class="w-full py-3.5 rounded-2xl bg-osa-accent text-black font-bold text-sm">100 Tokens — ₦700</button>
      <button onclick="showToast('Payment coming soon.')" class="w-full py-3.5 rounded-2xl border border-osa-accent text-osa-accent font-bold text-sm">Unlimited Osa — ₦2,500/mo</button>
      <button onclick="showToast('Payment coming soon.')" class="w-full py-3.5 rounded-2xl border border-white/10 bg-osa-card text-osa-text font-bold text-sm">Lifetime Discipline — ₦18,000</button>
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
  const heroStreak = document.getElementById('hero-streak-text');
  if (heroStreak) heroStreak.textContent = streak;

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
  localStorage.setItem('rewardGiven', 'true');
  showDayReward({ source: 'manual' });
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-osa-accent', 'text-black');
    btn.classList.add('text-osa-muted');
  });
  const content = document.getElementById(`tab-content-${name}`);
  const btn = document.getElementById(`tab-${name}`);
  if (!content || !btn) return;

  content.classList.remove('hidden');
  btn.classList.add('bg-osa-accent', 'text-black');
  btn.classList.remove('text-osa-muted');

  if (name === 'dashboard' || name === 'mission') {
    renderMissionProgress();
    renderFocusBlock();
  }

  if (name === 'dashboard' || name === 'arena') {
    void renderTodayPressureSummary();
  }

  if (name === 'me') {
    renderHistory();
    renderInsights();
    void renderProgressHeatmap();
    void renderUserProfileSummary();
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

  if (titleEl) titleEl.textContent = 'Urge Detected. You’ve got this.';
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
  const habitStats = getCachedHabitStats();
  const data = await postJson('/chat', {
    userId,
    trigger,
    emotion,
    streak: habitStats?.current_streak || 0,
    controlRate: habitStats?.controlRate ?? null,
    plan: getUserPlan(),
    dailyStatus: getDailyStatus(),
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
      if (user) {
        if (!currentUrge.id) {
          await ensureInterventionUrge(user.id, interventionSessionId);
        }
        await syncUserStats(user.id, { resisted: false });
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
  setState('Resetting');
  showToast('Recorded honestly. Tomorrow is another chance. You are not your urges.');
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
    await syncUserStats(user.id, { resisted: true });
    resetIgnoredWarnings();
    checkShareMoment(getCachedHabitStats());
    setState('In Control');
    setInterventionStatus('Legend move.', 'success');
    setInterventionMessage('Legend. Urge resisted.');
    fireConfetti({ colors: ['#00c853', '#8dffb3', '#d4a017', '#ffffff'] });
    showToast('Legend move.');
  } catch (error) {
    console.error('Unable to mark urge as resisted:', error);
    setState('In Control');
    setInterventionStatus('Legend move.', 'success');
    setInterventionMessage('Legend. Urge resisted.');
    showToast('Legend move.');
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
    void renderProgressHeatmap([]);
    void renderTodayPressureSummary([]);
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
      const learnedLabel = entry.resisted ? 'Cold water worked' : 'Record it, learn, move on';

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
        </div>
        <p class="mt-3 text-xs text-osa-muted">Learned: ${learnedLabel}</p>`;
      groupEl.appendChild(card);
    });

    container.appendChild(groupEl);
  });

  void renderProgressHeatmap(entries);
  void renderTodayPressureSummary(entries);
}

function getDateLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

async function renderTodayPressureSummary(entries = null) {
  let log = entries;

  if (!Array.isArray(log)) {
    try {
      log = await loadUrgeEntries(100);
    } catch {
      log = getFallbackUrgeEntries(100);
    }
  }

  const today = getTodayKey();
  const todayEntries = log.filter((entry) => (entry.created_at || '').slice(0, 10) === today);
  const resistedToday = todayEntries.filter((entry) => entry.resisted).length;

  const resistedTodayEl = document.getElementById('resisted-today-count');
  if (resistedTodayEl) {
    resistedTodayEl.textContent = resistedToday;
  }

  const dashboardWinUrges = document.getElementById('dashboard-win-urges');
  if (dashboardWinUrges) {
    dashboardWinUrges.textContent = String(resistedToday);
  }
}

async function renderProgressHeatmap(entries = null) {
  const container = document.getElementById('progress-heatmap');
  if (!container) return;

  let log = entries;
  if (!Array.isArray(log)) {
    try {
      log = await loadUrgeEntries(100);
    } catch {
      log = getFallbackUrgeEntries(100);
    }
  }

  const dayMap = new Map();
  log.forEach((entry) => {
    const dayKey = (entry.created_at || '').slice(0, 10);
    if (!dayKey) return;

    const current = dayMap.get(dayKey) || { total: 0, resisted: 0 };
    current.total += 1;
    if (entry.resisted) current.resisted += 1;
    dayMap.set(dayKey, current);
  });

  const today = new Date();
  const cells = [];

  for (let offset = 20; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const data = dayMap.get(key);
    let levelClass = '';

    if (data?.total) {
      if (data.resisted === data.total) levelClass = 'level-clean';
      else if (data.resisted > 0) levelClass = 'level-mixed';
      else levelClass = 'level-pressure';
    }

    cells.push(`
      <div class="heatmap-cell ${levelClass}" title="${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${data?.total ? ` · ${data.resisted}/${data.total} resisted` : ' · No log'}"></div>
    `);
  }

  container.innerHTML = cells.join('');
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
    container.innerHTML = '<p class="text-osa-muted text-sm">Complete your first day to see your patterns.</p>';
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
    kicker: 'Welcome',
    title: 'Welcome to Perfect Sand',
    text: 'Build unbreakable discipline. One urge at a time.',
    helper: 'Already have an account? Log in',
    btn: 'Start Your Journey',
    type: 'intro',
  },
  {
    kicker: 'Value Demo',
    title: 'Urges come. You stay in control.',
    text: 'Urge hits 🔥 → You open app → Battle Mode → You win ✅',
    helper: 'Osa + proven protocols help you win daily battles.',
    btn: 'See How It Works',
    type: 'demo',
  },
  {
    kicker: 'Personalization',
    title: 'What’s your biggest trigger?',
    text: null,
    helper: 'Choose one to continue.',
    btn: 'Continue',
    type: 'trigger',
  },
  {
    kicker: 'Quick Profile',
    title: 'Just a bit more…',
    text: null,
    helper: 'This stays private. Osa uses it to personalize.',
    btn: 'Save & Enter Dashboard',
    type: 'profile',
  },
];

let onboardStep = 0;

function initOnboarding() {
  if (localStorage.getItem('osa_onboarded') === 'true') return;
  setOnboardTrigger(localStorage.getItem('userTrigger') || '');
  const dobInput = document.getElementById('onboard-dob');
  if (dobInput && dobInput.dataset.bound !== 'true') {
    dobInput.addEventListener('input', calcOnboardAge);
    dobInput.dataset.bound = 'true';
  }
  const otherInput = document.getElementById('onboard-trigger-other');
  if (otherInput && otherInput.dataset.bound !== 'true') {
    otherInput.addEventListener('input', updateOnboardButtonState);
    otherInput.dataset.bound = 'true';
  }
  document.getElementById('onboarding').classList.remove('hidden');
  renderOnboardStep();
}

function renderOnboardStep() {
  const step = onboardSteps[onboardStep];
  const onboardingEl = document.getElementById('onboarding');
  document.getElementById('onboard-title').textContent = step.title;
  document.getElementById('onboard-btn').textContent = step.btn;
  document.getElementById('onboard-kicker').textContent = step.kicker;
  document.getElementById('onboard-helper').textContent = step.helper || '';
  onboardingEl.dataset.step = String(onboardStep);

  const textEl = document.getElementById('onboard-text');
  const setupEl = document.getElementById('onboard-setup');
  const profileEl = document.getElementById('onboard-profile');
  const loginLinkEl = document.getElementById('onboard-login-link');
  const skipEl = document.getElementById('onboard-skip');

  if (step.text) {
    textEl.textContent = step.text;
    textEl.classList.remove('hidden');
  } else {
    textEl.classList.add('hidden');
  }

  setupEl.classList.toggle('hidden', step.type !== 'trigger');
  profileEl.classList.toggle('hidden', step.type !== 'profile');
  loginLinkEl.classList.toggle('hidden', step.type !== 'intro');
  skipEl.classList.toggle('hidden', !(step.type === 'trigger' || step.type === 'profile'));

  if (step.type === 'trigger') {
    textEl.classList.add('hidden');
  } else {
    setupEl.classList.add('hidden');
  }

  if (step.type !== 'profile') {
    profileEl.classList.add('hidden');
  }

  // Progress dots
  document.querySelectorAll('.onboard-dot').forEach((dot, i) => {
    dot.classList.toggle('bg-osa-accent', i === onboardStep);
    dot.classList.toggle('bg-osa-border', i !== onboardStep);
  });

  updateOnboardButtonState();
}

function nextOnboard() {
  const step = onboardSteps[onboardStep];
  if (step.type === 'trigger' && !getOnboardTriggerValue()) {
    showToast('Choose your biggest trigger to continue.');
    return;
  }

  onboardStep++;
  if (onboardStep < onboardSteps.length) {
    renderOnboardStep();
  } else {
    finishOnboarding();
  }
}

function setOnboardTrigger(trigger) {
  const select = document.getElementById('onboard-trigger');
  const otherInput = document.getElementById('onboard-trigger-other');
  if (select) {
    select.value = trigger;
  }

  if (otherInput) {
    otherInput.classList.toggle('hidden', trigger !== 'Others');
  }

  document.querySelectorAll('[data-trigger-option]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.triggerOption === trigger);
  });

  updateOnboardButtonState();
}

function getOnboardTriggerValue() {
  const selected = document.getElementById('onboard-trigger')?.value || '';
  if (!selected) return '';
  if (selected !== 'Others') return selected;
  return document.getElementById('onboard-trigger-other')?.value.trim() || '';
}

function calcOnboardAge() {
  const input = document.getElementById('onboard-dob');
  const ageLabel = document.getElementById('onboard-age');
  if (!input || !ageLabel || !input.value) {
    if (ageLabel) ageLabel.textContent = 'You’re -- years old';
    return;
  }

  const dob = new Date(input.value);
  if (Number.isNaN(dob.getTime())) {
    ageLabel.textContent = 'You’re -- years old';
    return;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  ageLabel.textContent = `You’re ${Math.max(0, age)} years old`;
}

function updateOnboardButtonState() {
  const button = document.getElementById('onboard-btn');
  const step = onboardSteps[onboardStep];
  if (!button || !step) return;

  let disabled = false;
  if (step.type === 'trigger') {
    disabled = !getOnboardTriggerValue();
  }

  button.disabled = disabled;
  button.style.opacity = disabled ? '0.55' : '1';
}

function showAuthFromOnboarding() {
  const authScreen = document.getElementById('auth-screen');
  if (!authScreen || authScreen.classList.contains('hidden')) {
    showToast('You are already inside.');
    return;
  }

  document.getElementById('signup-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.remove('hidden');
}

async function saveOnboardingProfile() {
  const dobValue = document.getElementById('onboard-dob')?.value;
  if (!dobValue) return;

  localStorage.setItem('osa_onboard_dob', dobValue);
  calcOnboardAge();

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const dob = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }

    await supabaseClient
      .from('profiles')
      .upsert({
        user_id: user.id,
        date_of_birth: dobValue,
        age: Math.max(0, age),
      }, { onConflict: 'user_id' });
  } catch (error) {
    console.error('Unable to save onboarding profile:', error);
  }
}

async function finishOnboarding() {
  const trigger = getOnboardTriggerValue() || 'Others';
  localStorage.setItem('userTrigger', trigger);
  await saveOnboardingProfile();
  if (getTokens() < FREE_TOKEN_BALANCE) {
    saveTokens(FREE_TOKEN_BALANCE);
  }
  localStorage.setItem('osa_onboarded', 'true');
  document.getElementById('onboarding').classList.add('hidden');
  const { data: { user } } = await supabaseClient.auth.getUser();
  await renderUserProfileSummary(user);
  const displayName = getUserFirstName(null, user);
  fireConfetti({ origin: { y: 0.7 } });
  showToast(`Welcome, ${displayName}. Your first day starts now. You've got this.`);
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

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) { return; }

  const usingFreeCredit = getFreeChatCredits() > 0;
  if (!usingFreeCredit && !useToken()) return;

  isSending = true;
  appendMessage(text, 'user');
  input.value = '';
  setInputLocked(true);

  const loadingWrapper = appendMessage('Osa is thinking...', 'osa');
  loadingWrapper.querySelector('div').style.opacity = '0.5';

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const context = getLiveInterventionContext();
    const habitStats = getCachedHabitStats();
    const data = await postJson('/chat', {
      userId: user?.id,
      trigger: context.trigger,
      emotion: text || context.emotion,
      streak: habitStats?.current_streak || 0,
      controlRate: habitStats?.controlRate ?? null,
      plan: getUserPlan(),
      dailyStatus: getDailyStatus(),
    });
    loadingWrapper.remove();

    const reply = data.reply || data.message;
    if (reply) {
      appendMessage(reply, 'osa');
      if (usingFreeCredit) consumeFreeChatCredit();
      await playOsaAudio(data.audio, { force: false });
    } else throw new Error('no reply');
  } catch (error) {
    console.error('Unable to send message to Osa:', error);
    loadingWrapper.remove();
    if (!usingFreeCredit) saveTokens(getTokens() + 1);
    appendMessage(INTERVENTION_FALLBACK_MESSAGE, 'osa');
  } finally {
    isSending = false;
    setInputLocked(false);
    input.focus();
  }
}

function useQuickPrompt(text) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = text;
  input.focus();
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function fireConfetti({ origin = { y: 0.65 }, colors = ['#d4a017', '#00c853', '#f7cf62', '#ffffff', '#ffb19f'] } = {}) {
  if (typeof confetti !== 'function') return;
  confetti({ particleCount: 90, spread: 72, origin, colors, disableForReducedMotion: true });
  setTimeout(() => {
    confetti({ particleCount: 50, spread: 90, origin: { x: 0.1, y: 0.6 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 50, spread: 90, origin: { x: 0.9, y: 0.6 }, colors, disableForReducedMotion: true });
  }, 200);
}

// ─── Interactive Battle Steps ─────────────────────────────────────────────────

function markBattleStep(el) {
  el.classList.toggle('step-done');
  const allDone = [...el.closest('.space-y-3').querySelectorAll('.battle-step-card')]
    .every(card => card.classList.contains('step-done'));
  if (allDone) showToast('All steps complete. Hold the line.');
}

function toggleProtocolStep(el) {
  el.classList.toggle('protocol-done');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-osa-card border border-osa-border text-osa-text text-sm px-5 py-3 rounded-full shadow-xl z-50 transition-all duration-300 whitespace-nowrap';
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
  'You Did Not Break Today 🔥',
  'You held body. Respect.',
  'Legend move.',
  'Urge resisted. You’re getting stronger.',
];

function showDayReward({ source = 'auto' } = {}) {
  const stats = getStats();
  const missionCount = getMissionCount();
  const controlRate = stats.urges > 0 ? Math.round((stats.resisted / stats.urges) * 100) : 0;
  const resistedToday = document.getElementById('resisted-today-count')?.textContent || '0';

  // Award 5 bonus tokens
  if (localStorage.getItem(`osa_reward_tokens_${getTodayKey()}`) !== 'granted') {
    const newTokens = getTokens() + 5;
    saveTokens(newTokens);
    localStorage.setItem(`osa_reward_tokens_${getTodayKey()}`, 'granted');
  }

  // Flash green background + confetti
  document.body.style.background = 'radial-gradient(circle at center, #052e16, #0d0d0d)';
  setTimeout(() => { document.body.style.background = ''; }, 2000);
  setTimeout(() => fireConfetti({ origin: { y: 0.5 }, colors: ['#00c853', '#d4a017', '#f7cf62', '#8dffb3', '#ffffff'] }), 300);

  const popup = document.getElementById('reward-popup');
  document.getElementById('reward-message').textContent = 'You Did Not Break Today 🔥';
  document.getElementById('reward-resisted').textContent = resistedToday;
  document.getElementById('reward-routines').textContent = `${missionCount}/3`;
  document.getElementById('reward-control-level').textContent = `${controlRate}%`;
  popup.classList.remove('hidden');

  if (source === 'manual') {
    showToast('+5 tokens earned. You held body today!');
  }
}

function closeReward() {
  document.getElementById('reward-popup').classList.add('hidden');
  showTab('dashboard');
  // Reset for next day
  localStorage.setItem('dayStart', Date.now());
  localStorage.removeItem('rewardGiven');
  updateDayCountdown();
}

function showRewardShare() {
  const streak = getStreak();
  const modal = document.getElementById('share-modal');
  if (!modal) return;

  const shareText = `Day ${streak || 1} ✅ Perfect Sand\nYou held body today. Join me on Perfect Sand.`;
  document.getElementById('share-streak-label').textContent = `Day ${streak || 1} win`;
  document.getElementById('share-text-display').textContent = shareText;

  document.getElementById('share-copy-btn').onclick = () => {
    navigator.clipboard.writeText(shareText)
      .then(() => showToast('Copied. Share your win.'))
      .catch(() => showToast('Copy the text above manually.'));
  };

  document.getElementById('share-native-btn').onclick = () => {
    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
  };

  modal.classList.remove('hidden');
}

function rewardTalkToOsa() {
  addFreeChatCredit(1);
  closeReward();
  showTab('chat');
  showToast('One free Osa reply is ready.');
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

// ─── Habit Loop ───────────────────────────────────────────────────────────────

function renderHabitStats(stats) {
  const s = stats || getCachedHabitStats();
  if (!s) return;

  const streak = s.current_streak || 0;
  const longest = s.longest_streak || 0;
  const rate = s.controlRate != null ? s.controlRate : (
    s.urges > 0 ? Math.round((s.resisted / s.urges) * 100) : null
  );

  const streakEl = document.getElementById('habit-streak');
  const longestEl = document.getElementById('habit-longest');
  const statusEl = document.getElementById('habit-checkin-status');
  const headerEl = document.getElementById('streak-count');
  const heroStreakEl = document.getElementById('hero-streak-text');
  const meCurrentStreak = document.getElementById('me-current-streak');
  const meLongestStreak = document.getElementById('me-longest-streak');

  if (streakEl) streakEl.textContent = streak;
  if (longestEl) longestEl.textContent = longest;
  if (headerEl) headerEl.textContent = streak;
  if (heroStreakEl) heroStreakEl.textContent = streak;

  // Animate the streak flame — grows with streak level
  const flameEl = document.getElementById('streak-flame-emoji');
  if (flameEl) {
    flameEl.classList.toggle('streak-flame-active', streak >= 3);
    flameEl.classList.toggle('streak-flame-big', streak >= 7);
    flameEl.style.fontSize = streak >= 7 ? '1.4em' : streak >= 3 ? '1.15em' : '';
  }
  if (meCurrentStreak) meCurrentStreak.textContent = String(streak);
  if (meLongestStreak) meLongestStreak.textContent = String(longest);

  if (statusEl) {
    if (streak === 0) {
      statusEl.textContent = 'Complete your first day to see your patterns.';
      statusEl.className = 'text-xs text-osa-muted mt-3 text-center';
    } else if (streak >= 7) {
      statusEl.textContent = `${streak} day${streak === 1 ? '' : 's'} straight. You dey control.`;
      statusEl.className = 'text-xs text-osa-accent mt-3 text-center font-semibold';
    } else {
      statusEl.textContent = `${streak} day${streak === 1 ? '' : 's'} in. You’re getting stronger.`;
      statusEl.className = 'text-xs text-green-400 mt-3 text-center';
    }
  }

  // Update control level label to reflect real rate
  if (rate !== null) {
    const levelEl = document.getElementById('control-level');
    if (levelEl) {
      const level = getControlLevel(rate);
      levelEl.textContent = rate >= 70 ? 'Strong today 🔥' : 'You’re building momentum';
      levelEl.className = `mt-1 text-lg font-semibold ${level.color}`;
    }
  }

  void renderUserProfileSummary();
}

async function syncUserStats(userId, { resisted }) {
  if (!userId) return;

  const today = new Date().toISOString().split('T')[0];

  const { data: current } = await supabaseClient
    .from('user_stats')
    .select('current_streak, longest_streak, last_resisted_date')
    .eq('user_id', userId)
    .maybeSingle();

  let currentStreak = current?.current_streak || 0;
  let longestStreak = current?.longest_streak || 0;
  const lastResisted = current?.last_resisted_date || null;

  if (resisted) {
    if (!lastResisted) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round(
        (new Date(today) - new Date(lastResisted)) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 0) {
        // already counted today — no change
      } else if (diffDays === 1) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
    }
    longestStreak = Math.max(currentStreak, longestStreak);
  } else {
    currentStreak = 0;
  }

  const { error } = await supabaseClient
    .from('user_stats')
    .upsert({
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_resisted_date: resisted ? today : (lastResisted || null),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) throw error;
}

// ─── Daily Status ─────────────────────────────────────────────────────────────

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getDailyStatus() {
  const date = localStorage.getItem('osa_daily_status_date');
  if (date !== getTodayKey()) return 'unknown';
  return localStorage.getItem('osa_daily_status') || 'unknown';
}

function setDailyStatus(status) {
  localStorage.setItem('osa_daily_status', status);
  localStorage.setItem('osa_daily_status_date', getTodayKey());
}

async function saveDailyStatusRemote(userId, status) {
  try {
    await supabaseClient
      .from('user_stats')
      .upsert({
        user_id: userId,
        daily_status: status,
        daily_status_date: getTodayKey(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  } catch (e) {
    console.error('Unable to save daily status:', e);
  }
}

// ─── Morning Check-in ─────────────────────────────────────────────────────────

async function runMorningCheckin(userId) {
  try {
    const data = await postJson('/checkin', {
      userId,
      type: 'morning',
      plan: getUserPlan(),
    });

    showMorningBanner(data.message);
    if (data.audio) await playOsaAudio(data.audio, { force: true });
  } catch (e) {
    console.error('Morning check-in failed:', e);
    showMorningBanner('Check in. Stay sharp today.');
  }
}

function showMorningBanner(message) {
  const existing = document.getElementById('daily-checkin-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'daily-checkin-banner';
  banner.className = 'px-4 py-3 rounded-2xl bg-osa-card border border-osa-accent/30';
  banner.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1">
        <p class="text-osa-accent text-[11px] font-bold uppercase tracking-[0.3em] mb-1">OSA — Morning</p>
        <p class="text-osa-text text-sm leading-relaxed">"${message}"</p>
      </div>
      <button onclick="dismissDailyCheckin()" class="text-osa-muted hover:text-osa-text transition-colors text-lg leading-none mt-0.5">✕</button>
    </div>`;
  placeBanner(banner);
}

function dismissDailyCheckin() {
  document.getElementById('daily-checkin-banner')?.remove();
}

// ─── Night Reflection ─────────────────────────────────────────────────────────

function shouldShowNightReflection() {
  const hour = new Date().getHours();
  if (hour < 20) return false; // before 8pm
  const reflected = localStorage.getItem('osa_night_reflected');
  return reflected !== getTodayKey();
}

function showNightReflection() {
  const modal = document.getElementById('night-reflection-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

function closeNightReflection() {
  document.getElementById('night-reflection-modal')?.classList.add('hidden');
  localStorage.setItem('osa_night_reflected', getTodayKey());
}

async function submitNightReflection(status) {
  localStorage.setItem('osa_night_reflected', getTodayKey());
  setDailyStatus(status);

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) saveDailyStatusRemote(user.id, status);

  closeNightReflection();

  const type = status === 'controlled' ? 'night_controlled' : 'night_slipped';
  try {
    const data = await postJson('/checkin', {
      userId: user?.id,
      type,
      plan: getUserPlan(),
    });
    if (data.message) showToast(data.message);
    if (data.audio) await playOsaAudio(data.audio, { force: true });
  } catch (e) {
    const fallback = status === 'controlled' ? 'Good. You held it.' : 'It happened. Come back stronger.';
    showToast(fallback);
  }

  await renderStats();
}

// ─── Daily Engagement Entry Point ─────────────────────────────────────────────

async function checkDailyEngagement(userId) {
  const today = getTodayKey();
  const lastSeen = localStorage.getItem('osa_last_seen');
  const isNewDay = lastSeen !== today;

  if (isNewDay) {
    localStorage.setItem('osa_last_seen', today);
    try {
      await supabaseClient
        .from('user_stats')
        .upsert({ user_id: userId, last_seen_date: today, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Unable to update last_seen_date:', e);
    }
    // Morning check-in (slight delay so UI renders first)
    setTimeout(() => runMorningCheckin(userId), 800);
  }

  // Night reflection check (any open, not just new day)
  if (shouldShowNightReflection()) {
    setTimeout(() => showNightReflection(), isNewDay ? 4000 : 1200);
  }
}

// ─── Passive Presence ("Don't drift.") ───────────────────────────────────────

function initPassivePresence() {
  const IDLE_MS = 2 * 60 * 1000; // 2 minutes
  let passiveTimer = null;

  const resetPassive = () => {
    clearTimeout(passiveTimer);
    passiveTimer = setTimeout(() => {
      if (document.body.classList.contains('intervention-active')) return;
      if (document.hidden) return;
      showToast("Don't drift.");
    }, IDLE_MS);
  };

  ['click', 'touchstart', 'keydown', 'scroll'].forEach(ev => {
    document.addEventListener(ev, resetPassive, { passive: true });
  });

  resetPassive();
}

// ─── Plan System ─────────────────────────────────────────────────────────────

let _userPlan = null;

function getUserPlan() {
  if (_userPlan) return _userPlan;
  return localStorage.getItem('osa_user_plan') || 'free';
}

function isPremium() {
  return getUserPlan() === 'premium';
}

function setUserPlanCache(plan) {
  _userPlan = plan;
  localStorage.setItem('osa_user_plan', plan);
}

async function loadUserPlan(userId) {
  try {
    const { data } = await supabaseClient
      .from('user_stats')
      .select('user_plan')
      .eq('user_id', userId)
      .maybeSingle();

    const plan = data?.user_plan || 'free';
    setUserPlanCache(plan);
    applyPlanGating();
    return plan;
  } catch (e) {
    console.error('Unable to load user plan:', e);
    return getUserPlan();
  }
}

async function activatePremium() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  try {
    await supabaseClient
      .from('user_stats')
      .upsert({ user_id: user.id, user_plan: 'premium', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } catch (e) {
    console.error('Unable to save premium plan:', e);
  }

  setUserPlanCache('premium');
  applyPlanGating();
  closeUpgradeModal();
  showToast('Full Control unlocked. Strict mode is now active.');
  runPredictiveCheck(user.id, { force: true });
}

function applyPlanGating() {
  const premium = isPremium();

  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) upgradeBtn.classList.toggle('hidden', premium);

  const premiumBadge = document.getElementById('premium-badge');
  if (premiumBadge) premiumBadge.classList.toggle('hidden', !premium);

  const aiBtn = document.getElementById('ai-insights-btn');
  if (aiBtn) aiBtn.textContent = premium ? 'Ask Osa' : 'Ask Osa ✦';
}

function showUpgradeModal() {
  syncTokenDisplays();
  document.getElementById('upgrade-modal')?.classList.remove('hidden');
}

function closeUpgradeModal() {
  document.getElementById('upgrade-modal')?.classList.add('hidden');
}

// ─── Viral Share ──────────────────────────────────────────────────────────────

function getShareText(streak) {
  return `I've stayed in control for ${streak} day${streak === 1 ? '' : 's'} using Perfect Sand. This app hits different. Try it: perfectsand.app`;
}

function exportMyProgress() {
  const stats = getCachedHabitStats() || getStats();
  const streak = getStreak();
  const text = `Perfect Sand Progress\nCurrent Streak: ${streak} day${streak === 1 ? '' : 's'}\nLongest Streak: ${stats.longest_streak || streak}\nTotal Urges Resisted: ${stats.resisted || 0}`;

  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => showToast('Progress copied.'))
    .catch(() => showToast('Unable to export right now.'));
}

function checkShareMoment(stats) {
  const streak = stats?.current_streak || getCachedHabitStats()?.current_streak || 0;
  if (streak < 3) return;
  const key = `osa_share_shown_${streak}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  setTimeout(() => showStreakSharePopup(streak), 1400);
}

function showStreakSharePopup(streak) {
  const modal = document.getElementById('share-modal');
  if (!modal) return;

  const text = getShareText(streak);
  document.getElementById('share-streak-label').textContent = `${streak}-day streak`;
  document.getElementById('share-text-display').textContent = text;

  document.getElementById('share-copy-btn').onclick = () => {
    navigator.clipboard.writeText(text)
      .then(() => { showToast('Copied. Share it.'); })
      .catch(() => { showToast('Copy the text above manually.'); });
  };

  document.getElementById('share-native-btn').onclick = () => {
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied to clipboard.'))
        .catch(() => {});
    }
  };

  modal.classList.remove('hidden');
}

function closeShareModal() {
  document.getElementById('share-modal')?.classList.add('hidden');
}

// ─── Predictive Intervention ──────────────────────────────────────────────────

const PREDICT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between auto-checks

function getIgnoredWarnings() {
  return parseInt(localStorage.getItem('osa_ignored_warnings') || '0');
}

function incrementIgnoredWarnings() {
  localStorage.setItem('osa_ignored_warnings', getIgnoredWarnings() + 1);
}

function resetIgnoredWarnings() {
  localStorage.removeItem('osa_ignored_warnings');
}

function getLastPredictTime() {
  return parseInt(localStorage.getItem('osa_last_predict') || '0');
}

function setLastPredictTime() {
  localStorage.setItem('osa_last_predict', Date.now());
}

function showPredictiveAlert(message, audio, pattern) {
  const existing = document.getElementById('predictive-alert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.id = 'predictive-alert';
  alert.className = 'rounded-2xl border border-red-800/60 bg-red-950/30 p-4';
  alert.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1">
        <p class="text-red-400 text-[11px] font-bold uppercase tracking-[0.3em] mb-1.5">High-Risk Window</p>
        <p id="predict-message" class="text-white text-sm leading-relaxed font-medium">${message}</p>
        ${pattern ? `<p class="text-red-900 text-xs mt-2 leading-relaxed">Trigger: ${pattern.commonTrigger} · Weak time: ${pattern.highRiskTime || '?'} · Control: ${pattern.controlRate}%</p>` : ''}
      </div>
      <button onclick="dismissPredictiveAlert()" class="text-red-800 hover:text-red-500 transition-colors text-lg leading-none mt-0.5">✕</button>
    </div>
    <button onclick="startBattleMode(); dismissPredictiveAlert();"
      class="mt-3 w-full py-2.5 rounded-xl bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-bold tracking-widest uppercase hover:bg-red-900/60 transition-all active:scale-95">
      Enter Battle Mode Now
    </button>`;
  placeBanner(alert);

  // Auto-play voice
  if (audio) {
    playOsaAudio(audio, { force: true }).catch(() => {});
  }
}

function dismissPredictiveAlert() {
  document.getElementById('predictive-alert')?.remove();
  incrementIgnoredWarnings();
}

async function runPredictiveCheck(userId, { force = false } = {}) {
  if (!userId) return;
  if (!isPremium()) return; // predictive alerts are premium only

  // Throttle: only check once per hour unless forced
  if (!force && Date.now() - getLastPredictTime() < PREDICT_COOLDOWN_MS) return;
  setLastPredictTime();

  // Don't interrupt an active intervention
  if (document.body.classList.contains('intervention-active')) return;

  try {
    const data = await postJson('/predict', {
      userId,
      currentHour: new Date().getHours(),
      ignoreCount: getIgnoredWarnings(),
      plan: getUserPlan(),
    });

    if (data?.warning && data?.message) {
      showPredictiveAlert(data.message, data.audio, data.pattern);
    }
  } catch (error) {
    console.error('Predictive check failed:', error.message);
  }
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
  if (!isTrialActive()) {
    document.getElementById('trial-banner')?.remove();
    return;
  }
  const daysLeft = getTrialDaysLeft();
  if (daysLeft > 7) {
    document.getElementById('trial-banner')?.remove();
    return;
  }
  const existing = document.getElementById('trial-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'trial-banner';
  banner.className = 'px-4 py-2.5 rounded-xl bg-yellow-950/40 border border-yellow-800/40 flex items-center justify-between';
  banner.innerHTML = `
    <span class="text-yellow-400 text-xs">${daysLeft === 0 ? 'Free access ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} of free access left`}</span>
    <button onclick="showToast('Payment coming soon.')" class="text-yellow-400 text-xs font-bold underline underline-offset-2">Upgrade</button>`;
  placeBanner(banner);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initAuth();
});
