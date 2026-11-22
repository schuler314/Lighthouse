// =========================================================================
// LIGHTHOUSE — SHARED ENGINE, ROUTER, APP SHELL, AUTO-SYNC GCAL & PDF STUDIO
// =========================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  STORAGE_KEY,
  SUPABASE_CONFIG,
  LEGACY_MOCK_GCAL_IDS,
  NAV_STATIONS,
  INITIAL_STATE,
  MORNING_LIBRARY,
  NIGHT_LIBRARY,
  JESUS_PRAYER_THEMES,
  TODAY_ISO,
  getLocalIsoDate,
  getDayOffsetFromIsoDate
} from './data.js';

// =========================================================================
// SUPABASE CLIENT, GCAL SESSION STORAGE & SHARED STATE
// =========================================================================
const GCAL_SESSION_KEY = 'lighthouse_gcal_session_v1';

const supabaseClient =
  SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey
    ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { db: { schema: SUPABASE_CONFIG.schema } })
    : null;

const LEGACY_MOCK_SET = new Set(LEGACY_MOCK_GCAL_IDS);
let stateMigratedOnLoad = false;

export const state = loadLocalState();

let currentPage = 'index.html';
let currentDefaultTab = 'calendar';
let pageRenderers = {};
let supabaseSyncTimeout = null;
let autoSyncTimerId = null;
let gcalSyncInFlight = false;
let shellMounted = false;
let lastRenderedIsoDate = getLocalIsoDate(0);

// =========================================================================
// CLIENT-SIDE GCAL SESSION HELPERS (PERSISTS ACROSS ALL 3 HTML PAGES)
// =========================================================================
function readGcalSession() {
  try {
    const raw = sessionStorage.getItem(GCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(GCAL_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeGcalSession(token, expiresInSec = 3500, lastFetchedAt = Date.now()) {
  try {
    // 60-second buffer before Google's hard 1-hour expiry
    const expiresAt = Date.now() + Math.max(60, Number(expiresInSec) - 60) * 1000;
    sessionStorage.setItem(
      GCAL_SESSION_KEY,
      JSON.stringify({ token, expiresAt, lastFetchedAt })
    );
  } catch {
    // Ignore sessionStorage restrictions
  }
}

function touchGcalSessionFetchTime() {
  const cur = readGcalSession();
  if (!cur) return;
  try {
    sessionStorage.setItem(
      GCAL_SESSION_KEY,
      JSON.stringify({ ...cur, lastFetchedAt: Date.now() })
    );
  } catch {
    // Ignore
  }
}

function clearGcalSession() {
  try {
    sessionStorage.removeItem(GCAL_SESSION_KEY);
  } catch {
    // Ignore
  }
}

export function getGcalSessionStatus() {
  const sess = readGcalSession();
  const autoEnabled = state.settings.gcalAutoSyncEnabled !== false;
  const intervalMins = Number(state.settings.gcalAutoSyncMins) || 15;
  const expiresInMins = sess ? Math.max(1, Math.ceil((sess.expiresAt - Date.now()) / 60000)) : 0;
  return {
    hasToken: Boolean(sess),
    expiresInMins,
    lastFetchedAt: sess?.lastFetchedAt || 0,
    syncing: gcalSyncInFlight,
    autoEnabled,
    intervalMins,
    lastSyncLabel: state.settings.lastGcalSync || 'Not synced yet'
  };
}

// =========================================================================
// STATE MIGRATION & NORMALIZATION
// =========================================================================
function sanitizeGcalEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return { events: [], changed: false };
  const cleaned = rawEvents.filter((ev) => {
    if (!ev || !ev.id) return false;
    if (LEGACY_MOCK_SET.has(ev.id)) return false;
    if (!ev.dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(ev.dateStr)) return false;
    return true;
  });
  return { events: cleaned, changed: cleaned.length !== rawEvents.length };
}

function normalizeProListItem(item) {
  return {
    id: item.id || `li-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    text: item.text || '',
    assignedTo: item.assignedTo || 'Dan',
    completed: Boolean(item.completed),
    priority: ['p1', 'p2', 'p3', 'p4'].includes(item.priority) ? item.priority : 'p3',
    dueDate: item.dueDate || '',
    scheduledDate: item.scheduledDate || '',
    scheduledTime: item.scheduledTime || '15:00',
    durationMins: Number(item.durationMins) || 30,
    recurrence: item.recurrence || 'none',
    tags: Array.isArray(item.tags) ? item.tags : [],
    notes: item.notes || '',
    subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
    watchBlockId: item.watchBlockId || null
  };
}

function normalizePlanBlock(block) {
  if (block.sourceType && block.sourceId) return block;
  // Backfill sourceType/sourceId for older saved Morning/Night routine blocks so two-way deletion works
  const mMatch = MORNING_LIBRARY.find((c) => c.title === block.title);
  if (mMatch) {
    return { ...block, sourceType: 'morning', sourceId: mMatch.id };
  }
  const nMatch = NIGHT_LIBRARY.find((c) => c.title === block.title);
  if (nMatch) {
    return { ...block, sourceType: 'night', sourceId: nMatch.id };
  }
  return block;
}

function buildMergedState(parsed) {
  const hasLegacySites = (parsed.codedSites || []).some((s) => (s.url || '').includes('example.com'));
  const mergedSettings = {
    ...INITIAL_STATE.settings,
    ...(parsed.settings || {})
  };
  if (!mergedSettings.gcalClientId || !mergedSettings.gcalClientId.trim()) {
    mergedSettings.gcalClientId = INITIAL_STATE.settings.gcalClientId;
  }
  if (parsed.settings?.hideShortSoloEvents === true && !parsed.settings?.soloEventsRuleMigrated) {
    mergedSettings.hideShortSoloEvents = false;
    mergedSettings.soloEventsRuleMigrated = true;
  }
  if (mergedSettings.gcalAutoSyncEnabled === undefined) {
    mergedSettings.gcalAutoSyncEnabled = true;
  }
  if (!mergedSettings.gcalAutoSyncMins) {
    mergedSettings.gcalAutoSyncMins = 15;
  }

  const { events: cleanGcalEvents, changed: gcalPurged } = sanitizeGcalEvents(parsed.gcalEvents);
  if (gcalPurged) {
    stateMigratedOnLoad = true;
  }
  if (mergedSettings.lastGcalSync === 'Nov 2026 Snapshot') {
    mergedSettings.lastGcalSync = 'Not synced yet';
    mergedSettings.lastCalendarSummary = [];
    stateMigratedOnLoad = true;
  }

  const normalizedLists = Array.isArray(parsed.lists)
    ? parsed.lists.map((board) => ({
        ...board,
        items: Array.isArray(board.items) ? board.items.map(normalizeProListItem) : []
      }))
    : structuredClone(INITIAL_STATE.lists);

  const normalizedBlocks = Array.isArray(parsed.planBlocks)
    ? parsed.planBlocks.map(normalizePlanBlock)
    : structuredClone(INITIAL_STATE.planBlocks);

  return {
    ...structuredClone(INITIAL_STATE),
    ...parsed,
    gcalEvents: cleanGcalEvents,
    lists: normalizedLists,
    planBlocks: normalizedBlocks,
    workouts: Array.isArray(parsed.workouts) ? parsed.workouts : structuredClone(INITIAL_STATE.workouts),
    dailyHistory:
      parsed.dailyHistory && typeof parsed.dailyHistory === 'object'
        ? parsed.dailyHistory
        : structuredClone(INITIAL_STATE.dailyHistory),
    backtrackDate: parsed.backtrackDate || TODAY_ISO,
    codedSites: hasLegacySites
      ? structuredClone(INITIAL_STATE.codedSites)
      : parsed.codedSites || structuredClone(INITIAL_STATE.codedSites),
    settings: mergedSettings,
    pdfConfig: { ...structuredClone(INITIAL_STATE.pdfConfig), ...(parsed.pdfConfig || {}) }
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(INITIAL_STATE);
    return buildMergedState(JSON.parse(raw));
  } catch {
    return structuredClone(INITIAL_STATE);
  }
}

export function ensureDailyLog(dateStr) {
  const target = dateStr || getLocalIsoDate(0);
  if (!state.dailyHistory) state.dailyHistory = {};
  if (!state.dailyHistory[target]) {
    state.dailyHistory[target] = {
      prayerDone: false,
      nightDone: false,
      morningDone: false,
      todos: []
    };
  }
  return state.dailyHistory[target];
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }

  // Silent, debounced background sync with Supabase "Lighthouse" schema
  if (supabaseClient) {
    clearTimeout(supabaseSyncTimeout);
    supabaseSyncTimeout = setTimeout(async () => {
      const ts = new Date().toISOString();
      try {
        await supabaseClient.from('app_state').upsert({
          id: 'primary_keeper',
          theme_id: state.settings.theme || 'nordic',
          active_morning_board: state.morningBoardIds || [],
          active_night_board: state.nightBoardIds || [],
          active_prayer_board: (state.prayerCards || []).filter((c) => c.onActiveBoard).map((c) => c.id),
          state_payload: state,
          updated_at: ts
        });
      } catch {
        // Fallback to sync_vault if app_state table isn't used
      }
      try {
        await supabaseClient.from('sync_vault').upsert({
          vault_id: 'primary_keeper_vault',
          keeper_name: state.settings.userName || 'Dan',
          state_payload: state,
          updated_at: ts
        });
      } catch {
        // Silent ignore when offline
      }
    }, 900);
  }
}

async function hydrateFromSupabaseOnLoad() {
  if (!supabaseClient) return;
  try {
    const { data } = await supabaseClient
      .from('sync_vault')
      .select('state_payload, updated_at')
      .eq('vault_id', 'primary_keeper_vault')
      .maybeSingle();
    if (data?.state_payload && typeof data.state_payload === 'object') {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (!localRaw) {
        const merged = buildMergedState(data.state_payload);
        merged.activeTab = state.activeTab;
        Object.assign(state, merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (stateMigratedOnLoad) saveState();
        renderApp();
      }
    }
  } catch {
    // Silent fallback to localStorage
  }
}

// =========================================================================
// SHARED UTILITIES
// =========================================================================
export function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId || 'nordic');
}

export function showToast(msg) {
  const box = document.getElementById('toast-container');
  const txt = document.getElementById('toast-msg');
  if (!box || !txt) return;
  txt.textContent = msg;
  box.classList.remove('hidden');
  clearTimeout(window.__lhToastTimer);
  window.__lhToastTimer = setTimeout(() => box.classList.add('hidden'), 3000);
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getEventDayOffset(ev) {
  if (!ev || !ev.dateStr) return null;
  return getDayOffsetFromIsoDate(ev.dateStr);
}

export function isEventMuted(ev) {
  if (!state.settings.wifeFilterEnabled) return false;
  const calLower = (ev.calendar || '').toLowerCase();
  const isWife = calLower.includes('wife') || calLower.includes('regla');
  if (!isWife) return false;
  const titleLower = (ev.title || '').toLowerCase();
  return (state.settings.wifeFilterKeywords || []).some((kw) => kw && titleLower.includes(kw.toLowerCase()));
}

export function openDetailModal({ category, title, meta, bodyHtml, actionsHtml }) {
  const catEl = document.getElementById('detail-modal-category');
  const titleEl = document.getElementById('detail-modal-title');
  const metaEl = document.getElementById('detail-modal-meta');
  const bodyEl = document.getElementById('detail-modal-body');
  const actionsEl = document.getElementById('detail-modal-actions');
  const modal = document.getElementById('detail-modal');
  if (!modal) return;

  if (catEl) catEl.textContent = category || '';
  if (titleEl) titleEl.textContent = title || '';
  if (metaEl) metaEl.textContent = meta || '';
  if (bodyEl) bodyEl.innerHTML = bodyHtml || '';
  if (actionsEl) actionsEl.innerHTML = actionsHtml || '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  if (window.lucide) window.lucide.createIcons();
}

export function closeDetailModal() {
  const modal = document.getElementById('detail-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// =========================================================================
// SHARED APP SHELL INJECTION (IDENTICAL ACROSS ALL 3 HTML PAGES)
// =========================================================================
function mountAppShell() {
  if (shellMounted) return;
  shellMounted = true;

  const shellHtml = `
    <!-- DEDICATED NATIVE PRINT MOUNT (HIDDEN ON SCREEN, ACTIVE ON @MEDIA PRINT) -->
    <div id="print-mount"></div>

    <!-- TOAST FEEDBACK -->
    <div id="toast-container" class="fixed bottom-20 left-4 right-4 md:left-auto md:bottom-6 md:right-6 z-50 hidden">
      <div class="lh-surface shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 border-l-4" style="border-left-color: var(--accent-primary);">
        <i data-lucide="compass" class="w-4 h-4 shrink-0" style="color: var(--accent-primary);"></i>
        <span id="toast-msg" class="text-xs sm:text-sm font-medium lh-text-main"></span>
      </div>
    </div>

    <!-- UNIVERSAL CARD DETAIL MODAL (PROGRESSIVE DISCLOSURE) -->
    <div id="detail-modal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="lh-surface rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto space-y-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3 pb-3 border-b lh-border">
          <div>
            <span id="detail-modal-category" class="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full lh-badge"></span>
            <h3 id="detail-modal-title" class="text-lg sm:text-xl font-bold lh-text-main mt-2"></h3>
            <p id="detail-modal-meta" class="text-xs lh-text-sec mt-0.5 font-mono-code"></p>
          </div>
          <button onclick="window.Lighthouse.closeDetailModal()" class="p-2 rounded-xl lh-elevated lh-text-sec hover:opacity-80">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div id="detail-modal-body" class="space-y-3.5 text-sm leading-relaxed"></div>
        <div id="detail-modal-actions" class="pt-3 border-t lh-border flex flex-wrap gap-2"></div>
      </div>
    </div>

    <!-- GOOGLE CALENDAR SYNC MODAL -->
    <div id="gcal-modal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="lh-surface rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b lh-border pb-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-xl lh-badge">
              <i data-lucide="calendar" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-bold text-base lh-text-main">Google Calendar Sync</h3>
              <p class="text-xs lh-text-sec">Live OAuth 2.0 + Session Auto-Sync (Primary, Family &amp; Regla)</p>
            </div>
          </div>
          <button onclick="window.Lighthouse.closeGcalModal()" class="p-2 rounded-xl lh-elevated lh-text-sec">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="p-4 rounded-2xl lh-elevated space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--accent-primary);">Option 1: Live Google OAuth</span>
            <span id="gcal-token-badge" class="text-[11px] px-2 py-0.5 rounded-full lh-badge-sec font-medium">Client ID Pre-Loaded</span>
          </div>
          <p class="text-xs lh-text-sec leading-relaxed">
            Pulls real dated events (next 14 days) from your Primary (<code>schuler314</code>), Family, and Regla's shared calendars (<code>regla317</code> &amp; <code>reglaschuler</code>). Session stays active across all Lighthouse pages for 1 hour and auto-refreshes in the background.
          </p>

          <!-- AUTO-SYNC INTERVAL CONTROLS -->
          <div class="p-3 rounded-xl lh-surface space-y-2.5">
            <label class="flex items-center justify-between cursor-pointer">
              <div>
                <span class="text-xs font-semibold lh-text-main block">Auto-Refresh While Session Active</span>
                <span class="text-[11px] lh-text-sec">Syncs automatically on timer &amp; when returning to the tab</span>
              </div>
              <input id="toggle-gcal-autosync" type="checkbox"
                onchange="window.Lighthouse.updateGcalAutoSync(this.checked, null)"
                class="w-4 h-4" />
            </label>
            <div class="flex items-center justify-between gap-2 pt-1 border-t lh-border">
              <span class="text-xs lh-text-sec">Auto-Sync Frequency:</span>
              <select id="select-gcal-interval"
                onchange="window.Lighthouse.updateGcalAutoSync(null, Number(this.value))"
                class="px-2.5 py-1.5 rounded-lg lh-input text-xs font-semibold">
                <option value="15">Every 15 minutes (Recommended)</option>
                <option value="30">Every 30 minutes</option>
                <option value="60">Every 60 minutes</option>
              </select>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold lh-text-sec block">Google Web OAuth Client ID:</label>
            <input id="input-gcal-client-id" type="text" placeholder="Paste Google Web OAuth Client ID..."
              oninput="window.Lighthouse.updateSetting('gcalClientId', this.value)"
              class="w-full px-3 py-2.5 rounded-xl lh-input font-mono-code text-xs" />
          </div>

          <div class="p-2.5 rounded-xl lh-surface text-[11px] space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold lh-text-sec">Required "Authorized JavaScript origin" in Google Cloud:</span>
              <button onclick="navigator.clipboard?.writeText(window.location.origin); window.Lighthouse.showOriginCopied();" class="px-2 py-0.5 rounded lh-btn-soft text-[10px]">Copy Origin</button>
            </div>
            <code id="gcal-current-origin" class="block font-mono-code text-xs lh-text-main break-all"></code>
          </div>

          <label class="flex items-center justify-between p-2.5 rounded-xl lh-surface cursor-pointer">
            <div>
              <span class="text-xs font-semibold lh-text-main block">Strict Read-Only Mode</span>
              <span class="text-[11px] lh-text-sec">Uses <code>calendar.readonly</code> scope for maximum security</span>
            </div>
            <input id="toggle-gcal-readonly" type="checkbox" onchange="window.Lighthouse.updateSetting('gcalReadOnlyScope', this.checked)" class="w-4 h-4" />
          </label>

          <div class="flex items-center gap-2">
            <button onclick="window.Lighthouse.connectGoogleOAuth()" class="flex-1 py-3 rounded-xl lh-btn-primary text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Sign In &amp; Sync All Calendars Now</span>
            </button>
            <button onclick="window.Lighthouse.clearGcalEvents()" class="py-3 px-3 rounded-xl lh-surface lh-text-sec hover:lh-text-main text-xs font-semibold shrink-0" title="Remove cached calendar events">
              Clear Cache
            </button>
          </div>

          <div id="gcal-sync-diagnostics" class="p-3 rounded-xl lh-surface text-xs space-y-1.5 hidden"></div>
        </div>

        <div class="p-4 rounded-2xl lh-elevated space-y-2.5">
          <span class="text-xs font-bold uppercase tracking-wider lh-text-main block">Option 2: Load .ICS Calendar File</span>
          <p class="text-xs lh-text-sec">Import any <code>.ics</code> file directly from your phone without configuring OAuth (parses exact event dates &amp; times).</p>
          <label class="w-full py-2.5 px-4 rounded-xl lh-surface lh-text-main font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer hover:opacity-90">
            <i data-lucide="upload" class="w-4 h-4" style="color: var(--accent-primary);"></i>
            <span>Choose .ICS File</span>
            <input type="file" accept=".ics,text/calendar" onchange="window.Lighthouse.handleIcsUpload(event)" class="hidden" />
          </label>
        </div>
      </div>
    </div>

    <!-- ANALOG NIGHT WATCH & 3-HOLE BINDER PDF BUILDER MODAL -->
    <div id="pdf-builder-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm hidden items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="lh-surface rounded-t-3xl sm:rounded-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">
        <div class="p-4 sm:p-5 border-b lh-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-xl lh-badge">
              <i data-lucide="printer" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-base sm:text-lg lh-text-main">Analog Night Watch &amp; 3-Hole Binder PDF Studio</h3>
                <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full lh-badge-success">Ink-Saver Editorial Print</span>
              </div>
              <p class="text-xs lh-text-sec">Zero solid black bars • Granular line-count sliders per prompt • 3-Hole US Letter layout</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="window.Lighthouse.triggerNativePrint()" class="px-3.5 py-2 rounded-xl lh-btn-primary text-xs flex items-center gap-1.5" title="Best quality vector print or Save as PDF">
              <i data-lucide="printer" class="w-4 h-4"></i>
              <span>Print / Save Vector PDF</span>
            </button>
            <button onclick="window.Lighthouse.downloadNightBinderPdf()" class="px-3.5 py-2 rounded-xl lh-btn-soft text-xs flex items-center gap-1.5">
              <i data-lucide="file-down" class="w-4 h-4"></i>
              <span>Direct Download .PDF</span>
            </button>
            <button onclick="window.Lighthouse.closePdfBuilder()" class="p-2 rounded-xl lh-elevated lh-text-sec hover:lh-text-main">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <div class="lg:hidden px-4 pt-3 pb-1 border-b lh-border flex items-center gap-2 shrink-0">
          <button id="pdf-mob-tab-controls" onclick="window.Lighthouse.setPdfMobilePane('controls')" class="flex-1 py-2 rounded-xl text-xs font-bold lh-btn-primary">
            1. Sliders &amp; Setup
          </button>
          <button id="pdf-mob-tab-preview" onclick="window.Lighthouse.setPdfMobilePane('preview')" class="flex-1 py-2 rounded-xl text-xs font-bold lh-elevated lh-text-sec">
            2. Live Paper Preview
          </button>
        </div>

        <div id="pdf-builder-body" class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12"></div>
      </div>
    </div>

    <!-- MOBILE SLIDE-UP STATION DRAWER -->
    <div id="mobile-drawer" class="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden items-end">
      <div class="lh-surface rounded-t-3xl p-5 w-full space-y-4 shadow-2xl">
        <div class="flex items-center justify-between pb-2 border-b lh-border">
          <span class="text-xs font-bold uppercase tracking-wider" style="color: var(--accent-primary);">Lighthouse Stations</span>
          <button onclick="window.Lighthouse.toggleMobileDrawer(false)" class="p-1.5 rounded-xl lh-elevated lh-text-sec">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div id="mobile-drawer-grid" class="grid grid-cols-2 gap-2.5"></div>
      </div>
    </div>

    <!-- DESKTOP SIDEBAR NAVIGATION -->
    <aside class="hidden md:flex md:w-64 lg:w-72 lh-surface border-r lh-border flex-col justify-between p-5 shrink-0">
      <div>
        <div class="flex items-center justify-between pb-5 mb-5 border-b lh-border">
          <a href="index.html?tab=calendar" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl lh-btn-primary flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21h6" /><path d="M10 21l1-11h2l1 11" /><path d="M9 10h6" /><path d="M10 6h4v4h-4z" /><path d="M12 3v3" />
              </svg>
            </div>
            <div>
              <h1 class="font-bold text-base tracking-tight lh-text-main">Lighthouse</h1>
              <p class="text-xs lh-text-sec">Psalm 119:105</p>
            </div>
          </a>
          <button onclick="window.Lighthouse.openGcalModal()" class="p-2 rounded-xl lh-elevated lh-text-sec hover:lh-text-main" title="Google Calendar Sync Settings">
            <i data-lucide="calendar" class="w-4 h-4"></i>
          </button>
        </div>
        <nav id="desktop-nav" class="space-y-1.5"></nav>
      </div>

      <div class="pt-4 border-t lh-border">
        <p class="text-xs italic lh-text-sec font-serif-editorial text-base leading-snug">
          “Your word is a lamp to my feet and a light to my path.”
        </p>
      </div>
    </aside>

    <!-- MAIN CONTENT COLUMN -->
    <div class="flex-1 flex flex-col min-w-0 pb-24 md:pb-0">
      <header class="sticky top-0 z-30 lh-glass border-b lh-border px-4 sm:px-6 py-3">
        <div class="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <a href="index.html?tab=calendar" class="w-8 h-8 rounded-xl lh-btn-primary flex items-center justify-center shrink-0 md:hidden">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.3">
                <path d="M9 21h6" /><path d="M10 21l1-11h2l1 11" /><path d="M9 10h6" /><path d="M10 6h4v4h-4z" /><path d="M12 3v3" />
              </svg>
            </a>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 id="header-station-title" class="font-bold text-sm sm:text-base lh-text-main truncate">Watchtower</h2>
                <span id="header-goal-pill" onclick="window.Lighthouse.setTab('goals')" class="cursor-pointer hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs lh-badge font-medium"></span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <div id="header-routine-switcher" class="hidden items-center lh-elevated p-0.5 rounded-xl">
              <button id="btn-switch-morning" onclick="window.Lighthouse.setTab('morning')" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition">Morning</button>
              <button id="btn-switch-night" onclick="window.Lighthouse.setTab('night')" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition">Night</button>
            </div>

            <button id="header-gcal-btn" onclick="window.Lighthouse.syncGcalQuick()" class="px-2.5 py-1.5 rounded-xl lh-elevated lh-text-sec hover:lh-text-main text-xs font-medium flex items-center gap-1.5" title="Sync Google Calendar Now">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Sync GCal</span>
            </button>

            <button onclick="window.Lighthouse.openPdfBuilder()" class="px-2.5 py-1.5 rounded-xl lh-btn-soft text-xs font-semibold flex items-center gap-1.5" title="Build Analog Night & Binder PDF">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Night PDF</span>
            </button>

            <button onclick="window.Lighthouse.setTab('workouts')" class="p-2 rounded-xl lh-elevated lh-text-sec hover:lh-text-main" title="Training & Workouts Planner">
              <i data-lucide="dumbbell" class="w-4 h-4"></i>
            </button>

            <button onclick="window.Lighthouse.setTab('launchpad')" class="p-2 rounded-xl lh-elevated lh-text-sec hover:lh-text-main" title="Fleet Dock (Coded Sites)">
              <i data-lucide="layout-grid" class="w-4 h-4"></i>
            </button>

            <button onclick="window.Lighthouse.setTab('settings')" class="p-2 rounded-xl lh-elevated lh-text-sec hover:lh-text-main" title="Appearance & Settings">
              <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </header>

      <!-- DYNAMIC VIEWPORT -->
      <main id="app-viewport" class="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto space-y-6"></main>
    </div>

    <!-- MOBILE PORTRAIT BOTTOM BAR -->
    <nav id="mobile-bottom-nav" class="md:hidden fixed bottom-0 inset-x-0 z-40 lh-glass border-t lh-border px-2 py-1.5 grid grid-cols-6 gap-1"></nav>
  `;

  document.body.insertAdjacentHTML('afterbegin', shellHtml);
}

// =========================================================================
// NAVIGATION & HEADER RENDERING
// =========================================================================
export function renderNavigation() {
  applyTheme(state.settings.theme);

  const currentStation = NAV_STATIONS.find((s) => s.id === state.activeTab) || NAV_STATIONS[0];
  const titleEl = document.getElementById('header-station-title');
  if (titleEl) titleEl.textContent = currentStation.label;

  const activeGoals = (state.goals || []).filter((g) => g.status === 'active');
  const goalPill = document.getElementById('header-goal-pill');
  if (goalPill) {
    goalPill.innerHTML = `<i data-lucide="target" class="w-3 h-3"></i><span>${escapeHtml(activeGoals[0]?.title || 'Goals')} (${activeGoals.length}/${state.settings.maxActiveGoals})</span>`;
  }

  // Update header GCal sync button visual status
  const gcalStatus = getGcalSessionStatus();
  const headerGcalBtn = document.getElementById('header-gcal-btn');
  if (headerGcalBtn) {
    headerGcalBtn.className = `px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
      gcalStatus.hasToken ? 'lh-badge-success' : 'lh-elevated lh-text-sec hover:lh-text-main'
    }`;
    headerGcalBtn.innerHTML = `
      <i data-lucide="refresh-cw" class="w-3.5 h-3.5 ${gcalStatus.syncing ? 'animate-spin' : ''}"></i>
      <span class="hidden sm:inline">${
        gcalStatus.syncing
          ? 'Syncing...'
          : gcalStatus.hasToken
          ? `GCal (${gcalStatus.expiresInMins}m)`
          : 'Sync GCal'
      }</span>
    `;
  }

  // Morning/Night Quick Switcher when on Routines
  const switcher = document.getElementById('header-routine-switcher');
  const btnM = document.getElementById('btn-switch-morning');
  const btnN = document.getElementById('btn-switch-night');
  if (switcher && btnM && btnN) {
    if (state.activeTab === 'morning' || state.activeTab === 'night') {
      switcher.classList.remove('hidden');
      switcher.classList.add('flex');
      btnM.className = `px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
        state.activeTab === 'morning' ? 'lh-btn-primary' : 'lh-text-sec'
      }`;
      btnN.className = `px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
        state.activeTab === 'night' ? 'lh-btn-primary' : 'lh-text-sec'
      }`;
    } else {
      switcher.classList.add('hidden');
      switcher.classList.remove('flex');
    }
  }

  // Desktop Sidebar
  const desktopNav = document.getElementById('desktop-nav');
  if (desktopNav) {
    desktopNav.innerHTML = NAV_STATIONS.map((item) => {
      const isActive = state.activeTab === item.id;
      return `
        <button onclick="window.Lighthouse.setTab('${item.id}')"
          class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${
            isActive ? 'lh-btn-soft' : 'lh-text-sec hover:lh-text-main'
          }">
          <div class="flex items-center gap-3">
            <i data-lucide="${item.icon}" class="w-4 h-4"></i>
            <span>${escapeHtml(item.label)}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  // Mobile Bottom Bar
  const mobileBottom = document.getElementById('mobile-bottom-nav');
  if (mobileBottom) {
    const dockItems = [
      { id: 'calendar', label: 'Watch', icon: 'compass' },
      { id: 'workouts', label: 'Workouts', icon: 'dumbbell' },
      { id: 'lists', label: 'Lists', icon: 'check-square' },
      { id: 'prayer', label: 'Prayer', icon: 'heart' },
      { id: 'goals', label: 'Course', icon: 'target' }
    ];
    mobileBottom.innerHTML =
      dockItems
        .map((item) => {
          const isActive = state.activeTab === item.id;
          return `
            <button onclick="window.Lighthouse.setTab('${item.id}')"
              class="flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
                isActive ? 'lh-badge' : 'lh-text-sec'
              }">
              <i data-lucide="${item.icon}" class="w-4 h-4 mb-0.5"></i>
              <span class="truncate">${escapeHtml(item.label)}</span>
            </button>
          `;
        })
        .join('') +
      `
        <button onclick="window.Lighthouse.toggleMobileDrawer(true)"
          class="flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
            ['morning', 'night', 'launchpad', 'settings'].includes(state.activeTab) ? 'lh-badge' : 'lh-text-sec'
          }">
          <i data-lucide="menu" class="w-4 h-4 mb-0.5"></i>
          <span>More</span>
        </button>
      `;
  }

  // Mobile Drawer Grid
  const drawerGrid = document.getElementById('mobile-drawer-grid');
  if (drawerGrid) {
    drawerGrid.innerHTML = NAV_STATIONS.map((item) => {
      const isActive = state.activeTab === item.id;
      return `
        <button onclick="window.Lighthouse.setTab('${item.id}'); window.Lighthouse.toggleMobileDrawer(false);"
          class="flex items-center gap-3 p-3.5 rounded-2xl text-left transition ${
            isActive ? 'lh-btn-soft' : 'lh-elevated lh-text-main'
          }">
          <i data-lucide="${item.icon}" class="w-4 h-4 shrink-0"></i>
          <span class="text-xs font-semibold truncate">${escapeHtml(item.label)}</span>
        </button>
      `;
    }).join('');
  }
}

// =========================================================================
// MASTER RENDER DISPATCHER
// =========================================================================
export function renderApp() {
  lastRenderedIsoDate = getLocalIsoDate(0);
  renderNavigation();
  const viewport = document.getElementById('app-viewport');
  if (!viewport) return;

  const renderer = pageRenderers[state.activeTab] || pageRenderers[currentDefaultTab];
  if (typeof renderer === 'function') {
    viewport.innerHTML = renderer();
  }

  if (window.lucide) window.lucide.createIcons();
}

// =========================================================================
// ANALOG NIGHT WATCH & 3-HOLE BINDER PDF BUILDER ENGINE (INK-SAVER + SLIDERS)
// =========================================================================
function renderRuledLinesHtml(count, style, lineHeightPx = 24) {
  const num = Math.max(1, Number(count) || 5);
  const lh = Math.max(16, Number(lineHeightPx) || 24);
  if (style === 'boxed') {
    const heightPx = Math.max(64, num * lh);
    return `<div class="print-box-grid w-full my-1.5" style="height: ${heightPx}px;"></div>`;
  }
  const borderStyle = style === 'dotted' ? '1px dashed #64748b' : '1px solid #94a3b8';
  let html = '<div class="my-1">';
  for (let i = 0; i < num; i++) {
    html += `<div style="height: ${lh}px; border-bottom: ${borderStyle};"></div>`;
  }
  html += '</div>';
  return html;
}

function renderNumberedItemBlocksHtml(itemCount, totalLines, style, lineHeightPx = 24) {
  const total = Math.max(itemCount, Number(totalLines) || itemCount * 2);
  const baseLinesPerItem = Math.floor(total / itemCount);
  const remainder = total % itemCount;
  const lh = Math.max(16, Number(lineHeightPx) || 24);
  const borderStyle = style === 'dotted' ? '1px dashed #64748b' : '1px solid #94a3b8';

  let html = '<div class="space-y-1.5 my-1.5">';
  for (let itemIdx = 1; itemIdx <= itemCount; itemIdx++) {
    const linesForThis = baseLinesPerItem + (itemIdx <= remainder ? 1 : 0);
    html += `<div class="avoid-break">`;
    for (let l = 0; l < linesForThis; l++) {
      if (l === 0) {
        html += `
          <div style="height: ${lh}px; border-bottom: ${borderStyle}; display: flex; align-items: flex-end; padding-bottom: 2px;">
            <span style="font-size: 10px; font-weight: 700; color: #1e293b; font-family: monospace; margin-right: 6px;">${itemIdx}.</span>
          </div>
        `;
      } else {
        html += `<div style="height: ${lh}px; border-bottom: ${borderStyle}; margin-left: 16px;"></div>`;
      }
    }
    html += `</div>`;
  }
  html += '</div>';
  return html;
}

function renderHolePunchRail(side = 'left') {
  return `
    <div class="hole-punch-rail ${side === 'right' ? 'hole-punch-right' : 'hole-punch-left'}">
      <div class="hole-punch-circle">•</div>
      <div class="hole-punch-circle">•</div>
      <div class="hole-punch-circle">•</div>
    </div>
  `;
}

export function buildPrintableBinderSheetHtml() {
  const cfg = { ...INITIAL_STATE.pdfConfig, ...(state.pdfConfig || {}) };
  const lineStyle = cfg.lineStyle || 'ruled';
  const lh = Number(cfg.lineHeightPx) || 24;
  const padLeft = cfg.threeHoleMargin
    ? 'padding-left: 0.88in; padding-right: 0.45in;'
    : 'padding-left: 0.5in; padding-right: 0.5in;';
  const padPage2 =
    cfg.threeHoleMargin && cfg.duplexMirrorMargin
      ? 'padding-right: 0.88in; padding-left: 0.45in;'
      : padLeft;

  const editorialHeader = (romanTitle, rightSubtitle) => `
    <div style="border-top: 1.5px solid #0f172a; border-bottom: 1px solid #334155; padding: 4px 0; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; background: #ffffff;">
      <h2 style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; margin: 0;">
        ${romanTitle}
      </h2>
      <span style="font-size: 9.5px; color: #475569; font-family: monospace;">${rightSubtitle}</span>
    </div>
  `;

  const selectedNightCards = (cfg.selectedNightCardIds || [])
    .map((id) => NIGHT_LIBRARY.find((c) => c.id === id))
    .filter(Boolean);

  const nightPlanSectionHtml =
    cfg.includeNightPlan && selectedNightCards.length > 0
      ? `
        <div class="avoid-break mb-5">
          ${editorialHeader('I. Tonight’s Night Watch Wind-Down Checklist', `Target Sleep: ${escapeHtml(state.settings.sleepTime || '22:00')}`)}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;">
            ${selectedNightCards
              .map(
                (c) => `
                <div class="avoid-break" style="display: flex; align-items: flex-start; gap: 7px; font-size: 10.5px; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="display: inline-block; width: 12px; height: 12px; border: 1.25px solid #1e293b; border-radius: 2px; margin-top: 2px; flex-shrink: 0; background: #ffffff;"></span>
                  <div>
                    <div style="font-weight: 700; color: #0f172a;">
                      ${escapeHtml(c.defaultTime)} • ${escapeHtml(c.title)} <span style="font-weight: 500; color: #475569;">(${c.durationMins}m)</span>
                    </div>
                    <div style="font-size: 9.5px; color: #334155; line-height: 1.35;">${escapeHtml(c.summary)} <em>(${escapeHtml(c.scriptureRef)})</em></div>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
      : '';

  const activeIntercessions = (state.prayerCards || []).filter((c) => !c.isAnswered && c.onActiveBoard);
  const selectedJesusThemes = (cfg.selectedJesusThemeIds || [])
    .map((id) => JESUS_PRAYER_THEMES.find((t) => t.id === id))
    .filter(Boolean);
  const prayerNoteLines = Number(cfg.prayerNoteLines ?? 1);

  let guidedPrayerHtml = '';
  if (cfg.guidedPrayerMethod === 'PRAY') {
    guidedPrayerHtml = `
      <div class="avoid-break" style="margin-top: 8px; padding: 7px 10px; border: 1px solid #64748b; border-radius: 4px; background: #ffffff;">
        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #0f172a; margin-bottom: 4px;">
          Guided P.R.A.Y. Sanctuary Flow (Lectio 365 Method)
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 9.5px; color: #1e293b;">
          <div><strong>[ ] P — Pause (Ps 46:10):</strong> Slow nasal breaths; be still before the Father.</div>
          <div><strong>[ ] R — Rejoice (Matt 6:9):</strong> Hallow His name &amp; thank Him for 2 mercies today.</div>
          <div><strong>[ ] A — Ask (Matt 6:11):</strong> Intercede for family, Safety Team &amp; daily bread.</div>
          <div><strong>[ ] Y — Yield (Luke 22:42):</strong> Surrender outcomes: “Your will be done.”</div>
        </div>
      </div>
    `;
  } else if (cfg.guidedPrayerMethod === 'LORDS_PRAYER') {
    guidedPrayerHtml = `
      <div class="avoid-break" style="margin-top: 8px; padding: 7px 10px; border: 1px solid #64748b; border-radius: 4px; background: #ffffff;">
        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #0f172a; margin-bottom: 4px;">
          The Lord’s Prayer 6-Petition Evening Walk (Matthew 6:9–13)
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; font-size: 9.5px; color: #1e293b;">
          <div>[ ] 1. Father’s Holiness (“Hallowed be Your name”)</div>
          <div>[ ] 2. Kingdom Alignment (“Your Kingdom come”)</div>
          <div>[ ] 3. Tomorrow’s Bread (“Give us our daily bread”)</div>
          <div>[ ] 4. Relational Release (“Forgive our debts &amp; debtors”)</div>
          <div>[ ] 5. Guarded Walk (“Lead us not into temptation”)</div>
          <div>[ ] 6. Deliverance &amp; Doxology (“Deliver us from evil”)</div>
        </div>
      </div>
    `;
  }

  const jesusCardsPrintHtml =
    selectedJesusThemes.length > 0
      ? `
        <div class="avoid-break" style="margin-top: 8px;">
          <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 4px;">
            Jesus’s Prayer Teachings (${escapeHtml(cfg.bibleVersion)} Study Lens)
          </div>
          <div style="display: grid; grid-template-columns: 1fr; gap: 6px;">
            ${selectedJesusThemes
              .map((t) => {
                const lensText =
                  cfg.bibleVersion === 'NASB'
                    ? t.nasbLens
                    : cfg.bibleVersion === 'NLT'
                    ? t.nltLens
                    : `${t.nasbLens} | ${t.nltLens}`;
                return `
                  <div class="avoid-break" style="padding: 5px 8px; border: 1px solid #94a3b8; border-left: 2.5px solid #0f172a; background: #ffffff; font-size: 9.5px;">
                    <div style="font-weight: 700; color: #0f172a;">${escapeHtml(t.theme)} (${escapeHtml(t.reference)})</div>
                    <div style="color: #334155; margin-top: 1.5px; line-height: 1.35;">${escapeHtml(lensText)}</div>
                    <div style="font-style: italic; color: #0f172a; margin-top: 2px;">Prompt: “${escapeHtml(t.samplePrayer)}”</div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `
      : '';

  const prayerSectionHtml =
    cfg.includePrayerDeck || cfg.guidedPrayerMethod !== 'NONE' || selectedJesusThemes.length > 0
      ? `
        <div class="avoid-break mb-5">
          ${editorialHeader('II. Evening Prayer Sanctuary & Intercession Watch', 'Philippians 4:6–7 • Psalm 141:2')}

          ${
            cfg.includePrayerDeck
              ? `
                <div style="margin-bottom: 6px;">
                  <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">
                    Active Intercession Board (Check off &amp; write specific praises or requests below each card):
                  </div>
                  <div class="space-y-1.5">
                    ${activeIntercessions
                      .map(
                        (p) => `
                        <div class="avoid-break" style="padding: 4px 0;">
                          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 10.5px;">
                            <div style="display: flex; align-items: baseline; gap: 7px;">
                              <span style="display: inline-block; width: 11px; height: 11px; border: 1.25px solid #1e293b; border-radius: 2px; flex-shrink: 0;"></span>
                              <span style="font-weight: 700; color: #0f172a;">${escapeHtml(p.title)}</span>
                              <span style="font-size: 9px; color: #475569; font-family: monospace;">(${escapeHtml(p.scriptureTag || '')})</span>
                            </div>
                            <span style="font-size: 9px; color: #64748b;">${escapeHtml(p.category || '')}</span>
                          </div>
                          ${
                            prayerNoteLines > 0
                              ? `<div style="margin-left: 18px;">${renderRuledLinesHtml(prayerNoteLines, lineStyle, Math.max(18, lh - 3))}</div>`
                              : ''
                          }
                        </div>
                      `
                      )
                      .join('')}
                  </div>
                </div>
              `
              : ''
          }
          ${guidedPrayerHtml}
          ${jesusCardsPrintHtml}
        </div>
      `
      : '';

  const journalModes = cfg.includeCaptainsLog ? cfg.selectedJournalModes || ['closure_321'] : [];
  const journalBlocksHtml = journalModes
    .map((mId) => {
      if (mId === 'baylor_offload') {
        const taskRows = Math.max(3, Number(cfg.baylorTaskRows) || 8);
        const anchorLines = Math.max(1, Number(cfg.baylorAnchorLines) || 3);
        const rowsArr = Array.from({ length: taskRows }, (_, idx) => idx + 1);
        return `
          <div class="avoid-break mb-5">
            ${editorialHeader('Captain’s Log • Baylor 5-Minute Cognitive Offload', 'Closes Working-Memory Loops Before Sleep')}
            <p style="font-size: 9.5px; color: #334155; margin: 4px 0 6px 0;">
              Write down concrete tasks or open loops for tomorrow so your hippocampus stops rehearsing them overnight:
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; margin-bottom: 10px;">
              ${rowsArr
                .map(
                  (n) => `
                  <div style="display: flex; align-items: flex-end; gap: 6px; height: ${lh}px; border-bottom: 1px solid #94a3b8; padding-bottom: 2px; font-size: 10px; color: #0f172a;">
                    <span style="font-weight: 700; font-family: monospace;">${n}.</span>
                    <span style="flex: 1;"></span>
                    <span style="font-size: 8.5px; color: #475569;">[ ] 24h Watch</span>
                  </div>
                `
                )
                .join('')}
            </div>
            <div class="avoid-break" style="margin-top: 6px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                Tomorrow’s #1 First-Thing Anchor Task &amp; Execution Notes (${anchorLines} lines):
              </div>
              ${renderRuledLinesHtml(anchorLines, lineStyle, lh)}
            </div>
          </div>
        `;
      }

      if (mId === 'examen') {
        const stepLines = Math.max(1, Number(cfg.examenStepLines) || 4);
        const examenSteps = [
          { title: 'Step 1 • Gratitude (Psalm 103:2)', q: 'Where did I experience God’s kindness, provision, or a quiet gift today?' },
          { title: 'Step 2 • Petition for Light (Psalm 139:23–24)', q: 'Ask the Holy Spirit for honest, grace-filled sight as I review the last 24 hours:' },
          { title: 'Step 3 • Review Consolation & Desolation (Lamentations 3:40)', q: 'When did my soul feel peaceful and aligned with God today? When did I feel hurried, reactive, or drained?' },
          { title: 'Step 4 • Forgiveness & Gospel Repair (1 John 1:9)', q: 'What impatience, distraction, or shortcoming do I confess and release into Christ’s mercy tonight?' },
          { title: 'Step 5 • Grace for Tomorrow (Philippians 3:13–14)', q: 'Where do I most need Jesus’s wisdom and presence in tomorrow’s schedule?' }
        ];
        return `
          <div class="mb-5">
            ${editorialHeader('Captain’s Log • The 5-Step Biblical Examen', `${stepLines} Lines per Movement`)}
            ${examenSteps
              .map(
                (st) => `
                <div class="avoid-break" style="margin-bottom: 8px;">
                  <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">${st.title}</div>
                  <div style="font-size: 9.5px; color: #334155; font-style: italic;">${st.q}</div>
                  ${renderRuledLinesHtml(stepLines, lineStyle, lh)}
                </div>
              `
              )
              .join('')}
          </div>
        `;
      }

      if (mId === 'pennebaker') {
        const priLines = Math.max(2, Number(cfg.deepPrimaryLines) || 8);
        const secLines = Math.max(2, Number(cfg.deepSecondaryLines) || 5);
        return `
          <div class="mb-5">
            ${editorialHeader('Captain’s Log • Pennebaker Expressive Emotional Unpacking', 'Tension Level: 1  2  3  4  5  6  7  8  9  10')}
            <div class="avoid-break" style="margin-bottom: 8px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                1. Unfiltered Stream — What unspoken frustration, weight, or emotion from today needs to be named honestly? (${priLines} lines):
              </div>
              ${renderRuledLinesHtml(priLines, lineStyle, lh)}
            </div>
            <div class="avoid-break">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                2. Prefrontal &amp; Biblical Reframe — Having named it on paper, what truth or promise anchors my heart tonight? (${secLines} lines):
              </div>
              ${renderRuledLinesHtml(secLines, lineStyle, lh)}
            </div>
          </div>
        `;
      }

      if (mId === 'narrative') {
        const priLines = Math.max(2, Number(cfg.deepPrimaryLines) || 8);
        const secLines = Math.max(2, Number(cfg.deepSecondaryLines) || 5);
        return `
          <div class="mb-5">
            ${editorialHeader('Captain’s Log • Story-Based Narrative Gratitude', 'Deep Anterior Cingulate & Serotonin Encoding')}
            <div class="avoid-break" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; font-size: 9.5px;">
              <div style="padding: 5px 8px; border: 1px solid #94a3b8; border-radius: 4px;">
                <strong>1. The Scene (Where I Was):</strong>
                <div style="height: 20px; border-bottom: 1px solid #cbd5e1;"></div>
              </div>
              <div style="padding: 5px 8px; border: 1px solid #94a3b8; border-radius: 4px;">
                <strong>Who Was Involved:</strong>
                <div style="height: 20px; border-bottom: 1px solid #cbd5e1;"></div>
              </div>
            </div>
            <div class="avoid-break" style="margin-bottom: 8px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                2. Replay ONE Meaningful Moment from Today in Vivid Sensory Detail (${priLines} lines):
              </div>
              ${renderRuledLinesHtml(priLines, lineStyle, lh)}
            </div>
            <div class="avoid-break">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                3. Heart Takeaway — Why did this specific gift from God matter to my soul today? (${secLines} lines):
              </div>
              ${renderRuledLinesHtml(secLines, lineStyle, lh)}
            </div>
          </div>
        `;
      }

      if (mId === 'closure_321') {
        const winsLines = Math.max(3, Number(cfg.winsLines) || 6);
        const lessonsLines = Math.max(2, Number(cfg.lessonsLines) || 4);
        const intentionLines = Math.max(1, Number(cfg.intentionLines) || 3);
        return `
          <div class="mb-5">
            ${editorialHeader('Captain’s Log • The 3-2-1 Evening Closure', `${winsLines} + ${lessonsLines} + ${intentionLines} Writing Lines`)}
            <div class="avoid-break" style="margin-bottom: 10px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                3 Wins, Gifts, or Completed Anchors from Today (${winsLines} lines — ${Math.floor(winsLines / 3)}–${Math.ceil(winsLines / 3)} lines per win):
              </div>
              ${renderNumberedItemBlocksHtml(3, winsLines, lineStyle, lh)}
            </div>
            <div class="avoid-break" style="margin-bottom: 10px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                2 Releases, Lessons, or Adjustments from Today (${lessonsLines} lines — ${Math.floor(lessonsLines / 2)}–${Math.ceil(lessonsLines / 2)} lines each):
              </div>
              ${renderNumberedItemBlocksHtml(2, lessonsLines, lineStyle, lh)}
            </div>
            <div class="avoid-break">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                1 Primary Intention &amp; Mindset for Tomorrow Morning (${intentionLines} lines):
              </div>
              ${renderNumberedItemBlocksHtml(1, intentionLines, lineStyle, lh)}
            </div>
          </div>
        `;
      }

      if (mId === 'psalm4') {
        const priLines = Math.max(2, Number(cfg.deepPrimaryLines) || 8);
        const secLines = Math.max(2, Number(cfg.deepSecondaryLines) || 5);
        return `
          <div class="mb-5">
            ${editorialHeader('Captain’s Log • Psalm 4:8 Night Watch Surrender', '“In peace I will both lie down and sleep...”')}
            <div class="avoid-break" style="margin-bottom: 8px;">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                1. Burdens, Family Needs &amp; Unfinished Work I Am Releasing from My Shoulders Tonight (${priLines} lines):
              </div>
              ${renderRuledLinesHtml(priLines, lineStyle, lh)}
            </div>
            <div class="avoid-break">
              <div style="font-size: 10.5px; font-weight: 700; color: #0f172a;">
                2. Written Prayer Handing the Night Watch Over to the Lord (Psalm 4:8 • Psalm 121:3–4) (${secLines} lines):
              </div>
              ${renderRuledLinesHtml(secLines, lineStyle, lh)}
            </div>
          </div>
        `;
      }
      return '';
    })
    .join('');

  const sheetDateNow = cfg.sheetDate || getLocalIsoDate(0);
  const headerBannerHtml = `
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; background: #ffffff;">
      <div>
        <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #475569;">
          Lighthouse Analog Watchtower • Ink-Saver 3-Hole Binder Edition (Psalm 119:105)
        </div>
        <h1 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 2px 0 0 0;">
          Evening Wind-Down, Prayer Sanctuary &amp; Captain’s Log
        </h1>
      </div>
      <div style="text-align: right; font-size: 9.5px; color: #0f172a; font-family: monospace;">
        <div><strong>Date:</strong> ${escapeHtml(sheetDateNow)}</div>
        <div><strong>Keeper:</strong> ${escapeHtml(state.settings.userName || 'Dan')}</div>
      </div>
    </div>
  `;

  if (cfg.pageTarget === '2page') {
    return `
      <div id="printable-binder-document" style="--print-line-height: ${lh}px;">
        <div class="binder-paper-sheet" style="padding-top: 0.4in; padding-bottom: 0.4in; ${padLeft}">
          ${cfg.threeHoleMargin ? renderHolePunchRail('left') : ''}
          ${headerBannerHtml}
          ${nightPlanSectionHtml}
          ${prayerSectionHtml}
        </div>
        <div class="binder-paper-sheet binder-page-break mt-6" style="padding-top: 0.4in; padding-bottom: 0.4in; ${padPage2}">
          ${cfg.threeHoleMargin ? renderHolePunchRail(cfg.duplexMirrorMargin ? 'right' : 'left') : ''}
          <div style="border-bottom: 1.5px solid #0f172a; padding-bottom: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a;">
              III. Captain’s Log — Screen-Free Evening Writing Spread (Page 2)
            </span>
            <span style="font-size: 9.5px; font-family: monospace; color: #475569;">Date: ${escapeHtml(sheetDateNow)} • Keeper: ${escapeHtml(state.settings.userName || 'Dan')}</span>
          </div>
          ${journalBlocksHtml}
        </div>
      </div>
    `;
  }

  if (cfg.pageTarget === 'log_only') {
    return `
      <div id="printable-binder-document" style="--print-line-height: ${lh}px;">
        <div class="binder-paper-sheet" style="padding-top: 0.4in; padding-bottom: 0.4in; ${padLeft}">
          ${cfg.threeHoleMargin ? renderHolePunchRail('left') : ''}
          ${headerBannerHtml}
          ${journalBlocksHtml}
        </div>
      </div>
    `;
  }

  return `
    <div id="printable-binder-document" style="--print-line-height: ${lh}px;">
      <div class="binder-paper-sheet" style="padding-top: 0.38in; padding-bottom: 0.38in; ${padLeft}">
        ${cfg.threeHoleMargin ? renderHolePunchRail('left') : ''}
        ${headerBannerHtml}
        ${nightPlanSectionHtml}
        ${prayerSectionHtml}
        ${journalBlocksHtml}
      </div>
    </div>
  `;
}

function renderSliderControl({ id, label, sublabel, key, min, max, val, unit = 'lines' }) {
  const numVal = Number(val);
  return `
    <div class="p-2.5 rounded-xl lh-surface space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <div>
          <span class="text-xs font-semibold lh-text-main block">${escapeHtml(label)}</span>
          ${sublabel ? `<span class="text-[10px] lh-text-sec block">${escapeHtml(sublabel)}</span>` : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="window.Lighthouse.stepPdfSlider('${key}', -1, ${min}, ${max})"
            class="w-6 h-6 rounded-lg lh-elevated lh-text-main text-xs font-bold flex items-center justify-center hover:opacity-80">−</button>
          <span id="slider-badge-${id}" class="min-w-[54px] text-center text-xs font-mono-code font-bold px-2 py-0.5 rounded-lg lh-badge">${numVal} ${unit}</span>
          <button type="button" onclick="window.Lighthouse.stepPdfSlider('${key}', 1, ${min}, ${max})"
            class="w-6 h-6 rounded-lg lh-elevated lh-text-main text-xs font-bold flex items-center justify-center hover:opacity-80">+</button>
        </div>
      </div>
      <input id="slider-input-${id}" type="range" min="${min}" max="${max}" value="${numVal}"
        oninput="window.Lighthouse.liveSlidePdfConfig('${key}', '${id}', this.value, '${unit}')"
        class="w-full cursor-pointer" />
    </div>
  `;
}

function renderPdfBuilderModalContent() {
  const box = document.getElementById('pdf-builder-body');
  if (!box) return;
  const cfg = { ...INITIAL_STATE.pdfConfig, ...(state.pdfConfig || {}) };
  const modes = cfg.selectedJournalModes || ['closure_321'];
  const mobPane = cfg.mobilePane || 'controls';

  const mobBtnControls = document.getElementById('pdf-mob-tab-controls');
  const mobBtnPreview = document.getElementById('pdf-mob-tab-preview');
  if (mobBtnControls && mobBtnPreview) {
    mobBtnControls.className = `flex-1 py-2 rounded-xl text-xs font-bold ${mobPane === 'controls' ? 'lh-btn-primary' : 'lh-elevated lh-text-sec'}`;
    mobBtnPreview.className = `flex-1 py-2 rounded-xl text-xs font-bold ${mobPane === 'preview' ? 'lh-btn-primary' : 'lh-elevated lh-text-sec'}`;
  }

  const journalCatalog = [
    { id: 'closure_321', label: '3-2-1 Evening Closure (Wins, Lessons, #1 Intention)' },
    { id: 'baylor_offload', label: 'Baylor 5-Min Cognitive Offload (Numbered Task Grid)' },
    { id: 'examen', label: '5-Step Biblical Examen (All 5 Spiritual Movements)' },
    { id: 'psalm4', label: 'Psalm 4:8 Night Watch Surrender' },
    { id: 'pennebaker', label: 'Pennebaker Deep Emotional Unpacking' },
    { id: 'narrative', label: 'Story-Based Narrative Gratitude' }
  ];

  box.innerHTML = `
    <div class="${mobPane === 'preview' ? 'hidden lg:block' : 'block'} lg:col-span-5 p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[82vh] border-r lh-border">
      <div class="p-3.5 rounded-2xl lh-elevated space-y-3">
        <h4 class="font-bold text-xs uppercase tracking-wider" style="color: var(--accent-primary);">1. Page Spread &amp; 3-Hole Binder Setup</h4>
        <div class="grid grid-cols-3 gap-1.5">
          <button onclick="window.Lighthouse.updatePdfConfig('pageTarget', '2page')"
            class="py-2 px-2 rounded-xl text-[11px] font-semibold ${cfg.pageTarget === '2page' ? 'lh-btn-primary' : 'lh-surface lh-text-sec'}">
            2-Page Spread
          </button>
          <button onclick="window.Lighthouse.updatePdfConfig('pageTarget', '1page')"
            class="py-2 px-2 rounded-xl text-[11px] font-semibold ${cfg.pageTarget === '1page' ? 'lh-btn-primary' : 'lh-surface lh-text-sec'}">
            1-Page All-in-One
          </button>
          <button onclick="window.Lighthouse.updatePdfConfig('pageTarget', 'log_only')"
            class="py-2 px-2 rounded-xl text-[11px] font-semibold ${cfg.pageTarget === 'log_only' ? 'lh-btn-primary' : 'lh-surface lh-text-sec'}">
            Log Only (1p)
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center justify-between p-2 rounded-xl lh-surface cursor-pointer text-xs">
            <span class="font-medium lh-text-main">3-Hole Margin</span>
            <input type="checkbox" ${cfg.threeHoleMargin ? 'checked' : ''}
              onchange="window.Lighthouse.updatePdfConfig('threeHoleMargin', this.checked)" class="w-4 h-4" />
          </label>
          <label class="flex items-center justify-between p-2 rounded-xl lh-surface cursor-pointer text-xs">
            <span class="font-medium lh-text-main">Duplex Mirror P2</span>
            <input type="checkbox" ${cfg.duplexMirrorMargin ? 'checked' : ''}
              onchange="window.Lighthouse.updatePdfConfig('duplexMirrorMargin', this.checked)" class="w-4 h-4" />
          </label>
        </div>
      </div>

      <div class="p-3.5 rounded-2xl lh-elevated space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <h4 class="font-bold text-xs uppercase tracking-wider" style="color: var(--accent-primary);">2. Writing Line Sliders (Live Preview)</h4>
          <div class="flex items-center gap-1">
            <button onclick="window.Lighthouse.applyPdfLinePreset('compact')" class="px-2 py-0.5 rounded-md lh-surface text-[10px] font-semibold lh-text-sec hover:lh-text-main">Compact</button>
            <button onclick="window.Lighthouse.applyPdfLinePreset('balanced')" class="px-2 py-0.5 rounded-md lh-surface text-[10px] font-semibold lh-text-sec hover:lh-text-main">Balanced</button>
            <button onclick="window.Lighthouse.applyPdfLinePreset('deep')" class="px-2 py-0.5 rounded-md lh-btn-soft text-[10px] font-semibold">Deep Writing</button>
          </div>
        </div>

        ${renderSliderControl({
          id: 'lineHeightPx',
          label: 'Line Spacing Height (Rule Width)',
          sublabel: '18px Compact • 24px College Ruled • 30px Wide Ruled',
          key: 'lineHeightPx',
          min: 18,
          max: 32,
          val: cfg.lineHeightPx ?? 24,
          unit: 'px'
        })}

        ${renderSliderControl({
          id: 'prayerNoteLines',
          label: 'Lines Under Each Active Prayer Card',
          sublabel: 'Blank lines below Regla, Safety Team, etc. (0 = title only)',
          key: 'prayerNoteLines',
          min: 0,
          max: 4,
          val: cfg.prayerNoteLines ?? 1,
          unit: 'lines'
        })}

        ${
          modes.includes('closure_321')
            ? `
              <div class="pt-1 border-t lh-border space-y-2">
                <span class="text-[11px] font-bold lh-text-main block">3-2-1 Evening Closure Line Sliders:</span>
                ${renderSliderControl({
                  id: 'winsLines',
                  label: '3 Wins / Gifts from Today',
                  sublabel: 'Divided evenly across Wins #1, #2, and #3 (e.g., 6 = 2 lines per win)',
                  key: 'winsLines',
                  min: 3,
                  max: 15,
                  val: cfg.winsLines ?? 6,
                  unit: 'lines'
                })}
                ${renderSliderControl({
                  id: 'lessonsLines',
                  label: '2 Releases / Adjustments',
                  sublabel: 'Divided across Releases #1 and #2 (e.g., 4 = 2 lines each)',
                  key: 'lessonsLines',
                  min: 2,
                  max: 12,
                  val: cfg.lessonsLines ?? 4,
                  unit: 'lines'
                })}
                ${renderSliderControl({
                  id: 'intentionLines',
                  label: '1 Primary Intention for Tomorrow',
                  sublabel: 'Lines for tomorrow morning’s #1 focus',
                  key: 'intentionLines',
                  min: 1,
                  max: 8,
                  val: cfg.intentionLines ?? 3,
                  unit: 'lines'
                })}
              </div>
            `
            : ''
        }

        ${
          modes.includes('examen')
            ? `
              <div class="pt-1 border-t lh-border space-y-2">
                ${renderSliderControl({
                  id: 'examenStepLines',
                  label: '5-Step Biblical Examen (Lines per Step)',
                  sublabel: 'Applied to each of the 5 Examen movements',
                  key: 'examenStepLines',
                  min: 2,
                  max: 10,
                  val: cfg.examenStepLines ?? 4,
                  unit: 'lines'
                })}
              </div>
            `
            : ''
        }

        ${
          modes.includes('baylor_offload')
            ? `
              <div class="pt-1 border-t lh-border space-y-2">
                ${renderSliderControl({
                  id: 'baylorTaskRows',
                  label: 'Baylor Offload Numbered Task Rows',
                  sublabel: 'Two-column numbered action-item grid',
                  key: 'baylorTaskRows',
                  min: 4,
                  max: 14,
                  val: cfg.baylorTaskRows ?? 8,
                  unit: 'rows'
                })}
                ${renderSliderControl({
                  id: 'baylorAnchorLines',
                  label: 'Tomorrow’s #1 Priority Notes Lines',
                  sublabel: 'Ruled lines below the #1 priority callout',
                  key: 'baylorAnchorLines',
                  min: 1,
                  max: 6,
                  val: cfg.baylorAnchorLines ?? 3,
                  unit: 'lines'
                })}
              </div>
            `
            : ''
        }

        ${
          modes.some((m) => ['pennebaker', 'narrative', 'psalm4'].includes(m))
            ? `
              <div class="pt-1 border-t lh-border space-y-2">
                ${renderSliderControl({
                  id: 'deepPrimaryLines',
                  label: 'Primary Prompt Writing Lines',
                  sublabel: 'Main reflection / story / burdens section',
                  key: 'deepPrimaryLines',
                  min: 3,
                  max: 16,
                  val: cfg.deepPrimaryLines ?? 8,
                  unit: 'lines'
                })}
                ${renderSliderControl({
                  id: 'deepSecondaryLines',
                  label: 'Reframe / Written Prayer Lines',
                  sublabel: 'Closing truth anchor or written prayer section',
                  key: 'deepSecondaryLines',
                  min: 2,
                  max: 12,
                  val: cfg.deepSecondaryLines ?? 5,
                  unit: 'lines'
                })}
              </div>
            `
            : ''
        }

        <div class="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label class="text-[11px] font-semibold lh-text-sec block mb-1">Line Rule Style</label>
            <select onchange="window.Lighthouse.updatePdfConfig('lineStyle', this.value)" class="w-full px-2.5 py-1.5 rounded-xl lh-input text-xs">
              <option value="ruled" ${cfg.lineStyle === 'ruled' ? 'selected' : ''}>Solid Ruled Lines</option>
              <option value="dotted" ${cfg.lineStyle === 'dotted' ? 'selected' : ''}>Dashed Guide Lines</option>
              <option value="boxed" ${cfg.lineStyle === 'boxed' ? 'selected' : ''}>Dot-Grid Box</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] font-semibold lh-text-sec block mb-1">Bible Study Lens</label>
            <select onchange="window.Lighthouse.updatePdfConfig('bibleVersion', this.value)" class="w-full px-2.5 py-1.5 rounded-xl lh-input text-xs">
              <option value="BOTH" ${cfg.bibleVersion === 'BOTH' ? 'selected' : ''}>Both NASB &amp; NLT</option>
              <option value="NASB" ${cfg.bibleVersion === 'NASB' ? 'selected' : ''}>NASB Only</option>
              <option value="NLT" ${cfg.bibleVersion === 'NLT' ? 'selected' : ''}>NLT Only</option>
            </select>
          </div>
        </div>
      </div>

      <div class="p-3.5 rounded-2xl lh-elevated space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-xs uppercase tracking-wider" style="color: var(--accent-primary);">3. Captain’s Log Methods to Include</h4>
          <input type="checkbox" ${cfg.includeCaptainsLog ? 'checked' : ''}
            onchange="window.Lighthouse.updatePdfConfig('includeCaptainsLog', this.checked)" class="w-4 h-4" />
        </div>
        <div class="space-y-1.5">
          ${journalCatalog
            .map((j) => {
              const checked = modes.includes(j.id);
              return `
                <label class="flex items-center gap-2.5 p-2 rounded-xl lh-surface cursor-pointer text-xs">
                  <input type="checkbox" ${checked ? 'checked' : ''}
                    onchange="window.Lighthouse.togglePdfJournalMode('${j.id}')" class="w-4 h-4 shrink-0" />
                  <span class="lh-text-main font-medium">${escapeHtml(j.label)}</span>
                </label>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="p-3.5 rounded-2xl lh-elevated space-y-2.5">
        <h4 class="font-bold text-xs uppercase tracking-wider" style="color: var(--accent-primary);">4. Night Watch &amp; Prayer Sections</h4>
        <label class="flex items-center justify-between p-2 rounded-xl lh-surface cursor-pointer text-xs">
          <span class="font-medium lh-text-main">Include Section I: Night Watch Checklist</span>
          <input type="checkbox" ${cfg.includeNightPlan ? 'checked' : ''}
            onchange="window.Lighthouse.updatePdfConfig('includeNightPlan', this.checked)" class="w-4 h-4" />
        </label>
        <label class="flex items-center justify-between p-2 rounded-xl lh-surface cursor-pointer text-xs">
          <span class="font-medium lh-text-main">Include Section II: Active Intercession Deck</span>
          <input type="checkbox" ${cfg.includePrayerDeck ? 'checked' : ''}
            onchange="window.Lighthouse.updatePdfConfig('includePrayerDeck', this.checked)" class="w-4 h-4" />
        </label>
        <div>
          <label class="text-[11px] font-semibold lh-text-sec block mb-1">Guided Prayer Method Box</label>
          <select onchange="window.Lighthouse.updatePdfConfig('guidedPrayerMethod', this.value)" class="w-full px-2.5 py-1.5 rounded-xl lh-input text-xs">
            <option value="PRAY" ${cfg.guidedPrayerMethod === 'PRAY' ? 'selected' : ''}>Lectio 365 P.R.A.Y. Flow</option>
            <option value="LORDS_PRAYER" ${cfg.guidedPrayerMethod === 'LORDS_PRAYER' ? 'selected' : ''}>Lord’s Prayer 6-Petition Walk</option>
            <option value="NONE" ${cfg.guidedPrayerMethod === 'NONE' ? 'selected' : ''}>None</option>
          </select>
        </div>
      </div>
    </div>

    <div class="${mobPane === 'controls' ? 'hidden lg:block' : 'block'} lg:col-span-7 bg-slate-900/95 p-3 sm:p-6 overflow-y-auto max-h-[82vh]">
      <div class="flex items-center justify-between mb-3 text-xs text-slate-300">
        <span class="font-semibold flex items-center gap-1.5">
          <i data-lucide="file-check" class="w-4 h-4 text-emerald-400"></i>
          Live 8.5" × 11" Ink-Saver Binder Preview
        </span>
        <span class="font-mono-code text-[11px] text-amber-300">
          ${cfg.pageTarget === '2page' ? 'Page 1: Plan & Prayer • Page 2: Captain’s Log' : cfg.pageTarget === 'log_only' ? '1 Page: Captain’s Log Only' : '1 Page Condensed'}
        </span>
      </div>
      <div id="pdf-live-paper-preview" class="overflow-x-auto pb-8">
        ${buildPrintableBinderSheetHtml()}
      </div>
    </div>
  `;
}

// =========================================================================
// ICS DATE PARSER & AUTO-SYNC SCHEDULER
// =========================================================================
function parseIcsDateValue(rawVal) {
  if (!rawVal) return null;
  const cleaned = rawVal.trim();
  if (/^\d{8}$/.test(cleaned)) {
    const y = Number(cleaned.slice(0, 4));
    const m = Number(cleaned.slice(4, 6));
    const d = Number(cleaned.slice(6, 8));
    return {
      date: new Date(y, m - 1, d, 8, 0, 0),
      dateStr: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`,
      isAllDay: true
    };
  }
  const dtMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dtMatch) {
    const [, yy, mm, dd, hh, mi, ss, isUtc] = dtMatch;
    const dt = isUtc
      ? new Date(Date.UTC(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)))
      : new Date(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { date: dt, dateStr, isAllDay: false };
  }
  return null;
}

function formatDateObjIso(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function maybeRunBackgroundGcalSync(minAgeMs = null) {
  if (state.settings.gcalAutoSyncEnabled === false) return;
  if (gcalSyncInFlight) return;
  const sess = readGcalSession();
  if (!sess?.token) return;

  const intervalMs = (Number(state.settings.gcalAutoSyncMins) || 15) * 60 * 1000;
  const threshold = minAgeMs !== null ? minAgeMs : intervalMs;
  if (Date.now() - (sess.lastFetchedAt || 0) >= threshold) {
    sharedActions.fetchLiveGoogleEvents(sess.token, { silent: true });
  }
}

function startGcalAutoSyncLoop() {
  if (autoSyncTimerId) clearInterval(autoSyncTimerId);
  // Check every 60 seconds whether the active session is due for a background refresh
  autoSyncTimerId = setInterval(() => {
    maybeRunBackgroundGcalSync();
    // Refresh countdown badge in header/Watchtower without full page flicker if session expired
    const sess = readGcalSession();
    if (!sess && document.getElementById('header-gcal-btn')?.className.includes('lh-badge-success')) {
      renderApp();
    }
  }, 60000);
}

// =========================================================================
// SHARED GLOBAL ACTIONS (AVAILABLE ON ALL 3 HTML PAGES)
// =========================================================================
const sharedActions = {
  setTab(rawTabId) {
    const tabId = rawTabId === 'watchtower' ? 'calendar' : rawTabId;
    const targetStation = NAV_STATIONS.find((s) => s.id === tabId) || NAV_STATIONS[0];

    state.activeTab = targetStation.id;
    saveState();

    if (targetStation.page !== currentPage) {
      window.location.href = `${targetStation.page}?tab=${encodeURIComponent(targetStation.id)}`;
      return;
    }

    const nextUrl = `${currentPage}?tab=${encodeURIComponent(targetStation.id)}`;
    if (window.location.search !== `?tab=${encodeURIComponent(targetStation.id)}`) {
      window.history.pushState({ tab: targetStation.id }, '', nextUrl);
    }
    renderApp();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toggleMobileDrawer(open) {
    const el = document.getElementById('mobile-drawer');
    if (!el) return;
    el.classList.toggle('hidden', !open);
    el.classList.toggle('flex', open);
  },

  updateSetting(key, val) {
    state.settings[key] = val;
    saveState();
  },

  closeDetailModal,

  // Analog Night Watch & 3-Hole Binder PDF Studio
  openPdfBuilder() {
    state.pdfConfig = {
      ...structuredClone(INITIAL_STATE.pdfConfig),
      ...(state.pdfConfig || {}),
      sheetDate: getLocalIsoDate(0)
    };
    const modal = document.getElementById('pdf-builder-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderPdfBuilderModalContent();
    if (window.lucide) window.lucide.createIcons();
  },

  closePdfBuilder() {
    const modal = document.getElementById('pdf-builder-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  setPdfMobilePane(pane) {
    state.pdfConfig.mobilePane = pane;
    renderPdfBuilderModalContent();
    if (window.lucide) window.lucide.createIcons();
  },

  updatePdfConfig(key, val) {
    state.pdfConfig = { ...structuredClone(INITIAL_STATE.pdfConfig), ...(state.pdfConfig || {}) };
    state.pdfConfig[key] = val;
    saveState();
    renderPdfBuilderModalContent();
    if (window.lucide) window.lucide.createIcons();
  },

  liveSlidePdfConfig(key, id, rawVal, unit = 'lines') {
    const num = Number(rawVal);
    state.pdfConfig[key] = num;
    const badge = document.getElementById(`slider-badge-${id}`);
    if (badge) badge.textContent = `${num} ${unit}`;
    const preview = document.getElementById('pdf-live-paper-preview');
    if (preview) preview.innerHTML = buildPrintableBinderSheetHtml();
    saveState();
  },

  stepPdfSlider(key, delta, min, max) {
    const cur = Number(state.pdfConfig?.[key] ?? min);
    const next = Math.min(max, Math.max(min, cur + delta));
    state.pdfConfig[key] = next;
    saveState();
    renderPdfBuilderModalContent();
    if (window.lucide) window.lucide.createIcons();
  },

  applyPdfLinePreset(preset) {
    if (preset === 'compact') {
      Object.assign(state.pdfConfig, {
        lineHeightPx: 20,
        prayerNoteLines: 1,
        winsLines: 3,
        lessonsLines: 2,
        intentionLines: 2,
        examenStepLines: 2,
        baylorTaskRows: 6,
        baylorAnchorLines: 2,
        deepPrimaryLines: 5,
        deepSecondaryLines: 3
      });
    } else if (preset === 'balanced') {
      Object.assign(state.pdfConfig, {
        lineHeightPx: 24,
        prayerNoteLines: 1,
        winsLines: 6,
        lessonsLines: 4,
        intentionLines: 3,
        examenStepLines: 4,
        baylorTaskRows: 8,
        baylorAnchorLines: 3,
        deepPrimaryLines: 8,
        deepSecondaryLines: 5
      });
    } else if (preset === 'deep') {
      Object.assign(state.pdfConfig, {
        lineHeightPx: 27,
        prayerNoteLines: 2,
        winsLines: 9,
        lessonsLines: 6,
        intentionLines: 4,
        examenStepLines: 6,
        baylorTaskRows: 10,
        baylorAnchorLines: 4,
        deepPrimaryLines: 12,
        deepSecondaryLines: 7
      });
    }
    saveState();
    renderPdfBuilderModalContent();
    if (window.lucide) window.lucide.createIcons();
    showToast(`Applied "${preset}" line-count preset!`);
  },

  togglePdfNightCard(cardId, fromCardButton = false) {
    if (!state.pdfConfig) state.pdfConfig = structuredClone(INITIAL_STATE.pdfConfig);
    const cur = state.pdfConfig.selectedNightCardIds || [];
    const exists = cur.includes(cardId);
    state.pdfConfig.selectedNightCardIds = exists ? cur.filter((id) => id !== cardId) : [...cur, cardId];
    saveState();
    if (fromCardButton) {
      renderApp();
      showToast(exists ? 'Removed from Printable Night Sheet.' : 'Added to Printable Night Sheet!');
    } else {
      renderPdfBuilderModalContent();
    }
  },

  syncPdfNightCardsFromBoard() {
    if (!state.pdfConfig) state.pdfConfig = structuredClone(INITIAL_STATE.pdfConfig);
    state.pdfConfig.selectedNightCardIds = [...(state.nightBoardIds || [])];
    saveState();
    renderPdfBuilderModalContent();
    showToast('Synced Night Watch Board cards to printable sheet!');
  },

  togglePdfJournalMode(modeId, fromPill = false) {
    if (!state.pdfConfig) state.pdfConfig = structuredClone(INITIAL_STATE.pdfConfig);
    const cur = state.pdfConfig.selectedJournalModes || [];
    const exists = cur.includes(modeId);
    state.pdfConfig.selectedJournalModes = exists ? cur.filter((id) => id !== modeId) : [...cur, modeId];
    saveState();
    if (fromPill) {
      renderApp();
      showToast(exists ? 'Removed journal method from Print Sheet.' : 'Added journal method to Print Sheet!');
    } else {
      renderPdfBuilderModalContent();
      if (window.lucide) window.lucide.createIcons();
    }
  },

  togglePdfJesusTheme(themeId, fromCard = false) {
    if (!state.pdfConfig) state.pdfConfig = structuredClone(INITIAL_STATE.pdfConfig);
    const cur = state.pdfConfig.selectedJesusThemeIds || [];
    const exists = cur.includes(themeId);
    state.pdfConfig.selectedJesusThemeIds = exists ? cur.filter((id) => id !== themeId) : [...cur, themeId];
    saveState();
    if (fromCard) {
      renderApp();
      showToast(exists ? 'Removed teaching from PDF.' : 'Added Jesus’s teaching to PDF!');
    } else {
      renderPdfBuilderModalContent();
    }
  },

  async downloadNightBinderPdf() {
    const element = document.getElementById('printable-binder-document');
    if (!element) return;
    if (typeof window.html2pdf !== 'function') {
      return this.triggerNativePrint();
    }
    showToast('Generating Ink-Saver 3-Hole Binder PDF...');
    const dateStr = state.pdfConfig?.sheetDate || getLocalIsoDate(0);
    const opt = {
      margin: [0.15, 0.15, 0.15, 0.15],
      filename: `Lighthouse-Night-Binder-${dateStr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.avoid-break' }
    };
    try {
      await window.html2pdf().set(opt).from(element).save();
      showToast('Downloaded Lighthouse-Night-Binder PDF!');
    } catch {
      this.triggerNativePrint();
    }
  },

  triggerNativePrint() {
    const mount = document.getElementById('print-mount');
    if (!mount) return;
    mount.innerHTML = buildPrintableBinderSheetHtml();
    window.print();
  },

  // =========================================================================
  // GOOGLE CALENDAR SYNC (APPROACH 1: CLIENT-SIDE SESSION + AUTO-SYNC)
  // =========================================================================
  updateGcalAutoSync(enabled, mins) {
    if (enabled !== null && enabled !== undefined) {
      state.settings.gcalAutoSyncEnabled = Boolean(enabled);
    }
    if (mins !== null && mins !== undefined && !Number.isNaN(Number(mins))) {
      state.settings.gcalAutoSyncMins = Number(mins);
    }
    saveState();
    renderApp();
    showToast(
      state.settings.gcalAutoSyncEnabled
        ? `Auto-sync active: every ${state.settings.gcalAutoSyncMins} mins while signed in.`
        : 'Google Calendar auto-sync paused.'
    );
  },

  // One-tap sync button (used directly on Watchtower screen and top header)
  async syncGcalQuick() {
    if (gcalSyncInFlight) return;
    const sess = readGcalSession();
    if (sess?.token) {
      await this.fetchLiveGoogleEvents(sess.token, { silent: false });
      return;
    }
    // No active session token yet — launch OAuth popup directly without opening the settings modal first
    await this.connectGoogleOAuth();
  },

  openGcalModal() {
    const modal = document.getElementById('gcal-modal');
    if (!modal) return;
    const input = document.getElementById('input-gcal-client-id');
    const toggle = document.getElementById('toggle-gcal-readonly');
    const autoToggle = document.getElementById('toggle-gcal-autosync');
    const intervalSel = document.getElementById('select-gcal-interval');
    const originEl = document.getElementById('gcal-current-origin');
    const badge = document.getElementById('gcal-token-badge');

    if (!state.settings.gcalClientId) {
      state.settings.gcalClientId = INITIAL_STATE.settings.gcalClientId;
    }
    if (input) input.value = state.settings.gcalClientId;
    if (toggle) toggle.checked = state.settings.gcalReadOnlyScope !== false;
    if (autoToggle) autoToggle.checked = state.settings.gcalAutoSyncEnabled !== false;
    if (intervalSel) intervalSel.value = String(state.settings.gcalAutoSyncMins || 15);
    if (originEl) originEl.textContent = window.location.origin;

    const status = getGcalSessionStatus();
    if (badge) {
      badge.textContent = status.hasToken
        ? `Session Active (${status.expiresInMins}m left)`
        : 'Client ID Pre-Loaded';
    }

    this.renderGcalDiagnostics();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  },

  closeGcalModal() {
    const modal = document.getElementById('gcal-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  clearGcalEvents() {
    clearGcalSession();
    state.gcalEvents = [];
    state.settings.lastGcalSync = 'Cleared (Not synced)';
    state.settings.lastCalendarSummary = [];
    saveState();
    renderApp();
    this.renderGcalDiagnostics(
      '<span class="lh-text-sec font-medium">Cleared all cached calendar events &amp; session token. Click "Sign In &amp; Sync" to pull fresh events.</span>'
    );
    showToast('Cleared cached calendar events!');
  },

  showOriginCopied() {
    showToast(`Copied origin: ${window.location.origin}`);
  },

  quickMuteEventTitle(title) {
    const clean = (title || '').trim().toLowerCase();
    if (!clean) return;
    state.settings.wifeFilterKeywords = Array.from(new Set([...(state.settings.wifeFilterKeywords || []), clean]));
    saveState();
    renderApp();
    showToast(`Muted "${title}" via Fog Filter!`);
  },

  renderGcalDiagnostics(statusHtml = '') {
    const box = document.getElementById('gcal-sync-diagnostics');
    if (!box) return;
    const summary = state.settings.lastCalendarSummary || [];
    if (!statusHtml && summary.length === 0) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = `
      ${statusHtml ? `<div class="pb-1.5 border-b lh-border">${statusHtml}</div>` : ''}
      ${
        summary.length > 0
          ? `<div class="space-y-1 pt-1">
              <span class="text-[10px] font-bold uppercase tracking-wider lh-text-sec block">Last Synced Calendars (${escapeHtml(state.settings.lastGcalSync || 'Live')}):</span>
              ${summary
                .map(
                  (c) => `
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="font-medium lh-text-main truncate">${escapeHtml(c.label)}</span>
                    <span class="font-mono-code px-1.5 py-0.5 rounded lh-elevated lh-text-sec shrink-0">${c.count} events</span>
                  </div>
                `
                )
                .join('')}
            </div>`
          : ''
      }
    `;
  },

  async connectGoogleOAuth() {
    const inputEl = document.getElementById('input-gcal-client-id');
    if (inputEl && inputEl.value.trim()) {
      state.settings.gcalClientId = inputEl.value.trim();
      saveState();
    }
    const clientId = (state.settings.gcalClientId || INITIAL_STATE.settings.gcalClientId).trim();
    if (!clientId) return showToast('Paste your Google Web OAuth Client ID first.');
    const scope =
      state.settings.gcalReadOnlyScope !== false
        ? 'https://www.googleapis.com/auth/calendar.readonly'
        : 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

    try {
      this.renderGcalDiagnostics('<span class="text-amber-400 font-semibold">Opening Google Sign-In window...</span>');
      if (!window.google?.accounts?.oauth2) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: async (resp) => {
          if (resp?.error) {
            this.renderGcalDiagnostics(
              `<span class="text-rose-400 font-bold">OAuth Error: ${escapeHtml(resp.error)}</span>
               <p class="text-[11px] lh-text-sec mt-1">Make sure <strong>${escapeHtml(window.location.origin)}</strong> is added under "Authorized JavaScript origins" in Google Cloud Console, and your email is added under "Test users".</p>`
            );
            return showToast(`Google OAuth error: ${resp.error}`);
          }
          if (resp?.access_token) {
            writeGcalSession(resp.access_token, resp.expires_in || 3500, 0);
            const badge = document.getElementById('gcal-token-badge');
            if (badge) badge.textContent = 'Connected (Auto-Sync Active)';
            await this.fetchLiveGoogleEvents(resp.access_token, { silent: false });
          }
        }
      });
      client.requestAccessToken({ prompt: '' });
    } catch (err) {
      this.renderGcalDiagnostics(
        `<span class="text-rose-400 font-bold">Could not load Google OAuth client: ${escapeHtml(err?.message || 'Check connection')}</span>`
      );
      showToast('Could not start Google OAuth flow.');
    }
  },

  async fetchLiveGoogleEvents(token, { silent = false } = {}) {
    if (gcalSyncInFlight) return;
    gcalSyncInFlight = true;
    renderNavigation();

    try {
      if (!silent) {
        this.renderGcalDiagnostics('<span class="text-amber-400 font-semibold">Fetching Primary, Family &amp; Regla’s shared calendars...</span>');
      }
      const listRes = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?showHidden=true&minAccessRole=freeBusyReader',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const listData = await listRes.json();

      if (listRes.status === 401) {
        clearGcalSession();
        if (!silent) {
          this.renderGcalDiagnostics(
            '<span class="text-amber-400 font-semibold">Google session expired. Click Sync again to sign back in.</span>'
          );
          showToast('Google Calendar session expired — tap Sync GCal to reconnect.');
        }
        return;
      }

      if (!listRes.ok) {
        const apiMsg = listData?.error?.message || `HTTP ${listRes.status}`;
        if (!silent) {
          this.renderGcalDiagnostics(
            `<span class="text-rose-400 font-bold">Google Calendar API Error: ${escapeHtml(apiMsg)}</span>
             <p class="text-[11px] lh-text-sec mt-1">Ensure the <strong>Google Calendar API</strong> is enabled in your Google Cloud project (APIs &amp; Services → Library → Google Calendar API → Enable).</p>`
          );
          showToast(`Calendar API Error: ${apiMsg}`);
        }
        return;
      }

      const discovered = Array.isArray(listData.items) ? listData.items : [];
      const knownFallbacks = [
        { id: 'primary', summary: 'Primary (Dan)', primary: true },
        { id: 'regla317@gmail.com', summary: 'Regla (regla317)' },
        { id: 'reglaschuler@gmail.com', summary: 'Regla (reglaschuler)' },
        { id: 'family13652773781709440206@group.calendar.google.com', summary: 'Family Calendar' }
      ];

      const seenIds = new Set();
      const calendarsToQuery = [];

      for (const cal of [...discovered, ...knownFallbacks]) {
        if (!cal?.id) continue;
        if (
          cal.id.includes('#holiday@') ||
          cal.id.includes('#weather@') ||
          cal.id.includes('#sports@') ||
          cal.id.includes('#contacts@')
        ) {
          continue;
        }
        const normId = cal.primary ? 'primary' : cal.id.toLowerCase();
        if (cal.primary) seenIds.add((cal.id || '').toLowerCase());
        if (seenIds.has(normId)) continue;
        seenIds.add(normId);
        calendarsToQuery.push(cal);
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endHorizon = new Date(startOfToday.getTime() + 14 * 86400000);
      const events = [];
      const calendarSummary = [];

      const parseLocalDateOnly = (isoDate) => {
        const [y, m, d] = isoDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      };

      for (const cal of calendarsToQuery) {
        const params = new URLSearchParams({
          timeMin: startOfToday.toISOString(),
          timeMax: endHorizon.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100'
        });
        const evRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!evRes.ok) continue;
        const evData = await evRes.json();

        const rawName = `${cal.summaryOverride || ''} ${cal.summary || ''} ${cal.id || ''}`.toLowerCase();
        const isWife = rawName.includes('regla') || rawName.includes('wife');
        const isFamily = rawName.includes('family');
        const calLabel = isWife
          ? `Wife Shared (${cal.summaryOverride || cal.summary || cal.id.split('@')[0]})`
          : isFamily
          ? 'Family Calendar'
          : cal.primary || rawName.includes('schuler314')
          ? 'Primary (Dan)'
          : cal.summaryOverride || cal.summary || cal.id;

        let calEventCount = 0;

        for (const item of evData.items || []) {
          if (item.status === 'cancelled') continue;

          if (item.start?.date && !item.start?.dateTime) {
            const startDay = parseLocalDateOnly(item.start.date);
            const endExclusive = item.end?.date
              ? parseLocalDateOnly(item.end.date)
              : new Date(startDay.getTime() + 86400000);

            const cursor = new Date(Math.max(startDay.getTime(), startOfToday.getTime()));
            while (cursor < endExclusive && cursor < endHorizon) {
              const dateStr = formatDateObjIso(cursor);
              const dayOffset = getDayOffsetFromIsoDate(dateStr);
              if (dayOffset !== null && dayOffset >= 0) {
                events.push({
                  id: `gcal-${cal.id}-${item.id}-${dateStr}`,
                  dayOffset,
                  dateStr,
                  startTime: '08:00',
                  endTime: 'All Day',
                  title: item.summary || '(Busy / No Title)',
                  calendar: calLabel,
                  isSoloReminder: false,
                  location: item.location || ''
                });
                calEventCount++;
              }
              cursor.setDate(cursor.getDate() + 1);
            }
            continue;
          }

          if (item.start?.dateTime) {
            const startD = new Date(item.start.dateTime);
            const endD = item.end?.dateTime ? new Date(item.end.dateTime) : startD;
            if (endD < startOfToday) continue;

            const dateStr = formatDateObjIso(startD);
            const dayOffset = getDayOffsetFromIsoDate(dateStr);
            if (dayOffset === null || dayOffset < 0) continue;

            events.push({
              id: `gcal-${cal.id}-${item.id}`,
              dayOffset,
              dateStr,
              startTime: startD.toTimeString().slice(0, 5),
              endTime: endD.toTimeString().slice(0, 5),
              title: item.summary || '(Busy / No Title)',
              calendar: calLabel,
              isSoloReminder: false,
              location: item.location || ''
            });
            calEventCount++;
          }
        }

        calendarSummary.push({ label: calLabel, count: calEventCount });
      }

      events.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.startTime.localeCompare(b.startTime));
      state.gcalEvents = events;
      state.settings.lastGcalSync = `Live Sync • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      state.settings.lastCalendarSummary = calendarSummary;
      touchGcalSessionFetchTime();
      saveState();

      if (!silent) {
        this.renderGcalDiagnostics(
          `<span style="color: var(--success-accent);" class="font-bold">✓ Synced ${events.length} upcoming events across ${calendarSummary.length} calendars!</span>`
        );
        showToast(`Synced ${events.length} live events across your & Regla’s calendars!`);
      }
    } catch (err) {
      if (!silent) {
        this.renderGcalDiagnostics(
          `<span class="text-rose-400 font-bold">Sync Exception: ${escapeHtml(err?.message || 'Unknown error')}</span>`
        );
        showToast('Error fetching live Google Calendar events.');
      }
    } finally {
      gcalSyncInFlight = false;
      renderApp();
    }
  },

  handleIcsUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target.result || '';
      const chunks = raw.split('BEGIN:VEVENT').slice(1);
      const parsed = [];
      chunks.forEach((chunk, idx) => {
        const getLine = (k) => {
          const m = chunk.match(new RegExp(`^${k}[^:]*:(.*)$`, 'm'));
          return m ? m[1].trim() : '';
        };
        const summary = getLine('SUMMARY');
        const startParsed = parseIcsDateValue(getLine('DTSTART'));
        const endParsed = parseIcsDateValue(getLine('DTEND'));
        if (!summary || !startParsed) return;

        const dayOffset = getDayOffsetFromIsoDate(startParsed.dateStr);
        if (dayOffset === null || dayOffset < 0 || dayOffset > 30) return;

        parsed.push({
          id: `ics-${Date.now()}-${idx}`,
          dayOffset,
          dateStr: startParsed.dateStr,
          startTime: startParsed.isAllDay ? '08:00' : startParsed.date.toTimeString().slice(0, 5),
          endTime: startParsed.isAllDay
            ? 'All Day'
            : endParsed
            ? endParsed.date.toTimeString().slice(0, 5)
            : '10:00',
          title: summary,
          calendar: 'Imported .ICS',
          isSoloReminder: false,
          location: getLine('LOCATION')
        });
      });

      parsed.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.startTime.localeCompare(b.startTime));
      state.gcalEvents = parsed;
      state.settings.lastGcalSync = `.ICS Import • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      state.settings.lastCalendarSummary = [{ label: 'Imported .ICS', count: parsed.length }];
      saveState();
      renderApp();
      this.closeGcalModal();
      showToast(
        parsed.length > 0
          ? `Imported ${parsed.length} upcoming events from .ICS file!`
          : 'No upcoming events (next 30 days) found in that .ICS file.'
      );
    };
    reader.readAsText(file);
  }
};

// =========================================================================
// PAGE BOOTSTRAPPER (CALLED BY index.html, sanctuary.html, command.html)
// =========================================================================
export function initLighthousePage({ page, defaultTab, renderers, actions = {} }) {
  currentPage = page;
  currentDefaultTab = defaultTab;
  pageRenderers = renderers || {};

  window.Lighthouse = {
    ...sharedActions,
    ...actions
  };

  const urlTabRaw = new URLSearchParams(window.location.search).get('tab');
  const urlTab = urlTabRaw === 'watchtower' ? 'calendar' : urlTabRaw;
  if (urlTab && pageRenderers[urlTab]) {
    state.activeTab = urlTab;
  } else if (!pageRenderers[state.activeTab]) {
    state.activeTab = defaultTab;
  }

  const boot = () => {
    mountAppShell();
    if (stateMigratedOnLoad) {
      saveState();
      stateMigratedOnLoad = false;
    }
    renderApp();
    hydrateFromSupabaseOnLoad();
    startGcalAutoSyncLoop();
    // If an active Google session exists and is due for refresh, sync silently in the background
    maybeRunBackgroundGcalSync();
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('popstate', () => {
    const param = new URLSearchParams(window.location.search).get('tab');
    const resolved = param === 'watchtower' ? 'calendar' : param;
    state.activeTab = resolved && pageRenderers[resolved] ? resolved : defaultTab;
    renderApp();
  });

  // Auto-refresh date after midnight and auto-sync GCal when returning to the tab (if >= 5 mins stale)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (getLocalIsoDate(0) !== lastRenderedIsoDate) {
        renderApp();
      }
      maybeRunBackgroundGcalSync(5 * 60 * 1000);
    }
  });

  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY && ev.newValue) {
      try {
        const merged = buildMergedState(JSON.parse(ev.newValue));
        merged.activeTab = pageRenderers[state.activeTab] ? state.activeTab : defaultTab;
        Object.assign(state, merged);
        renderApp();
      } catch {
        // Ignore malformed external storage
      }
    }
  });
}
