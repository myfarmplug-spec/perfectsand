// ─── Urge Journal ─────────────────────────────────────────────────────────────

function getUrgeLog() {
  return JSON.parse(localStorage.getItem('urgeLog')) || [];
}

function saveUrgeLog(log) {
  localStorage.setItem('urgeLog', JSON.stringify(log));
}

// Active urge being built across the 3-step flow
let currentUrge = {
  trigger: null,
  emotion: null,
  action: null,
  startTime: null,
  resisted: false,
};

// ─── Chip Selection UI ────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const group = chip.dataset.group;

  document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('chip-active'));
  chip.classList.add('chip-active');

  if (group === 'trigger') {
    currentUrge.trigger = chip.dataset.val;
    showToast(`Trigger: ${chip.dataset.val}`);
    revealFormStep('step-emotion');
  }
  if (group === 'emotion') {
    currentUrge.emotion = chip.dataset.val;
    revealFormStep('step-cta');
  }
  if (group === 'action') {
    currentUrge.action = chip.dataset.val;
  }
});

function revealFormStep(id) {
  const el = document.getElementById(id);
  if (!el || !el.classList.contains('hidden')) return;
  el.classList.remove('hidden');
  el.classList.add('form-step-enter');
  setTimeout(() => el.classList.remove('form-step-enter'), 400);
  // Scroll the form down to show the new section
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

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

function renderStats() {
  const s = getStats();
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

const urgeMessages = [
  'This will pass.',
  'Breathe and stay grounded.',
  'Stand up and move.',
  'You are stronger than this moment.',
  "Feel it. Don't act on it.",
  'Let the urge rise and fall like a wave.',
  'Your future self is watching.',
  'One minute at a time.',
];

let urgeInterval = null;
let messageInterval = null;
let urgeSeconds = 600;

function formatTime(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

let urgeFormCountdownInterval = null;

function closeUrgeForm() {
  document.getElementById('urge-form').classList.add('hidden');
  clearInterval(urgeFormCountdownInterval);
}

// Step 1: Open form overlay
function openUrgeForm() {
  currentUrge = { trigger: null, emotion: null, action: null, startTime: null, resisted: false };
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));

  // Reset steps
  document.getElementById('step-emotion').classList.add('hidden');
  document.getElementById('step-cta').classList.add('hidden');
  document.getElementById('urge-form').classList.remove('hidden');

  // Live countdown in form header
  const updateFormCountdown = () => {
    const remaining = getRemainingTime();
    const el = document.getElementById('urge-form-countdown');
    if (el) el.textContent = remaining ? `${remaining} left today` : 'Today is almost won';
  };
  updateFormCountdown();
  clearInterval(urgeFormCountdownInterval);
  urgeFormCountdownInterval = setInterval(updateFormCountdown, 1000);
}

// Step 2: Form submitted → start timer
function submitUrgeForm() {
  if (!currentUrge.trigger) { showToast('Select a trigger first.'); return; }
  if (!currentUrge.emotion) { showToast('Select how you feel.'); return; }

  clearInterval(urgeFormCountdownInterval);
  document.getElementById('urge-form').classList.add('hidden');

  // Track stats
  const s = getStats();
  s.urges += 1;
  saveStats(s);
  renderStats();
  setState('Under Pressure');
  setBattleMode(true);

  // Set start time
  currentUrge.startTime = Date.now();

  // Start timer
  urgeSeconds = 600;
  document.getElementById('urge-timer').textContent = formatTime(urgeSeconds);
  document.getElementById('urge-message').textContent = urgeMessages[0];
  document.getElementById('urge-mode').classList.remove('hidden');

  let msgIndex = 0;
  urgeInterval = setInterval(() => {
    urgeSeconds--;
    document.getElementById('urge-timer').textContent = formatTime(urgeSeconds);
    if (urgeSeconds <= 0) stopUrgeMode(true);
  }, 1000);

  messageInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % urgeMessages.length;
    const el = document.getElementById('urge-message');
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = urgeMessages[msgIndex]; el.style.opacity = '1'; }, 400);
  }, 15000);
}

// Step 3: Timer stopped
function stopUrgeMode(resisted = false) {
  clearInterval(urgeInterval);
  clearInterval(messageInterval);
  urgeInterval = null;
  messageInterval = null;
  document.getElementById('urge-mode').classList.add('hidden');
  setBattleMode(false);

  currentUrge.resisted = resisted;
  currentUrge.duration = Math.round((Date.now() - (currentUrge.startTime || Date.now())) / 1000);

  if (resisted) {
    const s = getStats();
    s.resisted += 1;
    saveStats(s);
    renderStats();
    setState('In Control');
    showToast('You resisted. You are building yourself.');
    document.querySelectorAll('.chip[data-group="action"]').forEach(c => c.classList.remove('chip-active'));
    document.getElementById('urge-action').classList.remove('hidden');
  } else {
    setState('Recovering');
    finaliseUrgeEntry('Left the situation');
  }
}

// Step 4: Save action and complete entry
function saveUrgeEntry() {
  const action = currentUrge.action || 'Breathed through it';
  document.getElementById('urge-action').classList.add('hidden');
  finaliseUrgeEntry(action);
  showToast('Entry saved. You got through it.');
}

function finaliseUrgeEntry(action) {
  const log = getUrgeLog();
  log.push({
    time: new Date().toISOString(),
    trigger: currentUrge.trigger || 'Unknown',
    emotion: currentUrge.emotion || 'Unknown',
    duration: currentUrge.duration || 0,
    action,
    resisted: currentUrge.resisted,
  });
  saveUrgeLog(log);
}

// ─── History Rendering ────────────────────────────────────────────────────────

function renderHistory() {
  const container = document.getElementById('history-list');
  const emptyMsg = document.getElementById('history-empty');
  const log = getUrgeLog();

  if (log.length === 0) {
    emptyMsg.classList.remove('hidden');
    container.innerHTML = '';
    container.appendChild(emptyMsg);
    return;
  }

  emptyMsg.classList.add('hidden');
  const entries = [...log].reverse();

  // Group by date
  const groups = {};
  entries.forEach(entry => {
    const d = new Date(entry.time);
    const label = getDateLabel(d);
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  });

  container.innerHTML = '';
  Object.entries(groups).forEach(([label, items]) => {
    const groupEl = document.createElement('div');
    groupEl.innerHTML = `<p class="text-osa-muted text-xs uppercase tracking-widest mb-2">${label}</p>`;

    items.forEach(entry => {
      const d = new Date(entry.time);
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const mins = Math.round(entry.duration / 60);
      const durationLabel = mins < 1 ? `${entry.duration}s` : `${mins}m`;
      const resistedColor = entry.resisted ? 'text-green-400' : 'text-red-400';
      const resistedLabel = entry.resisted ? 'Resisted' : 'Left';

      const card = document.createElement('div');
      card.className = 'bg-osa-card border border-osa-border rounded-2xl p-4 mb-2 text-sm';
      card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="text-osa-muted text-xs">${time}</span>
          <span class="text-xs font-semibold ${resistedColor}">${resistedLabel}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><span class="text-osa-muted">Trigger </span><span class="text-osa-text">${entry.trigger}</span></div>
          <div><span class="text-osa-muted">Emotion </span><span class="text-osa-text">${entry.emotion}</span></div>
          <div><span class="text-osa-muted">Duration </span><span class="text-osa-text">${durationLabel}</span></div>
          <div><span class="text-osa-muted">Action </span><span class="text-osa-text">${entry.action}</span></div>
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

function clearHistory() {
  if (!confirm('Clear all journal entries? This cannot be undone.')) return;
  localStorage.removeItem('urgeLog');
  renderHistory();
  renderInsights();
  showToast('Journal cleared.');
}

// ─── Insights ────────────────────────────────────────────────────────────────

function renderInsights() {
  const log = getUrgeLog();
  const container = document.getElementById('insights-content');
  const stats = getStats();

  if (log.length < 2) {
    container.innerHTML = '<p class="text-osa-muted text-xs">Log a few urges to see your patterns.</p>';
    return;
  }

  // Count triggers
  const triggers = {};
  log.forEach(e => { triggers[e.trigger] = (triggers[e.trigger] || 0) + 1; });
  const topTrigger = Object.entries(triggers).sort((a, b) => b[1] - a[1])[0][0];

  // Count hour buckets
  const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  log.forEach(e => {
    const h = new Date(e.time).getHours();
    if (h >= 5 && h < 12) buckets.Morning++;
    else if (h >= 12 && h < 17) buckets.Afternoon++;
    else if (h >= 17 && h < 22) buckets.Evening++;
    else buckets.Night++;
  });
  const peakTime = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0];

  // Control rate
  const rate = stats.urges > 0 ? Math.round((stats.resisted / stats.urges) * 100) : 0;

  // Avg duration
  const avgDuration = Math.round(log.reduce((sum, e) => sum + (e.duration || 0), 0) / log.length / 60);

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
        <p class="text-osa-muted mb-1">Avg duration</p>
        <p class="text-osa-text font-semibold">${avgDuration}m</p>
      </div>
    </div>
    <p class="text-osa-muted text-xs mt-3">Based on ${log.length} logged urge${log.length === 1 ? '' : 's'}.</p>`;
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

async function generateAIInsights() {
  const log = getUrgeLog();
  if (log.length === 0) { showToast('Log some urges first.'); return; }

  const btn = document.getElementById('ai-insights-btn');
  btn.textContent = 'Analysing...';
  btn.disabled = true;

  try {
    const res = await fetch('https://perfectsand.onrender.com/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: log }),
    });
    const data = await res.json();
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
    bubble.innerHTML = `<span class="block text-osa-accent text-xs font-semibold mb-1 tracking-wide uppercase">Osa</span>${text}`;
  }

  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
  return wrapper;
}

function setInputLocked(locked) {
  const input = document.getElementById('chat-input');
  const btn = document.querySelector('[onclick="sendMessage()"]');
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
    const res = await fetch('https://perfectsand.onrender.com/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    loadingWrapper.remove();

    if (data.reply) {
      appendMessage(data.reply, 'osa');
      if (document.getElementById('voiceToggle').checked) speak(data.reply);
    } else throw new Error('no reply');
  } catch {
    loadingWrapper.remove();
    const fallback = [
      'Stay grounded. This will pass.',
      "You are in control. Don't give in.",
      'Stand up. Change your environment now.',
    ];
    const reply = fallback[Math.floor(Math.random() * fallback.length)];
    appendMessage(reply, 'osa');
    if (document.getElementById('voiceToggle').checked) speak(reply);
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
});
