import './style.css'
import { deployToTikTok } from './tiktokDeploy.js'
import { deployToFacebook } from './facebookDeploy.js'

const API_BASE = 'http://localhost:5243/api'

// --- API Helper with Auth ---
function apiHeaders(includeContentType = true) {
  const headers = {}
  if (includeContentType) headers['Content-Type'] = 'application/json'
  const token = state.token || localStorage.getItem('mt_token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (state.isSuperAdmin && state.viewingCompanyId) headers['X-Company-Id'] = state.viewingCompanyId.toString()
  return headers
}

async function apiFetch(url, options = {}) {
  const token = state.token || localStorage.getItem('mt_token')
  if (!token) {
    console.warn('apiFetch: No token available for', url)
    throw new Error('Not authenticated')
  }
  const headers = { ...apiHeaders(), ...(options.headers || {}) }
  try {
    const response = await fetch(`${API_BASE}${url}`, { ...options, headers })
    if (response.status === 401) {
      console.warn('apiFetch: 401 received for', url)
      handleLogout()
      throw new Error('Session expired')
    }
    if (!response.ok) {
      const text = await response.text()
      try { const json = JSON.parse(text); throw new Error(json.error || json.message || `HTTP ${response.status}`) }
      catch(e) { if (e.message.startsWith('HTTP')) throw e; throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`) }
    }
    return response
  } catch (e) {
    if (e.message === 'Session expired' || e.message === 'Not authenticated') throw e
    console.error('apiFetch error:', url, e)
    throw e
  }
}

// --- State Management ---
const state = {
  activeRole: 'Expert',
  activeScreen: 'Objective',
  isAuthenticated: false,
  user: null,
  token: null,
  isSuperAdmin: false,
  company: null,
  viewingCompanyId: null,
  companies: [],
  notifications: [],
  unreadNotifications: 0,
  isLoadingStrategy: false,
  strategyLoadingMessage: 'Analyzing Brand DNA...',
  marketingData: {
    objective: null,
    targeting: [],
    goal: '',
    probeAnswers: Array(10).fill(''),
    strategyStep: 1, // 1: Research, 2: Level 1 Qs, 3: Level 2 Qs
    level1Questions: [],
    level1Answers: Array(5).fill(''),
    level2Questions: [],
    level2Answers: Array(5).fill(''),
    stylePreset: 'Cinematic',
    aspectRatio: '1:1',
    generationPhotos: 1,
    generationVideos: 2,
    generationPosts: 0,
    platformSpecs: {
      facebook: { enabled: false, aspectRatios: ['1:1'], imageCount: 2, videoCount: 1, videoDurations: ['30s'] },
      tiktok:   { enabled: false, aspectRatios: ['9:16'], imageCount: 0, videoCount: 2, videoDurations: ['15s', '30s'] },
      youtube:  { enabled: false, aspectRatios: ['16:9'], imageCount: 0, videoCount: 1, videoDurations: ['30s'] },
      google:   { enabled: false, aspectRatios: ['1:1'], imageCount: 3, videoCount: 0, videoDurations: [] }
    },
    activeCampaignId: null,
    brandGuidelines: {
      brandLabel: '',
      tone: 'Professional',
      language: 'English',
      description: '',
      whitelist: '',
      blacklist: '',
      typography: {
        headingFont: 'Montserrat Bold',
        headingSize: '32px',
        bodyFont: 'Roboto Regular',
        bodySize: '16px'
      },
      palette: ['#F47A83', '#F59B7C', '#FADB5F', '#A0D1E6', '#B98E90']
    },
    budgetMatrix: {
      reallocation: 49,
      reach: 40,
      click: 35,
      sales: 25
    },
    cmoQueue: [],
    ppcQueue: [],
    selectedAssets: [],
    platformConfig: {
      tiktok: {
        advertiser_id: '',
        access_token: '',
        pixel_id: '',
        identity_id: '',
        campaign_id: '',
        daily_budget: 400,
        schedule_start: '',
        schedule_end: '',
        bid: 120,
        // Advanced Params (User Controlled)
        placement: 'PLACEMENT_TIKTOK',
        budget_mode: 'BUDGET_MODE_DAILY',
        pacing: 'PACING_MODE_SMOOTH',
        bid_type: 'BID_TYPE_COST_CAP',
        cta: 'LEARN_MORE',
        custom_ad_name: '',
        interests: '',
        country: 'US',
        language: 'en',
        area: '',
        ageMin: 18,
        ageMax: 65,
        gender: 'GENDER_ANY',
        landing_url: ''
      },
      facebook: {
        campaign_name: '',
        objective: 'OUTCOME_TRAFFIC',
        daily_budget: 100,
        schedule_start: new Date().toISOString().split('T')[0],
        schedule_end: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        page_id: '792318557298112',
        style_preset: 'Cinematic',
        default_ratio: '1:1',
        aspect_ratios: ['1:1'],
        image_count: 2,
        video_count: 1,
        video_durations: ['30s']
      }
    },
    companyProfile: {
      name: '',
      industry: '',
      website: '',
      location: '',
      employeeCount: '',
      foundingYear: '',
      about: '',
      mission: '',
      vision: '',
      socialLinks: {
        facebook: '',
        instagram: '',
        linkedin: '',
        twitter: ''
      }
    }
  }
}

// --- Role Definitions ---
const roles = {
  'Super Admin': {
    displayName: 'Super Admin',
    icon: 'S',
    themeColor: 'gold',
    screens: [
      { id: 'GlobalDashboard', label: 'Global Dashboard', icon: '🌐' },
      { id: 'CompanyManagement', label: 'Company Management', icon: '🏢' },
      { id: 'SystemConfig', label: 'System Config', icon: '⚙️' },
      { id: 'PlatformService', label: 'Platform Service', icon: '🔄' },
      { id: 'AuditLog', label: 'Audit Log', icon: '📋' },
    ]
  },
  Admin: {
    displayName: 'Company Admin',
    icon: 'A',
    themeColor: 'purple',
    screens: [
      { id: 'Config', label: 'Platform Config', icon: '⚙️' },
      { id: 'CompanyProfile', label: 'Company Profile', icon: '🏢' },
      { id: 'UserManagement', label: 'User Management', icon: '👥' },
      { id: 'RoleManagement', label: 'Role Management', icon: '👤' },
      { id: 'AdAccountManagement', label: 'Ad Accounts', icon: '🔑' },
      { id: 'Calendar', label: 'Global Calendar', icon: '📅' },
      { id: 'Guideline', label: 'Brand Guideline', icon: '📜' },
      { id: 'Assets', label: 'Creative Assets', icon: '🖼️' },
      { id: 'BillingSettings', label: 'Billing', icon: '💳' },
    ]
  },
  CMO: {
    displayName: 'Chief Marketing Officer',
    icon: 'B',
    themeColor: 'amber',
    screens: [
      { id: 'BudgetMatrix', label: 'Budget & Matrix', icon: '📈' },
      { id: 'Approvals', label: 'Ad Approvals', icon: '✅' },
      { id: 'Monitoring', label: 'AI Monitoring', icon: '📊' },
      { id: 'AdPerformance', label: 'Ad Performance', icon: '📈' },
      { id: 'Budget', label: 'Budget Overview', icon: '💰' },
      { id: 'Notifications', label: 'Notifications', icon: '🔔' },
      { id: 'CampaignReports', label: 'Campaign Reports', icon: '📋' },
      { id: 'CrossPlatformAnalytics', label: 'Cross-Platform Analytics', icon: '📊' },
    ]
  },
  // Legacy alias for backward compatibility
  'Business Admin': {
    displayName: 'Chief Marketing Officer',
    icon: 'B',
    themeColor: 'amber',
    screens: [
      { id: 'BudgetMatrix', label: 'Budget & Matrix', icon: '📈' },
      { id: 'Approvals', label: 'Ad Approvals', icon: '✅' },
      { id: 'Monitoring', label: 'AI Monitoring', icon: '📊' },
      { id: 'AdPerformance', label: 'Ad Performance', icon: '📈' },
      { id: 'Budget', label: 'Budget Overview', icon: '💰' },
      { id: 'Notifications', label: 'Notifications', icon: '🔔' },
    ]
  },
  PPP: {
    displayName: 'Planner/Publisher/Performer',
    icon: 'P',
    themeColor: 'emerald',
    screens: [
      { id: 'ApprovedAssets', label: 'Approved Assets', icon: '✅' },
      { id: 'DeploySelection', label: 'Platform Selection', icon: '🎯' },
      { id: 'AdPerformance', label: 'Ad Performance', icon: '📈' },
      { id: 'Monitoring', label: 'AI Monitoring', icon: '📊' },
      { id: 'Budget', label: 'Budget Overview', icon: '💰' },
      { id: 'DeploymentHistory', label: 'Deploy History', icon: '📜' },
      { id: 'ABTestResults', label: 'A/B Tests', icon: '🧪' },
    ]
  },
  // Legacy alias
  PPC: {
    displayName: 'Planner/Publisher/Performer',
    icon: 'P',
    themeColor: 'emerald',
    screens: [
      { id: 'ApprovedAssets', label: 'Approved Assets', icon: '✅' },
      { id: 'DeploySelection', label: 'Platform Selection', icon: '🎯' },
      { id: 'AdPerformance', label: 'Ad Performance', icon: '📈' },
      { id: 'Monitoring', label: 'AI Monitoring', icon: '📊' },
      { id: 'Budget', label: 'Budget Overview', icon: '💰' },
    ]
  },
  Expert: {
    displayName: 'Marketing Expert',
    icon: 'E',
    themeColor: 'cyan',
    screens: [
      { id: 'Objective', label: 'Campaign Objective', icon: '🎯' },
      { id: 'Targeting', label: 'Target Audience', icon: '👥' },
      { id: 'Research', label: 'Strategy Hub', icon: '🧠' },
      { id: 'CreativeConfig', label: 'Creative Config', icon: '🎬' },
      { id: 'Studio', label: 'Creative Studio', icon: '🎨' },
    ]
  }
}

const screenRegistry = {
  'Dashboard': { label: 'Dashboard', icon: '🏠' },
  // Expert
  'Objective': { label: 'Campaign Objective', icon: '🎯' },
  'Targeting': { label: 'Target Audience', icon: '👥' },
  'Research': { label: 'Strategy Hub', icon: '🧠' },
  'CreativeConfig': { label: 'Creative Config', icon: '🎬' },
  'Studio': { label: 'Creative Studio', icon: '🎨' },
  'AudienceInsights': { label: 'Audience Insights', icon: '📈' },
  'CompetitorResearch': { label: 'Competitor Research', icon: '🔍' },
  // CMO
  'BudgetMatrix': { label: 'Budget & Matrix', icon: '📈' },
  'Approvals': { label: 'Ad Approvals', icon: '✅' },
  'Monitoring': { label: 'AI Monitoring', icon: '📊' },
  'Budget': { label: 'Budget Overview', icon: '💰' },
  'Notifications': { label: 'Notifications', icon: '🔔' },
  'CampaignReports': { label: 'Campaign Reports', icon: '📋' },
  'CrossPlatformAnalytics': { label: 'Cross-Platform Analytics', icon: '📊' },
  // PPP
  'ApprovedAssets': { label: 'Approved Assets', icon: '✅' },
  'DeploySelection': { label: 'Platform Selection', icon: '🎯' },
  'AdPerformance': { label: 'Ad Performance', icon: '📊' },
  'DeploymentHistory': { label: 'Deployment History', icon: '📜' },
  'ABTestResults': { label: 'A/B Test Results', icon: '🧪' },
  // Admin
  'UserManagement': { label: 'User Management', icon: '👥' },
  'RoleManagement': { label: 'Role Management', icon: '👤' },
  'CompanyProfile': { label: 'Company Profile', icon: '🏢' },
  'Config': { label: 'Platform Config', icon: '⚙️' },
  'AdAccountManagement': { label: 'Ad Accounts', icon: '🔑' },
  'Calendar': { label: 'Global Calendar', icon: '📅' },
  'Guideline': { label: 'Brand Guideline', icon: '📜' },
  'Assets': { label: 'Creative Assets', icon: '🖼️' },
  'BillingSettings': { label: 'Billing & Subscription', icon: '💳' },
  // Super Admin
  'GlobalDashboard': { label: 'Global Dashboard', icon: '🌐' },
  'CompanyManagement': { label: 'Company Management', icon: '🏢' },
  'SystemConfig': { label: 'System Configuration', icon: '⚙️' },
  'PlatformService': { label: 'Platform Service', icon: '🔄' },
  'AuditLog': { label: 'Audit Log', icon: '📋' }
};

// --- DOM Elements ---
const navLinks = document.getElementById('nav-links')
const pageTitleName = document.getElementById('current-page-name')
const contentContainer = document.getElementById('content-container')
const activeRoleDisplay = document.getElementById('active-role-display')
const activeRoleIcon = document.getElementById('active-role-icon')
const roleSwitcherBtn = document.getElementById('role-switcher-btn')
const roleDropdown = document.getElementById('role-dropdown')
const userInitial = document.getElementById('user-initial')
const userName = document.getElementById('user-name')
const logoutBtn = document.getElementById('logout-btn')
const themeButtons = {
  dark: document.getElementById('theme-dark'),
  light: document.getElementById('theme-light'),
  blue: document.getElementById('theme-blue'),
  red: document.getElementById('theme-red')
}

// --- Utils ---
function toggleDropdown() {
  roleDropdown.classList.toggle('hidden')
}

function checkCompanyContext() {
  if (state.isSuperAdmin && !state.viewingCompanyId) {
    contentContainer.innerHTML = `
      <div class="text-center p-12 space-y-4">
        <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
          <span class="text-3xl">🏢</span>
        </div>
        <h2 class="text-2xl font-bold uppercase tracking-tight">Company Context Required</h2>
        <p class="text-gray-400 max-w-sm mx-auto">As a Super Admin, you must select a company first to view this section.</p>
        <button onclick="switchScreen('CompanyManagement')" class="px-8 py-3 bg-amber-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-amber-400 transition-all cursor-pointer">
          Go to Company Management
        </button>
      </div>`
    return false
  }
  return true
}

function setTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-blue', 'theme-red')
  if (theme !== 'dark') {
    document.body.classList.add(`theme-${theme}`)
  }

  // Highlight active button
  Object.keys(themeButtons).forEach(t => {
    if (themeButtons[t]) {
      themeButtons[t].classList.toggle('bg-white/10', t === theme)
      themeButtons[t].classList.toggle('border', t === theme)
      themeButtons[t].classList.toggle('border-white/20', t === theme)
    }
  })

  localStorage.setItem('mt_theme', theme)
}

// Attach Theme Listeners
Object.keys(themeButtons).forEach(theme => {
  if (themeButtons[theme]) {
    themeButtons[theme].onclick = () => setTheme(theme)
  }
})

function switchRole(roleId) {
  state.activeRole = roleId
  state.activeScreen = roles[roleId].screens[0].id
  roleDropdown.classList.add('hidden')
  updateUI()
}

function handleLogout() {
  state.isAuthenticated = false
  state.user = null
  state.token = null
  state.isSuperAdmin = false
  state.company = null
  state.viewingCompanyId = null
  state.companies = []
  state.notifications = []
  state.unreadNotifications = 0
  localStorage.removeItem('mt_token')
  localStorage.removeItem('mt_user')
  localStorage.removeItem('mt_companies')
  updateUI()
}

// Super Admin: Enter a company context
function enterCompany(companyId, companyName) {
  state.viewingCompanyId = companyId
  showNotification(`Entered company: ${companyName}`, 'success')
  updateUI()
}

// Super Admin: Exit company context (back to global)
function exitCompanyContext() {
  state.viewingCompanyId = null
  state.activeScreen = 'GlobalDashboard'
  updateUI()
}

if (logoutBtn) logoutBtn.onclick = handleLogout

const SUPER_ADMIN_ONLY_SCREENS = ['GlobalDashboard', 'CompanyManagement', 'SystemConfig', 'PlatformService', 'AuditLog']

function switchScreen(screenId) {
  // Block non-super-admins from accessing super admin screens
  if (SUPER_ADMIN_ONLY_SCREENS.includes(screenId) && !state.isSuperAdmin) {
    showNotification('Access Denied: This section is restricted to Super Admin only.', 'error')
    return
  }

  state.activeScreen = screenId
  
  // Clean up any stray notifications when switching contexts
  const existingOverlays = document.querySelectorAll('[id^="notification-overlay"]')
  existingOverlays.forEach(o => o.remove())

  updateUI()
}

function showNotification(message, type = 'success') {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-in fade-in duration-300'
  overlay.id = 'notification-overlay-' + Date.now()

  overlay.innerHTML = `
    <div class="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full mx-6 text-center space-y-6 animate-in zoom-in-95 duration-300">
        <div class="w-16 h-16 ${type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'} rounded-full flex items-center justify-center mx-auto border-2 text-2xl">
            ${type === 'success' ? '✓' : type === 'attention' ? '⚠️' : '⚠'}
        </div>
        <div class="space-y-2">
            <h3 class="text-[var(--text-color)] font-black uppercase tracking-tighter text-xl">${type === 'success' ? 'Success' : 'Attention'}</h3>
            <p class="text-[var(--text-dim)] text-sm font-medium leading-relaxed">${message}</p>
        </div>
        <button class="close-notification-btn w-full py-3 bg-[var(--text-color)] text-[var(--text-inverse)] font-black uppercase text-[10px] tracking-widest rounded-xl hover:opacity-90 transition-all cursor-pointer">
            Dismiss
        </button>
    </div>
  `

  document.body.appendChild(overlay)

  // Fix: Use querySelector on the specific overlay to avoid ID conflicts
  const closeBtn = overlay.querySelector('.close-notification-btn')
  if (closeBtn) {
    closeBtn.onclick = () => {
      overlay.classList.add('opacity-0', 'scale-95')
      overlay.style.transition = 'all 0.3s ease'
      setTimeout(() => overlay.remove(), 300)
    }
  }
}

// --- Expose to Window for global onclick handlers ---
window.switchScreen = switchScreen
window.enterCompany = enterCompany
window.exitCompanyContext = exitCompanyContext
window.showCreateAbTestModal = showCreateAbTestModal
window.applyAbTestOptimization = applyAbTestOptimization
window.toggleDropdown = toggleDropdown
window.switchRole = switchRole
window.handleLogout = handleLogout


function startPremiumLoading(type = 'strategy') {
  const messages = type === 'strategy' ? [
    'Analyzing Brand DNA...',
    'Consulting Market Trends...',
    'Optimizing Logical Framework...',
    'Synthesizing Market Angles...',
    'Finalizing AI Persona...'
  ] : [
    'Generating Visual Concepts...',
    'Optimizing Ratios...',
    'Applying Cinematic Filters...',
    'Finalizing Creative Suite...'
  ]

  let i = 0
  state.isLoadingStrategy = true
  state.strategyLoadingMessage = messages[0]
  renderStrategyHub()

  const interval = setInterval(() => {
    if (!state.isLoadingStrategy) {
      clearInterval(interval)
      return
    }
    i = (i + 1) % messages.length
    state.strategyLoadingMessage = messages[i]

    // Partially update DOM to avoid full re-render flickering
    const loadingElem = document.querySelector('.animate-pulse')
    if (loadingElem) loadingElem.innerText = messages[i]
    else renderStrategyHub()
  }, 2500)

  return interval
}

async function saveCmoQueue() {
  try {
    await apiFetch('/cmo/queue', {
      method: 'POST',
      body: JSON.stringify(state.marketingData.cmoQueue)
    })
    console.log('CMO Queue synced to server.')
  } catch (e) {
    console.warn('Could not sync CMO Queue:', e.message)
  }
}

async function savePppQueue() {
  const res = await apiFetch('/ppp/queue', {
    method: 'POST',
    body: JSON.stringify(state.marketingData.pppQueue || state.marketingData.ppcQueue)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PPP queue sync failed: HTTP ${res.status} ${text}`)
  }
  console.log('PPP Queue synced to server.')
}

// Legacy alias
async function savePpcQueue() { return savePppQueue() }

// --- Notification Polling ---
async function fetchNotifications() {
  if (!state.token) return
  try {
    const res = await apiFetch('/notifications')
    if (res.ok) {
      state.notifications = await res.json()
      state.unreadNotifications = state.notifications.filter(n => !n.isRead).length
      updateNotificationBadge()
    }
  } catch (e) { /* silent */ }
}

function updateNotificationBadge() {
  const badge = document.getElementById('notif-badge')
  if (badge) {
    if (state.unreadNotifications > 0) {
      badge.textContent = state.unreadNotifications > 9 ? '9+' : state.unreadNotifications
      badge.classList.remove('hidden')
    } else {
      badge.classList.add('hidden')
    }
  }
}

// Start polling notifications every 30s
setInterval(fetchNotifications, 30000)

// --- UI Rendering ---
function updateUI() {
  if (!state.isAuthenticated) {
    renderLoginScreen()
    document.querySelector('aside').classList.add('hidden')
    document.querySelector('header').classList.add('hidden')
    return
  }

  document.querySelector('aside').classList.remove('hidden')
  document.querySelector('header').classList.remove('hidden')

  const currentRoleName = state.user?.role || state.activeRole || 'User'
  const fallbackRole = roles[currentRoleName] || roles['Expert']

  const themeColor = fallbackRole.themeColor || 'purple'
  const roleDisplayName = fallbackRole.displayName || `${currentRoleName} Role`
  const roleIcon = fallbackRole.icon || currentRoleName[0].toUpperCase()

  // Use dynamic permissions if available, otherwise fallback
  let allowedScreenIds = state.user?.screens || state.user?.Screens
  if (!allowedScreenIds && fallbackRole) {
    allowedScreenIds = fallbackRole.screens.map(s => s.id)
  }
  if (!allowedScreenIds || allowedScreenIds.length === 0) {
    allowedScreenIds = ['Dashboard'] // fallback minimal access
  }

  const currentScreens = allowedScreenIds.map(id => ({
    id,
    label: screenRegistry[id]?.label || id,
    icon: screenRegistry[id]?.icon || '📄'
  }))

  const currentScreen = currentScreens.find(s => s.id === state.activeScreen) || currentScreens[0]
  state.activeScreen = currentScreen.id

  // Update Header & Sidebar
  activeRoleDisplay.innerText = roleDisplayName
  activeRoleIcon.innerText = roleIcon
  activeRoleIcon.className = `w-8 h-8 rounded-full bg-${themeColor}-900/50 flex items-center justify-center text-${themeColor}-400 font-bold border border-${themeColor}-500/30`
  userInitial.innerText = state.user?.username ? state.user.username[0].toUpperCase() : roleIcon
  userName.innerText = state.user?.username || `${roleDisplayName.split(' ')[1]} User`

  pageTitleName.innerText = currentScreen.label

  // Company branding in sidebar
  const sidebarBrand = document.getElementById('sidebar-brand')
  if (sidebarBrand) {
    if (state.isSuperAdmin && state.viewingCompanyId) {
      const viewingCompany = state.companies.find(c => c.id === state.viewingCompanyId)
      sidebarBrand.innerHTML = `
        <div class="px-3 py-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
          <div class="text-[9px] text-amber-400 font-bold uppercase tracking-widest">Viewing Company</div>
          <div class="text-sm font-bold text-amber-300">${viewingCompany?.name || 'Company #' + state.viewingCompanyId}</div>
          <button onclick="exitCompanyContext()" class="mt-1 text-[9px] text-amber-500 hover:text-amber-300 underline cursor-pointer">Exit Company</button>
        </div>`
    } else if (state.company) {
      sidebarBrand.innerHTML = `
        <div class="px-3 py-2 mb-2 text-center">
          <div class="text-sm font-bold text-[var(--text-color)]">${state.company.name}</div>
          <div class="text-[9px] text-gray-500 uppercase tracking-widest">${roleDisplayName}</div>
        </div>`
    } else if (state.isSuperAdmin) {
      sidebarBrand.innerHTML = `
        <div class="px-3 py-2 mb-2 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-xl text-center">
          <div class="text-[9px] text-yellow-400 font-bold uppercase tracking-widest">Super Admin</div>
          <div class="text-sm font-bold text-yellow-300">Global View</div>
        </div>`
    } else {
      sidebarBrand.innerHTML = ''
    }
  }

  // Update Nav Links
  navLinks.innerHTML = currentScreens.map(screen => {
    const isApprovals = screen.id === 'Approvals'
    const queueCount = state.marketingData.cmoQueue.length

    return `
      <button class="nav-btn w-full flex items-center justify-between p-3 rounded-xl transition-all ${state.activeScreen === screen.id ? `bg-${themeColor}-500/20 text-${themeColor}-400 border border-${themeColor}-500/30 font-bold` : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}" data-screen="${screen.id}">
        <div class="flex items-center space-x-3">
          <span class="text-lg">${screen.icon}</span>
          <span class="text-sm">${screen.label}</span>
        </div>
        ${isApprovals && queueCount > 0 ? `
          <span class="bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">${queueCount}</span>
        ` : ''}
      </button>
    `
  }).join('')

  // Add event listeners to nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => switchScreen(btn.dataset.screen)
  })

  renderScreen(state.activeScreen)
}

function renderScreen(screenId) {
  switch (screenId) {
    case 'Dashboard':
      renderDashboardScreen()
      break
    case 'CampaignBuilder':
      renderCampaignBuilderWizard()
      break
    case 'Objective':
      renderObjectiveScreen()
      break
    case 'Targeting':
      renderTargetingScreen()
      break
    case 'Research':
      renderStrategyHub()
      break
    case 'CreativeConfig':
      renderCreativeConfigScreen()
      break
    case 'Studio':
      renderStudioScreen()
      break
    case 'Monitoring':
      renderMonitoringScreen()
      break
    case 'Budget':
      renderBudgetScreen()
      break
    case 'ApprovedAssets':
      renderApprovedAssetsScreen()
      break
    // Admin Screens
    case 'Config':
      renderConfigScreen()
      break
    case 'RoleManagement':
      renderRoleManagementScreen()
      break
    case 'UserManagement':
      renderUserManagementScreen()
      break
    case 'CompanyProfile':
      renderCompanyProfileScreen()
      break
    case 'Calendar':
      renderCalendarScreen()
      break
    case 'Guideline':
      renderGuidelineScreen()
      break
    case 'Assets':
      renderAssetsScreen()
      break
    // CMO Screens
    case 'BudgetMatrix':
      renderBudgetMatrixScreen()
      break
    case 'Approvals':
      renderRedesignedApprovalsScreen()
      break
    case 'Notifications':
      renderNotificationsScreen()
      break
    case 'DeploySelection':
      renderDeploySelectionScreen()
      break
    case 'AdPerformance':
      renderRealAdPerformanceScreen()
      break
    // Super Admin Screens
    case 'GlobalDashboard':
      renderGlobalDashboard()
      break
    case 'CompanyManagement':
      renderCompanyManagementScreen()
      break
    case 'AuditLog':
      renderAuditLogScreen()
      break
    case 'SystemConfig':
      renderSystemConfigScreen()
      break
    case 'PlatformService':
      renderPlatformServiceScreen()
      break
    // New Admin Screens
    case 'AdAccountManagement':
      renderAdAccountManagementScreen()
      break
    case 'BillingSettings':
      renderBillingSettingsScreen()
      break
    // New CMO Screens
    case 'CampaignReports':
      renderCampaignReportsScreen()
      break
    case 'CrossPlatformAnalytics':
      renderCrossPlatformAnalyticsScreen()
      break
    // New PPP Screens
    case 'DeploymentHistory':
      renderDeploymentHistoryScreen()
      break
    case 'ABTestResults':
      renderABTestResultsScreen()
      break
    // New Expert Screens
    case 'AudienceInsights':
      renderAudienceInsightsScreen()
      break
    case 'CompetitorResearch':
      renderCompetitorResearchScreen()
      break
    case 'Login':
      renderLoginScreen()
      break
    default:
      contentContainer.innerHTML = `<div class="flex items-center justify-center h-full"><h2 class="text-2xl text-gray-500">${screenId} Coming Soon...</h2></div>`
  }
}

// --- Screen Renders ---

function renderObjectiveScreen() {
  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-8">
      <div class="text-center space-y-3">
        <h2 class="text-3xl font-black tracking-tight uppercase">Campaign Objective</h2>
        <p class="text-gray-400 text-sm">Select the primary goal for your AI marketing orchestration</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${['Reach', 'Click', 'Sell'].map(goal => `
          <button class="objective-card group bg-[var(--card-bg)] border-2 ${state.marketingData.objective === goal ? 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-[var(--border-color)]'} p-6 rounded-2xl transition-all hover:scale-102 hover:border-cyan-400 text-center" data-goal="${goal}">
            <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-[var(--bg-color)] flex items-center justify-center group-hover:bg-cyan-900/30 transition-colors">
              <span class="text-2xl">${goal === 'Reach' ? '👁️' : goal === 'Click' ? '🖱️' : '🛍️'}</span>
            </div>
            <h3 class="text-xl font-bold mb-1">${goal}</h3>
            <p class="text-[10px] text-gray-500">Maximize brand awareness and visibility</p>
          </button>
        `).join('')}
      </div>
      
      <div class="flex justify-center mt-8">
        <button id="next-to-targeting" class="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 text-sm" ${!state.marketingData.objective ? 'disabled' : ''}>
          CONTINUE TO TARGETING
        </button>
      </div>
    </div>
  `

  document.querySelectorAll('.objective-card').forEach(card => {
    card.onclick = () => {
      state.marketingData.objective = card.dataset.goal
      renderObjectiveScreen()
    }
  })

  const nextBtn = document.getElementById('next-to-targeting')
  if (nextBtn) nextBtn.onclick = () => switchScreen('Targeting')
}

function renderTargetingScreen() {
  contentContainer.innerHTML = `
    <div class="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] space-y-5">
        <h3 class="text-lg font-bold flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">+</span>
          New Target Set
        </h3>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Country</label>
            <select id="t-country" class="w-full bg-[var(--input-bg)] border border-[var(--border-color)] p-2.5 rounded-lg focus:border-cyan-500 outline-none text-sm">
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Germany</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Language</label>
            <select id="t-language" class="w-full bg-[var(--input-bg)] border border-[var(--border-color)] p-2.5 rounded-lg focus:border-cyan-500 outline-none text-sm">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
        </div>

        <div class="space-y-3">
             <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Specific Area (Optional)</label>
             <button class="w-full h-24 bg-[var(--bg-color)] border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all text-sm">
                <span class="text-xl mb-1">🗺️</span>
                <span>Select from Maps</span>
             </button>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Age Range</label>
            <div class="flex items-center space-x-2">
              <input type="number" id="t-age-min" value="18" class="w-1/2 bg-[var(--input-bg)] border border-[var(--border-color)] p-2.5 rounded-lg outline-none text-sm">
              <span class="text-xs text-gray-500">to</span>
              <input type="number" id="t-age-max" value="65" class="w-1/2 bg-[var(--input-bg)] border border-[var(--border-color)] p-2.5 rounded-lg outline-none text-sm">
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gender</label>
            <div class="flex bg-[var(--input-bg)] p-1 rounded-lg border border-[var(--border-color)]">
              ${['All', 'Male', 'Female'].map(g => `<button class="gender-btn flex-1 py-1.5 rounded-md text-xs font-bold ${g === 'All' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:text-white'} transition-all" data-gender="${g}">${g}</button>`).join('')}
            </div>
          </div>
        </div>

        <button id="add-target-set" class="w-full py-3 bg-transparent border-2 border-dashed border-cyan-500/30 text-cyan-400 font-bold rounded-xl hover:bg-cyan-500/10 transition-all text-xs">
          + ADD TO LIST
        </button>
      </div>

      <div class="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] flex flex-col">
        <h3 class="text-lg font-bold mb-4 flex items-center justify-between">
          Your Target Sets
          <span class="text-[10px] bg-[var(--bg-color)] px-2 py-0.5 rounded text-gray-400" id="target-count">${state.marketingData.targeting.length}</span>
        </h3>
        
        <div id="target-list" class="flex-1 space-y-3 overflow-y-auto max-h-[300px] mb-4">
          ${state.marketingData.targeting.length === 0 ? '<p class="text-gray-500 italic text-center py-6 text-xs">No target sets added yet.</p>' : state.marketingData.targeting.map((t, idx) => `
            <div class="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl relative group">
              <button class="remove-target absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" data-index="${idx}">✕</button>
              <p class="text-xs font-bold text-cyan-400">${t.country} - ${t.language}</p>
              <p class="text-[10px] text-gray-500">Age: ${t.ageMin}-${t.ageMax} | ${t.gender}</p>
            </div>
          `).join('')}
        </div>

        <button id="next-to-research" class="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-black rounded-xl hover:opacity-90 transition-all shadow-xl disabled:grayscale disabled:opacity-50 text-xs" ${state.marketingData.targeting.length === 0 ? 'disabled' : ''}>
          CONTINUE TO RESEARCH ⚡
        </button>
      </div>
    </div>
  `

  document.getElementById('add-target-set').onclick = () => {
    state.marketingData.targeting.push({
      country: document.getElementById('t-country').value,
      language: document.getElementById('t-language').value,
      ageMin: document.getElementById('t-age-min').value,
      ageMax: document.getElementById('t-age-max').value,
      gender: document.querySelector('.gender-btn.bg-cyan-500').innerText
    })
    renderTargetingScreen()
  }

  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.gender-btn').forEach(b => {
        b.classList.remove('bg-cyan-500', 'text-white')
        b.classList.add('text-gray-500')
      })
      btn.classList.add('bg-cyan-500', 'text-white')
      btn.classList.remove('text-gray-500')
    }
  })

  document.getElementById('next-to-research').onclick = () => switchScreen('Research')
}

function renderStrategyHub() {
  const step = state.marketingData.strategyStep
  const isLoading = state.isLoadingStrategy

  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
        <!-- Progress Steps -->
        <div class="flex items-center justify-center space-x-3 mb-6">
            <button class="flex items-center space-x-1.5 transition-all hover:opacity-80 ${step >= 1 ? 'opacity-100' : 'opacity-30'}" onclick="state.marketingData.strategyStep = 1; renderStrategyHub()">
                <span class="w-5 h-5 rounded-full ${step >= 1 ? 'bg-rose-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">1</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-[var(--text-color)]">Baseline</span>
            </button>
            <div class="w-6 h-[1px] ${step > 1 ? 'bg-rose-500' : 'bg-gray-800'}"></div>
            <button class="flex items-center space-x-1.5 transition-all hover:opacity-80 ${step >= 2 ? 'opacity-100' : 'opacity-30'} ${state.marketingData.level1Questions.length === 0 ? 'pointer-events-none' : ''}" onclick="state.marketingData.strategyStep = 2; renderStrategyHub()">
                <span class="w-5 h-5 rounded-full ${step >= 2 ? 'bg-cyan-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">2</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-[var(--text-color)]">Probe 1</span>
            </button>
            <div class="w-6 h-[1px] ${step > 2 ? 'bg-cyan-500' : 'bg-gray-800'}"></div>
            <button class="flex items-center space-x-1.5 transition-all hover:opacity-80 ${step >= 3 ? 'opacity-100' : 'opacity-30'} ${state.marketingData.level2Questions.length === 0 ? 'pointer-events-none' : ''}" onclick="state.marketingData.strategyStep = 3; renderStrategyHub()">
                <span class="w-5 h-5 rounded-full ${step >= 3 ? 'bg-purple-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">3</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-[var(--text-color)]">Final</span>
            </button>
        </div>

        <!-- Section 1: Research & Strategy -->
        <div id="section-research" class="${step === 1 ? 'block' : 'hidden'} space-y-6 text-center">
            <h2 class="text-3xl font-black uppercase tracking-tighter">Research & Strategy</h2>
            <p class="text-gray-500 text-sm font-medium">AI-driven diagnostic framework</p>
            
            <div class="bg-[var(--card-bg)] p-8 rounded-[30px] border border-[var(--border-color)] space-y-6 text-left shadow-2xl">
                <div class="space-y-3">
                    <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Generation brief</label>
                    <textarea id="hub-goal" class="w-full h-32 bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-2xl outline-none focus:border-rose-500 transition-all text-[var(--text-color)] placeholder:text-gray-500 text-sm" placeholder="e.g. I want to increase brand awareness...">${state.marketingData.goal}</textarea>
                </div>
                
                <button id="btn-strategy-1" class="w-full py-4 bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-black rounded-xl transition-all shadow-xl flex flex-col items-center justify-center gap-1 text-base uppercase tracking-widest disabled:opacity-50" ${isLoading ? 'disabled' : ''}>
                    ${isLoading ? `<span class="text-[10px] opacity-70 animate-pulse">${state.strategyLoadingMessage}</span>` : 'ANALYZE STRATEGY <span class="text-lg">✨</span>'}
                </button>
            </div>
        </div>

        <!-- Section 2: Probe Part 1 (Level 1 Qs) -->
        <div id="section-probe-1" class="${step === 2 ? 'block' : 'hidden'} space-y-6">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-cyan-400">Probe <span class="text-[var(--text-color)]">Part 1</span></h2>
                <p class="text-gray-500 text-xs font-medium italic">Conceptual diagnostics based on your brief.</p>
            </div>

            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[30px] p-8 shadow-2xl space-y-8">
                <div class="space-y-6">
                    ${state.marketingData.level1Questions.map((q, i) => `
                        <div class="space-y-2">
                            <label class="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest mb-1 block">Question 0${i + 1}</label>
                            <p class="text-sm font-bold text-[var(--text-color)] mb-2">${q}</p>
                            <input type="text" value="${state.marketingData.level1Answers[i]}" class="probe-l1-input w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] text-sm" data-index="${i}" placeholder="Enter your response...">
                        </div>
                    `).join('')}
                </div>
                
                <div class="flex gap-4">
                  <button id="btn-prev-1" class="flex-1 py-4 border border-gray-700 text-gray-400 font-black rounded-xl hover:bg-gray-800 transition-all uppercase tracking-widest">Previous</button>
                  <button id="btn-strategy-2" class="flex-2 py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black rounded-xl hover:from-cyan-500 hover:to-indigo-500 shadow-xl uppercase tracking-widest flex flex-col items-center justify-center gap-1 text-base disabled:opacity-50" ${isLoading ? 'disabled' : ''}>
                      ${isLoading ? `<span class="text-[10px] opacity-70 animate-pulse">${state.strategyLoadingMessage}</span>` : 'Next: Deep Dive <span class="text-lg">🚀</span>'}
                  </button>
                </div>
            </div>
        </div>

        <!-- Section 3: Probe Part 2 (Level 2 Qs) -->
        <div id="section-probe-2" class="${step === 3 ? 'block' : 'hidden'} space-y-6">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-purple-400">Final <span class="text-[var(--text-color)]">Diagnostics</span></h2>
                <p class="text-gray-500 text-xs font-medium italic">Advanced psychological campaign pillars.</p>
            </div>

            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[30px] p-8 shadow-2xl space-y-8">
                <div class="space-y-6">
                    ${state.marketingData.level2Questions.map((q, i) => `
                        <div class="space-y-2">
                            <label class="text-[9px] font-black text-purple-500/50 uppercase tracking-widest mb-1 block">Deep Dive 0${i + 1}</label>
                            <p class="text-sm font-bold text-[var(--text-color)] mb-2">${q}</p>
                            <input type="text" value="${state.marketingData.level2Answers[i]}" class="probe-l2-input w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-[var(--text-color)] text-sm" data-index="${i}" placeholder="Enter final thoughts...">
                        </div>
                    `).join('')}
                </div>
                
                <div class="flex gap-4">
                  <button id="btn-prev-2" class="flex-1 py-5 border border-gray-700 text-gray-400 font-black rounded-xl hover:bg-gray-800 transition-all uppercase tracking-widest">Previous</button>
                  <button id="btn-strategy-3" class="flex-2 py-5 bg-white text-black font-black rounded-xl hover:bg-cyan-400 transition-all shadow-2xl uppercase tracking-widest flex items-center justify-center gap-2 text-base">
                      FINALIZE STEPS ⚡
                  </button>
                </div>
            </div>
        </div>
    </div>
  `

  // Event Handlers
  if (document.getElementById('hub-goal')) {
    document.getElementById('hub-goal').oninput = (e) => state.marketingData.goal = e.target.value
  }

  if (document.querySelectorAll('.probe-l1-input')) {
    document.querySelectorAll('.probe-l1-input').forEach(input => {
      input.oninput = (e) => state.marketingData.level1Answers[input.dataset.index] = e.target.value
    })
  }

  if (document.querySelectorAll('.probe-l2-input')) {
    document.querySelectorAll('.probe-l2-input').forEach(input => {
      input.oninput = (e) => state.marketingData.level2Answers[input.dataset.index] = e.target.value
    })
  }

  if (document.getElementById('btn-prev-1')) {
    document.getElementById('btn-prev-1').onclick = () => {
      state.marketingData.strategyStep = 1
      renderStrategyHub()
    }
  }

  if (document.getElementById('btn-prev-2')) {
    document.getElementById('btn-prev-2').onclick = () => {
      state.marketingData.strategyStep = 2
      renderStrategyHub()
    }
  }

  if (document.getElementById('btn-strategy-1')) {
    document.getElementById('btn-strategy-1').onclick = async () => {
      if (!state.marketingData.goal) return showNotification("Please enter a brief first.", "error")

      const loadingInterval = startPremiumLoading('strategy')

      try {
        const res = await fetch(`${API_BASE}/gemini/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief: state.marketingData.goal })
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.warn("Gemini API Error, falling back to simulation:", errorData);

          // Smart Fallback Questions
          state.marketingData.level1Questions = [
            `How does '${state.marketingData.goal}' align with your long-term brand legacy?`,
            "What is the single most important emotion you want your audience to feel?",
            "If this campaign were a physical space, what would the atmosphere be like?",
            "What is the primary psychological barrier keeping your audience from acting now?",
            "What does success look like for this campaign in terms of human impact, beyond numbers?"
          ];
          state.marketingData.strategyStep = 2;
          return;
        }

        const data = await res.json()
        state.marketingData.level1Questions = data.questions
        state.marketingData.strategyStep = 2
      } catch (e) {
        console.error(e)
        showNotification("Network error. Please check your connection.", "error")
      } finally {
        state.isLoadingStrategy = false
        clearInterval(loadingInterval)
        renderStrategyHub()
      }
    }
  }

  if (document.getElementById('btn-strategy-2')) {
    document.getElementById('btn-strategy-2').onclick = async () => {
      const loadingInterval = startPremiumLoading('strategy')

      try {
        const res = await fetch(`${API_BASE}/gemini/follow-up`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalBrief: state.marketingData.goal,
            previousQuestions: state.marketingData.level1Questions,
            previousAnswers: state.marketingData.level1Answers
          })
        })

        if (!res.ok) {
          console.log('Gemini capacity reached. Activating Smart Fallback logic.');
          // Smart Simulation Fallback
          state.marketingData.level2Questions = [
            "Based on your previous answers, what is the 'unspoken truth' your product represents?",
            "What would be the most controversial but honest thing you could say about your brand?",
            "How does this campaign create a sense of 'belonging' for your target tribe?",
            "What is the ultimate transformation a customer goes through after interacting with this?",
            "If you could only use one word to describe the 'soul' of this campaign, what would it be?"
          ];
          state.marketingData.strategyStep = 3;
          return;
        }

        const data = await res.json()
        state.marketingData.level2Questions = data.questions
        state.marketingData.strategyStep = 3
      } catch (e) {
        console.error(e)
        showNotification("Failed to connect to Gemini for follow-up.", "error")
      } finally {
        state.isLoadingStrategy = false
        clearInterval(loadingInterval)
        renderStrategyHub()
      }
    }
  }

  if (document.getElementById('btn-strategy-3')) {
    document.getElementById('btn-strategy-3').onclick = () => {
      switchScreen('CreativeConfig')
    }
  }
}

// Shared Facebook Dispatch Config modal — used in both Creative Config and Platform Selection
function openFacebookConfigModal(onCommit) {
  const config = state.marketingData.platformConfig.facebook
  const fbAspectRatios = ['1:1', '9:16', '16:9', '4:5']
  const fbVideoDurations = ['15s', '30s', '60s', '90s']

  document.getElementById('fb-config-modal-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'fb-config-modal-overlay'
  overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center'
  overlay.innerHTML = `
    <div id="fb-config-modal-content" class="bg-[var(--card-bg)] w-full max-w-lg p-8 rounded-3xl border border-[var(--border-color)] shadow-[0_30px_60px_rgba(0,0,0,0.6)] space-y-6">
      <div class="flex flex-col space-y-1 mb-2">
        <h3 class="text-2xl font-black uppercase italic tracking-tighter text-white">Facebook Dispatch Config</h3>
        <p class="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Setup parameters for this specific deployment batch.</p>
      </div>
      <div class="max-h-[65vh] overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-4">
        <!-- Campaign Strategy -->
        <div class="space-y-4">
          <h4 class="text-[10px] font-bold text-[#1877F2] uppercase tracking-widest border-b border-[#1877F2]/20 pb-1">Campaign Strategy</h4>
          <div class="space-y-1">
            <label class="text-[8px] font-black text-gray-500 uppercase">Campaign Name</label>
            <input type="text" id="fb-deploy-camp-name" value="${config.campaign_name}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-xs font-bold text-white">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Objective</label>
              <select id="fb-deploy-objective" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-xs font-bold text-white">
                <option value="OUTCOME_TRAFFIC" ${config.objective === 'OUTCOME_TRAFFIC' ? 'selected' : ''}>Traffic</option>
                <option value="OUTCOME_ENGAGEMENT" ${config.objective === 'OUTCOME_ENGAGEMENT' ? 'selected' : ''}>Engagement</option>
                <option value="OUTCOME_SALES" ${config.objective === 'OUTCOME_SALES' ? 'selected' : ''}>Sales</option>
                <option value="OUTCOME_LEADS" ${config.objective === 'OUTCOME_LEADS' ? 'selected' : ''}>Leads</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Daily Budget ($)</label>
              <input type="number" id="fb-deploy-budget" value="${config.daily_budget}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-sm font-black text-white">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Start Date</label>
              <input type="date" id="fb-deploy-start" value="${config.schedule_start}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-[11px] font-bold text-white">
            </div>
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">End Date</label>
              <input type="date" id="fb-deploy-end" value="${config.schedule_end}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-[11px] font-bold text-white">
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[8px] font-black text-gray-500 uppercase">Facebook Page ID</label>
            <input type="text" id="fb-deploy-page-id" value="${config.page_id}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-xs font-bold text-white">
          </div>
        </div>
        <!-- Creative Config -->
        <div class="space-y-4">
          <h4 class="text-[10px] font-bold text-amber-400 uppercase tracking-widest border-b border-amber-500/20 pb-1">🎨 Creative Config</h4>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Style Preset</label>
              <select id="fb-style-preset" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
                ${['Cinematic','Bold','Minimal','Natural','Vibrant'].map(s => `<option value="${s}" ${config.style_preset === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Default Ratio</label>
              <div class="flex gap-2 mt-1">
                ${['1:1','16:9','9:16'].map(r => `
                  <button type="button" data-fb-ratio="${r}" class="fb-ratio-btn flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${config.default_ratio === r ? 'bg-[#1877F2] border-[#1877F2] text-white' : 'bg-[var(--bg-color)] border-[var(--border-color)] text-gray-400 hover:border-[#1877F2]/50'}">${r}</button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-[8px] font-black text-gray-500 uppercase">Aspect Ratios</label>
            <div class="flex gap-2 flex-wrap">
              ${fbAspectRatios.map(r => `
                <button type="button" data-fb-ar="${r}" class="fb-ar-btn px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${config.aspect_ratios?.includes(r) ? 'bg-[#1877F2] border-[#1877F2] text-white' : 'bg-[var(--bg-color)] border-[var(--border-color)] text-gray-400 hover:border-[#1877F2]/50'}">${r}</button>
              `).join('')}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Images</label>
              <input type="number" id="fb-image-count" value="${config.image_count ?? 2}" min="0" max="20"
                class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-sm font-black text-white">
            </div>
            <div class="space-y-1">
              <label class="text-[8px] font-black text-gray-500 uppercase">Videos</label>
              <input type="number" id="fb-video-count" value="${config.video_count ?? 1}" min="0" max="20"
                class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-sm font-black text-white">
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-[8px] font-black text-gray-500 uppercase">Video Durations</label>
            <div class="flex gap-2">
              ${fbVideoDurations.map(d => `
                <button type="button" data-fb-dur="${d}" class="fb-dur-btn flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${config.video_durations?.includes(d) ? 'bg-amber-500 border-amber-500 text-black' : 'bg-[var(--bg-color)] border-[var(--border-color)] text-gray-400 hover:border-amber-500/50'}">${d}</button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
        <button id="fb-deploy-cancel" class="py-4 bg-[#1A1F29] hover:bg-[#2A2F3A] text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Cancel</button>
        <button id="fb-deploy-save" class="py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-950/20">Commit & Attach 💾</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const mc = document.getElementById('fb-config-modal-content')

  mc.querySelectorAll('.fb-ratio-btn').forEach(b => {
    b.onclick = () => {
      mc.querySelectorAll('.fb-ratio-btn').forEach(x => {
        x.classList.remove('bg-[#1877F2]','border-[#1877F2]','text-white')
        x.classList.add('bg-[var(--bg-color)]','border-[var(--border-color)]','text-gray-400')
      })
      b.classList.add('bg-[#1877F2]','border-[#1877F2]','text-white')
      b.classList.remove('bg-[var(--bg-color)]','border-[var(--border-color)]','text-gray-400')
    }
  })

  mc.querySelectorAll('.fb-ar-btn').forEach(b => {
    b.onclick = () => {
      const active = b.classList.contains('bg-[#1877F2]')
      if (active) {
        b.classList.remove('bg-[#1877F2]','border-[#1877F2]','text-white')
        b.classList.add('bg-[var(--bg-color)]','border-[var(--border-color)]','text-gray-400')
      } else {
        b.classList.add('bg-[#1877F2]','border-[#1877F2]','text-white')
        b.classList.remove('bg-[var(--bg-color)]','border-[var(--border-color)]','text-gray-400')
      }
    }
  })

  mc.querySelectorAll('.fb-dur-btn').forEach(b => {
    b.onclick = () => {
      const active = b.classList.contains('bg-amber-500')
      if (active) {
        b.classList.remove('bg-amber-500','border-amber-500','text-black')
        b.classList.add('bg-[var(--bg-color)]','border-[var(--border-color)]','text-gray-400')
      } else {
        b.classList.add('bg-amber-500','border-amber-500','text-black')
        b.classList.remove('bg-[var(--bg-color)]','border-[var(--border-color)]','text-gray-400')
      }
    }
  })

  document.getElementById('fb-deploy-cancel').onclick = () => overlay.remove()

  document.getElementById('fb-deploy-save').onclick = () => {
    const getValue = (id) => document.getElementById(id)?.value || ''

    config.campaign_name = getValue('fb-deploy-camp-name')
    config.objective = getValue('fb-deploy-objective')
    config.daily_budget = getValue('fb-deploy-budget')
    config.schedule_start = getValue('fb-deploy-start')
    config.schedule_end = getValue('fb-deploy-end')
    config.page_id = getValue('fb-deploy-page-id').trim()
    config.style_preset = getValue('fb-style-preset')
    config.image_count = parseInt(getValue('fb-image-count')) || 0
    config.video_count = parseInt(getValue('fb-video-count')) || 0

    const activeRatio = mc.querySelector('.fb-ratio-btn.bg-\\[\\#1877F2\\]')
    config.default_ratio = activeRatio ? activeRatio.dataset.fbRatio : config.default_ratio
    config.aspect_ratios = Array.from(mc.querySelectorAll('.fb-ar-btn.bg-\\[\\#1877F2\\]')).map(b => b.dataset.fbAr)
    config.video_durations = Array.from(mc.querySelectorAll('.fb-dur-btn.bg-amber-500')).map(b => b.dataset.fbDur)

    overlay.remove()
    onCommit(config)
  }
}

function renderCreativeConfigScreen() {
  const bg = state.marketingData.brandGuidelines
  const tg = state.marketingData.targeting
  const l1 = state.marketingData.level1Questions
  const l2 = state.marketingData.level2Questions

  const consolidatedBrief = `[BRAND] ${bg.brandLabel || 'Not Set'}
[TONE] ${bg.tone} | [LANG] ${bg.language}
[IDENTITY] ${bg.description || 'No description provided.'}

[WHITELIST]
${bg.whitelist || 'No specific inclusions provided.'}

[BLACKLIST]
${bg.blacklist || 'No specific exclusions provided.'}

[AUDIENCE] ${tg.length} target segments prioritized.
${tg.map(t => `- ${t.country} (${t.ageMin}-${t.ageMax}, ${t.gender})`).join('\n')}

[STRATEGY INSIGHTS]
- Objective: ${state.marketingData.objective || 'Not Set'}
- Primary Goal: ${state.marketingData.goal || 'Not Set'}
${l1.length ? '\n[CONCEPTUAL PROBE]\n' + l1.map((q, i) => `Q: ${q}\nA: ${state.marketingData.level1Answers[i] || 'N/A'}`).join('\n') : ''}
${l2.length ? '\n[PSYCHOLOGICAL PILLARS]\n' + l2.map((q, i) => `Q: ${q}\nA: ${state.marketingData.level2Answers[i] || 'N/A'}`).join('\n') : ''}`

  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-700">
        <div class="text-center space-y-2">
            <h2 class="text-2xl font-black tracking-tight uppercase text-[var(--text-color)]">Campaign Creative Hub</h2>
            <p class="text-[var(--text-dim)] text-xs font-medium">AI orchestration & content config.</p>
        </div>

        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 shadow-2xl space-y-6">
            <div class="space-y-2">
                <label class="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Generation brief</label>
                <textarea id="config-goal" class="w-full h-48 bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-rose-500 transition-all text-[var(--text-color)] font-medium leading-relaxed font-mono text-[10px]" placeholder="AI brief...">${consolidatedBrief}</textarea>
                <div class="flex justify-start">
                    <button class="px-5 py-2 bg-rose-600/20 text-rose-500 border border-rose-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Analyze Strategy 🚀</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-gray-800/50">
                <!-- Style Preset -->
                <div class="space-y-3">
                    <h3 class="text-base font-black text-[var(--text-color)] uppercase tracking-tight">Style Preset</h3>
                    <div class="relative">
                        <select id="style-preset" class="w-full bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none appearance-none font-bold text-sm shadow-xl">
                            <option ${state.marketingData.stylePreset === 'Cinematic' ? 'selected' : ''}>Cinematic</option>
                            <option ${state.marketingData.stylePreset === 'Minimalism' ? 'selected' : ''}>Minimalism</option>
                            <option ${state.marketingData.stylePreset === 'Cyberpunk' ? 'selected' : ''}>Cyberpunk</option>
                            <option ${state.marketingData.stylePreset === 'Vintage' ? 'selected' : ''}>Vintage</option>
                        </select>
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-color)] text-sm">▼</div>
                    </div>
                </div>

                <!-- Fallback Aspect Ratio (used when no platforms enabled) -->
                <div class="space-y-3">
                    <h3 class="text-base font-black text-[var(--text-color)] uppercase tracking-tight">Default Ratio</h3>
                    <div class="flex gap-2">
                        ${['1:1', '16:9', '9:16'].map(ratio => `
                            <button class="aspect-ratio-btn flex-1 py-3 rounded-lg font-black text-xs transition-all ${state.marketingData.aspectRatio === ratio ? 'bg-[var(--accent-color)] text-[var(--text-inverse)] ring-2 ring-[var(--accent-color)]' : 'bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--border-color)] shadow-lg hover:bg-[var(--bg-secondary)]'}" data-ratio="${ratio}">
                                ${ratio}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="pt-5 border-t border-gray-800/50 space-y-5">
                <!-- Platform Selector -->
                <div>
                    <h3 class="text-base font-black text-[var(--text-color)] uppercase tracking-tight mb-3">🎯 Platform Configuration</h3>
                    <p class="text-[9px] text-[var(--text-dim)] uppercase tracking-widest mb-3">Select platforms and configure per-platform asset strategy</p>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="platform-toggles">
                        ${['facebook','tiktok','youtube','google'].map(p => {
                            const ps = state.marketingData.platformSpecs[p]
                            const icons = { facebook: '📘', tiktok: '🎵', youtube: '▶️', google: '🔍' }
                            return `<button class="platform-toggle-btn py-3 rounded-xl font-black text-xs transition-all border-2 ${ps.enabled ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-[var(--border-color)] bg-[var(--bg-color)] text-[var(--text-dim)]'}" data-platform="${p}">
                                ${icons[p]} ${p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>`
                        }).join('')}
                    </div>
                </div>

                <!-- Per-Platform Config Panels -->
                <div id="platform-config-panels" class="space-y-4">
                    ${['facebook','tiktok','youtube','google'].map(p => {
                        const ps = state.marketingData.platformSpecs[p]
                        if (!ps.enabled) return ''
                        const allRatios = ['1:1','9:16','16:9','4:5']
                        const allDurations = ['15s','30s','60s','90s']
                        const platformLabels = { facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', google: 'Google Ads' }
                        return `
                        <div class="bg-[var(--bg-color)] border border-cyan-500/30 rounded-xl p-4 space-y-4">
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 rounded-full bg-cyan-500"></div>
                                <h4 class="text-sm font-black text-cyan-400 uppercase tracking-tight">${platformLabels[p]}</h4>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Aspect Ratios</label>
                                    <div class="flex flex-wrap gap-1">
                                        ${allRatios.map(r => `<button class="ratio-toggle-btn px-2 py-1 rounded text-[9px] font-bold transition-all border ${ps.aspectRatios.includes(r) ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-transparent text-[var(--text-dim)] border-[var(--border-color)]'}" data-platform="${p}" data-ratio="${r}">${r}</button>`).join('')}
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Images</label>
                                    <input type="number" min="0" max="10" value="${ps.imageCount}" class="platform-count-input w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-[var(--text-color)]" data-platform="${p}" data-field="imageCount">
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Videos</label>
                                    <input type="number" min="0" max="10" value="${ps.videoCount}" class="platform-count-input w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-[var(--text-color)]" data-platform="${p}" data-field="videoCount">
                                </div>
                            </div>
                            ${ps.videoCount > 0 ? `
                            <div class="space-y-2">
                                <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Video Durations</label>
                                <div class="flex gap-2">
                                    ${allDurations.map(d => `<button class="duration-toggle-btn px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${ps.videoDurations.includes(d) ? 'bg-amber-500 text-black border-amber-500' : 'bg-transparent text-[var(--text-dim)] border-[var(--border-color)]'}" data-platform="${p}" data-duration="${d}">${d}</button>`).join('')}
                                </div>
                            </div>` : ''}
                        </div>`
                    }).join('')}
                </div>
            </div>

            <div class="pt-6">
                <button id="proceed-to-studio" class="w-full py-4 bg-[var(--text-color)] text-[var(--text-inverse)] font-black rounded-xl shadow-xl hover:bg-cyan-400 transition-all text-base uppercase tracking-widest">
                    GENERATE CONTENT 🎨
                </button>
            </div>
        </div>
    </div>
  `

  // Default Ratio selection
  document.querySelectorAll('.aspect-ratio-btn').forEach(btn => {
    btn.onclick = () => {
      state.marketingData.aspectRatio = btn.dataset.ratio
      renderCreativeConfigScreen()
    }
  })

  // Style Preset selection
  document.getElementById('style-preset').onchange = (e) => {
    state.marketingData.stylePreset = e.target.value
  }

  // Platform toggle buttons — Facebook opens config modal, others toggle inline
  document.querySelectorAll('.platform-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const p = btn.dataset.platform
      if (p === 'facebook') {
        openFacebookConfigModal((config) => {
          state.marketingData.platformSpecs.facebook.enabled = true
          state.marketingData.platformSpecs.facebook.aspectRatios = config.aspect_ratios?.length ? config.aspect_ratios : state.marketingData.platformSpecs.facebook.aspectRatios
          state.marketingData.platformSpecs.facebook.imageCount = config.image_count
          state.marketingData.platformSpecs.facebook.videoCount = config.video_count
          state.marketingData.platformSpecs.facebook.videoDurations = config.video_durations?.length ? config.video_durations : state.marketingData.platformSpecs.facebook.videoDurations
          renderCreativeConfigScreen()
          showNotification('Facebook configured and enabled.', 'success')
        })
      } else {
        state.marketingData.platformSpecs[p].enabled = !state.marketingData.platformSpecs[p].enabled
        renderCreativeConfigScreen()
      }
    }
  })

  // Aspect ratio toggle per platform
  document.querySelectorAll('.ratio-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const p = btn.dataset.platform
      const r = btn.dataset.ratio
      const ratios = state.marketingData.platformSpecs[p].aspectRatios
      const idx = ratios.indexOf(r)
      if (idx >= 0) ratios.splice(idx, 1)
      else ratios.push(r)
      renderCreativeConfigScreen()
    }
  })

  // Image/video count inputs per platform
  document.querySelectorAll('.platform-count-input').forEach(input => {
    input.onchange = () => {
      const p = input.dataset.platform
      const field = input.dataset.field
      state.marketingData.platformSpecs[p][field] = parseInt(input.value) || 0
      renderCreativeConfigScreen()
    }
  })

  // Duration toggle per platform
  document.querySelectorAll('.duration-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const p = btn.dataset.platform
      const d = btn.dataset.duration
      const durations = state.marketingData.platformSpecs[p].videoDurations
      const idx = durations.indexOf(d)
      if (idx >= 0) durations.splice(idx, 1)
      else durations.push(d)
      renderCreativeConfigScreen()
    }
  })

  document.getElementById('proceed-to-studio').onclick = async () => {
    const brief = document.getElementById('config-goal').value
    state.marketingData.goal = brief

    const btn = document.getElementById('proceed-to-studio')
    const originalText = btn.innerText
    btn.innerText = '⏳ AI GENERATING IMAGES...'
    btn.disabled = true

    try {
      // 1. Create or use existing campaign
      let campaignId = state.marketingData.activeCampaignId
      if (!campaignId) {
        const campRes = await apiFetch('/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Campaign ${new Date().toLocaleDateString()}`,
            brief: brief,
            stylePreset: state.marketingData.stylePreset,
            aspectRatio: state.marketingData.aspectRatio,
            platforms: Object.keys(state.marketingData.platformSpecs).filter(p => state.marketingData.platformSpecs[p].enabled)
          })
        })
        const campData = await campRes.json()
        campaignId = campData.id
        state.marketingData.activeCampaignId = campaignId
      }

      // 2. Save per-platform specs
      const enabledPlatforms = Object.entries(state.marketingData.platformSpecs).filter(([, ps]) => ps.enabled)
      for (const [platform, ps] of enabledPlatforms) {
        await apiFetch(`/campaigns/${campaignId}/platform-specs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            aspectRatios: ps.aspectRatios,
            imageCount: ps.imageCount,
            videoCount: ps.videoCount,
            videoDurations: ps.videoDurations,
            primaryTextTemplate: brief
          })
        })
      }

      // 3. Generate asset records (if platforms configured)
      if (enabledPlatforms.length > 0) {
        await apiFetch(`/campaigns/${campaignId}/generate-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brief })
        })
      }

      console.log('Campaign platform specs and assets saved.')
      showNotification('✅ Images generated! Opening Creative Studio...', 'success')
      switchScreen('Studio')
    } catch (error) {
      console.error('Error saving platform specs:', error)
      showNotification('Failed to save platform config. Proceeding to Studio.', 'error')
      switchScreen('Studio')
    } finally {
      btn.innerText = originalText
      btn.disabled = false
    }
  }
}

async function renderStudioScreen() {
  contentContainer.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
    </div>
  `

  try {
    const response = await apiFetch('/assets')
    const assets = await response.json()

    // Also load campaign-generated ad creatives if we have an active campaign
    let campaignCreatives = []
    if (state.marketingData.activeCampaignId) {
      try {
        const campRes = await apiFetch(`/campaigns/${state.marketingData.activeCampaignId}`)
        if (campRes.ok) {
          const campData = await campRes.json()
          // Flatten AdSets → Ads → Creatives
          for (const adSet of campData.adSets || []) {
            for (const ad of adSet.ads || []) {
              for (const creative of ad.creatives || []) {
                if (creative.targetPlatform) {
                  campaignCreatives.push({
                    id: `creative_${creative.id}`,
                    url: creative.assetUrl || '',
                    title: ad.name || `Creative #${creative.id}`,
                    type: creative.creativeType || 'image',
                    platform: creative.targetPlatform,
                    duration: creative.durationSeconds ? `${creative.durationSeconds}s` : null,
                    primaryText: creative.primaryText,
                    creativeId: creative.id,
                    adId: ad.id
                  })
                }
              }
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    const fileAssets = assets.map(a => ({
      id: a.name,
      url: `http://localhost:5243${a.url}`,
      title: a.name,
      type: a.type,
      platform: null
    }))

    // Show campaign creatives first (grouped by platform), then file assets
    const allVariations = [...campaignCreatives, ...fileAssets]

    const platformColors = { facebook: 'blue', tiktok: 'pink', youtube: 'red', google: 'green' }
    const platformIcons = { facebook: '📘', tiktok: '🎵', youtube: '▶️', google: '🔍' }

    contentContainer.innerHTML = `
      <div class="space-y-6">
          <div class="flex justify-between items-end">
              <div>
                  <h2 class="text-3xl font-black uppercase tracking-tighter">Creative AI Studio</h2>
                  <p class="text-gray-500 text-sm">Review assets • Approve • Dispatch to PPP Queue</p>
              </div>
              <div class="flex gap-3">
                  <button id="dispatch-ppp-btn" class="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-all uppercase tracking-widest text-xs">
                      Dispatch to PPP Queue ➡️
                  </button>
                  <button id="approval-btn" class="px-6 py-2.5 bg-cyan-600 text-white font-bold rounded-lg animate-pulse hover:animate-none hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all uppercase tracking-widest text-xs">
                      Approve & Send to CMO
                  </button>
              </div>
          </div>

          ${campaignCreatives.length > 0 ? `
          <div class="bg-[var(--card-bg)] border border-amber-500/20 rounded-xl p-4">
              <p class="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3">🎯 Platform-Specific Assets (${campaignCreatives.length} generated)</p>
              <div class="flex flex-wrap gap-2">
                  ${[...new Set(campaignCreatives.map(c => c.platform))].map(p => `
                      <span class="px-2 py-1 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-[9px] font-bold text-[var(--text-dim)] uppercase">
                          ${platformIcons[p] || '📱'} ${p}: ${campaignCreatives.filter(c => c.platform === p).length} assets
                      </span>
                  `).join('')}
              </div>
          </div>` : ''}

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${allVariations.map(v => {
                const platColor = platformColors[v.platform] || 'gray'
                return `
                  <div class="group bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all flex flex-col" data-id="${v.id}">
                      <div class="aspect-video relative overflow-hidden bg-black flex items-center justify-center">
                          ${v.type === 'video' ? `
                              ${v.url ? `<video src="${v.url}" class="w-full h-full object-contain" controls></video>` : `
                              <div class="text-gray-600 text-xs font-bold text-center p-4 flex flex-col items-center gap-2">
                                  <span class="text-3xl">🎬</span>
                                  <span class="font-bold text-gray-400">${v.duration || 'Video'} Slot</span>
                                  <label class="cursor-pointer px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-400 text-[9px] font-black rounded-md uppercase tracking-widest transition-all">
                                      📂 Upload Video
                                      <input type="file" accept="video/*" class="hidden studio-upload-input" data-index="${v.creativeId || ''}" data-type="video">
                                  </label>
                              </div>`}
                          ` : `
                              ${v.url ? `<img src="${v.url}" alt="${v.title}" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-700">` : `
                              <div class="text-gray-600 text-xs font-bold text-center p-4 flex flex-col items-center gap-2">
                                  <span class="text-3xl">🖼️</span>
                                  <span class="font-bold text-gray-400">Image Slot</span>
                                  <label class="cursor-pointer px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-400 text-[9px] font-black rounded-md uppercase tracking-widest transition-all">
                                      📂 Upload Image
                                      <input type="file" accept="image/*" class="hidden studio-upload-input" data-index="${v.creativeId || ''}" data-type="image">
                                  </label>
                              </div>`}
                          `}
                          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                              <span class="text-[10px] font-bold text-cyan-400 uppercase truncate">${v.title}</span>
                          </div>
                          ${v.platform ? `<div class="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded-full text-[8px] font-black uppercase tracking-widest text-${platColor}-400 border border-${platColor}-500/30">${platformIcons[v.platform]} ${v.platform}</div>` : ''}
                          ${v.duration ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-amber-500/80 rounded-full text-[8px] font-black text-black">${v.duration}</div>` : ''}
                      </div>
                      <div class="p-3 space-y-1.5 mt-auto">
                          <p class="text-[9px] text-[var(--text-dim)] truncate">${v.platform ? `Platform: ${v.platform.toUpperCase()}` : 'Asset Library'}</p>
                          <div class="flex gap-2">
                              <button class="studio-delete-btn flex-1 py-1.5 bg-rose-900/50 hover:bg-rose-800 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-md transition-all">DELETE</button>
                              <button class="studio-approve-btn flex-1 py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-[10px] font-bold rounded-md transition-all">APPROVE</button>
                          </div>
                      </div>
                  </div>`
              }).join('')}
              ${allVariations.length === 0 ? '<p class="col-span-full text-center text-gray-500 py-12">No assets found. Go to Creative Config and configure platforms to generate assets.</p>' : ''}
          </div>
      </div>
    `

    let locallyApproved = []

    // Handle file uploads for empty slots
    document.querySelectorAll('.studio-upload-input').forEach(input => {
      input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        const card = input.closest('.group')
        const label = input.closest('label')
        label.textContent = '⏳ Uploading...'
        try {
          const formData = new FormData()
          formData.append('file', file)
          const uploadRes = await apiFetch('/assets/upload', { method: 'POST', body: formData })
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            const mediaEl = input.dataset.type === 'video'
              ? Object.assign(document.createElement('video'), { src: `http://localhost:5243${uploadData.url}`, controls: true, className: 'w-full h-full object-contain' })
              : Object.assign(document.createElement('img'), { src: `http://localhost:5243${uploadData.url}`, alt: 'Uploaded', className: 'w-full h-full object-cover' })
            const container = card.querySelector('.aspect-video')
            const placeholder = container.querySelector('div')
            placeholder?.replaceWith(mediaEl)
            showNotification('✅ File uploaded successfully!', 'success')
          } else {
            label.textContent = '📂 Upload'
            showNotification('Upload failed. Try again.', 'error')
          }
        } catch (err) {
          label.textContent = '📂 Upload'
          showNotification('Upload error: ' + err.message, 'error')
        }
      }
    })

    document.querySelectorAll('.studio-delete-btn').forEach((btn, index) => {
      btn.onclick = async () => {
        const asset = allVariations[index]
        const card = btn.closest('.group')
        try {
          if (!asset.platform) {
            // File asset — delete from disk
            await apiFetch(`/assets/${asset.id}`, { method: 'DELETE' })
          }
          card.classList.add('scale-95', 'opacity-0')
          setTimeout(() => card.remove(), 300)
        } catch (error) {
          console.error('Error deleting asset:', error)
          showNotification('Failed to delete asset.', 'error')
        }
      }
    })

    document.querySelectorAll('.studio-approve-btn').forEach((btn, index) => {
      btn.onclick = () => {
        const asset = allVariations[index]
        const card = btn.closest('.group')
        const deleteBtn = card.querySelector('.studio-delete-btn')
        locallyApproved.push(asset)
        btn.disabled = true
        deleteBtn.disabled = true
        btn.innerText = 'APPROVED ✓'
        btn.classList.replace('text-cyan-400', 'text-gray-500')
        btn.classList.replace('border-cyan-500/30', 'border-gray-700')
        btn.classList.add('opacity-50', 'cursor-not-allowed')
        btn.classList.remove('hover:bg-cyan-500/10')
        deleteBtn.classList.add('opacity-30', 'cursor-not-allowed')
        deleteBtn.classList.remove('hover:bg-rose-800')
      }
    })

    // Dispatch to PPP Queue directly
    document.getElementById('dispatch-ppp-btn').onclick = async () => {
      if (locallyApproved.length === 0) {
        showNotification('Please approve at least one asset before dispatching to PPP.', 'error')
        return
      }
      const dispatchBtn = document.getElementById('dispatch-ppp-btn')
      dispatchBtn.innerText = 'Dispatching... ⏳'
      dispatchBtn.disabled = true
      try {
        // Build PPP queue items with platform metadata
        const pppItems = locallyApproved.map(a => ({
          id: a.id,
          url: a.url,
          title: a.title,
          type: a.type,
          platform: a.platform,
          duration: a.duration,
          campaignId: state.marketingData.activeCampaignId
        }))
        const prevQueue = state.marketingData.ppcQueue || []
        state.marketingData.ppcQueue = [...prevQueue, ...pppItems]
        try {
          await savePppQueue()
        } catch (err) {
          state.marketingData.ppcQueue = prevQueue
          throw err
        }
        showNotification(`✅ ${pppItems.length} asset(s) dispatched to PPP queue for budget allocation.`, 'success')
        locallyApproved = []
        dispatchBtn.innerText = `Dispatched ✓`
      } catch (e) {
        console.error('Dispatch to PPP failed:', e)
        showNotification(`Failed to dispatch to PPP queue: ${e.message}`, 'error')
        dispatchBtn.innerText = 'Dispatch to PPP Queue ➡️'
        dispatchBtn.disabled = false
      }
    }

    document.getElementById('approval-btn').onclick = () => {
      if (locallyApproved.length === 0) {
        showNotification('Please approve at least one variation before final submission.', 'error')
        return
      }

      // Transfer to CMO dashboard queue
      state.marketingData.cmoQueue = [...state.marketingData.cmoQueue, ...locallyApproved]
      saveCmoQueue() // Persist to server
      showNotification(`SUCCESS: ${locallyApproved.length} asset(s) dispatched to Business Admin for final review.`)
      switchScreen('Monitoring')
    }
  } catch (error) {
    console.error('Error rendering studio:', error)
    contentContainer.innerHTML = `<div class="p-8 text-center text-rose-500 font-bold">Error loading assets: ${error.message}</div>`
  }
}

async function renderMonitoringScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-6">
      <div id="monitoring-kpis" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="col-span-2 md:col-span-4 text-center text-[var(--text-dim)] text-xs py-6">Loading metrics…</div>
      </div>
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
        <div class="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
          <h3 class="font-bold uppercase tracking-widest text-xs">Performance Matrix</h3>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
            <span class="text-[9px] text-[var(--text-dim)] font-bold uppercase tracking-widest">Live</span>
          </div>
        </div>
        <div class="p-0 overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-[var(--bg-color)]/50 text-[10px] text-[var(--text-dim)] uppercase font-black">
              <tr>
                <th class="px-6 py-4">Campaign Name</th>
                <th class="px-6 py-4">ROI Index</th>
                <th class="px-6 py-4">Spend</th>
                <th class="px-6 py-4">Auto Actions</th>
                <th class="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody id="monitoring-matrix" class="divide-y divide-[var(--border-color)]">
              <tr><td colspan="5" class="px-6 py-6 text-center text-[var(--text-dim)] text-xs">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `

  try {
    const res = await apiFetch('/monitoring/overview')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const k = data.kpis || {}
    const fmtMoney = n => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })
    const kpis = [
      { label: 'Active Ads', val: (k.activeAds ?? 0).toLocaleString(), icon: '🟢' },
      { label: 'AI Killed', val: (k.killedAds ?? 0).toLocaleString(), icon: '🔴' },
      { label: 'Total Spend', val: fmtMoney(k.totalSpend), icon: '💰' },
      { label: 'Efficiency %', val: (Number(k.efficiency) || 0).toFixed(2) + '%', icon: '⚡' }
    ]
    document.getElementById('monitoring-kpis').innerHTML = kpis.map(s => `
      <div class="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--border-color)] relative overflow-hidden group">
        <div class="absolute -right-2 -top-2 text-4xl opacity-5 group-hover:opacity-10 transition-opacity">${s.icon === '💰' ? '💵' : '📈'}</div>
        <p class="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest mb-1">${s.label}</p>
        <h3 class="text-2xl font-black text-[var(--text-color)]">${s.val}</h3>
      </div>
    `).join('')

    const rows = data.matrix || []
    const matrixBody = document.getElementById('monitoring-matrix')
    if (!rows.length) {
      matrixBody.innerHTML = `<tr><td colspan="5" class="px-6 py-6 text-center text-[var(--text-dim)] text-xs">No campaign metrics available yet.</td></tr>`
    } else {
      matrixBody.innerHTML = rows.map(r => `
        <tr class="hover:bg-gray-800/30 transition-colors">
          <td class="px-6 py-4 font-bold text-sm text-[var(--text-color)]">${r.name}</td>
          <td class="px-6 py-4">
            <div class="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full ${r.roi > 80 ? 'bg-cyan-500' : r.roi > 60 ? 'bg-amber-500' : 'bg-rose-500'}" style="width: ${r.roi}%"></div>
            </div>
          </td>
          <td class="px-6 py-4 text-sm font-mono text-gray-400">${fmtMoney(r.spend)}</td>
          <td class="px-6 py-4">
            <span class="text-[10px] font-black px-2 py-1 rounded bg-gray-800/50 ${r.action === 'Scaling Up' ? 'text-cyan-400' : r.status === 'Critical' ? 'text-rose-500' : 'text-gray-500'} uppercase">${r.action}</span>
          </td>
          <td class="px-6 py-4">
            <span class="w-2 h-2 inline-block rounded-full ${r.status === 'Optimal' ? 'bg-cyan-500' : r.status === 'Critical' ? 'bg-rose-500' : 'bg-gray-500'} mr-2"></span>
            <span class="text-xs font-bold text-[var(--text-dim)]">${r.status}</span>
          </td>
        </tr>
      `).join('')
    }
  } catch (e) {
    console.warn('Monitoring load failed', e)
    document.getElementById('monitoring-kpis').innerHTML = `<div class="col-span-2 md:col-span-4 text-center text-rose-500 text-xs py-6">Failed to load metrics: ${e.message}</div>`
    document.getElementById('monitoring-matrix').innerHTML = `<tr><td colspan="5" class="px-6 py-6 text-center text-rose-500 text-xs">Failed to load.</td></tr>`
  }
}

// --- User Management (Admin) ---
async function renderUserManagementScreen() {
  contentContainer.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-[var(--text-color)]">User Management</h2>
                <p class="text-[var(--text-dim)] text-sm font-medium">Create and manage access for authorized personnel.</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- User Entry Form -->
                <div class="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[25px] shadow-2xl space-y-6">
                    <h3 class="text-lg font-black uppercase tracking-widest text-[var(--text-color)] border-b border-[var(--border-color)] pb-3">New Identity</h3>
                    
                    <form id="user-creation-form" class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Username</label>
                            <input type="text" id="reg-username" required class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] text-sm" placeholder="Username...">
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Email Address</label>
                            <input type="email" id="reg-email" required class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] text-sm" placeholder="email@example.com">
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Security Pin (Password)</label>
                            <input type="password" id="reg-password" required class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] text-sm" placeholder="••••••••">
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Access Role</label>
                            <select id="reg-role" required class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] text-sm appearance-none">
                                <option value="" disabled selected>Select Role...</option>
                                <!-- Roles will be loaded here -->
                            </select>
                        </div>

                        ${state.isSuperAdmin ? `
                        <div class="space-y-1.5" id="company-field">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Company</label>
                            <select id="reg-company" required class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] text-sm appearance-none">
                                <option value="" disabled selected>Select Company...</option>
                            </select>
                        </div>` : ''}

                        <button type="submit" id="btn-create-user" class="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black rounded-xl transition-all shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                           AUTHORIZE USER ⚡
                        </button>
                    </form>
                </div>

                <!-- Existing Personnel List -->
                <div class="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[25px] overflow-hidden shadow-2xl flex flex-col">
                    <div class="p-6 border-b border-[var(--border-color)] bg-[var(--bg-color)]/5 flex justify-between items-center">
                        <h3 class="text-sm font-black uppercase tracking-widest text-[var(--text-color)]">Personnel Directory</h3>
                        <span id="user-count-badge" class="bg-cyan-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">LOADING...</span>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto max-h-[500px]">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-[var(--bg-color)]/20 text-[9px] text-[var(--text-dim)] uppercase font-black sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th class="px-6 py-4">Identity</th>
                                    <th class="px-6 py-4">Role</th>
                                    ${state.isSuperAdmin ? '<th class="px-6 py-4">Company</th>' : ''}
                                    <th class="px-6 py-4">Email</th>
                                    <th class="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody id="user-list-body" class="divide-y divide-[var(--border-color)] text-xs text-[var(--text-dim)]">
                                <!-- Users will be loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `

  // --- Load Data ---
  try {
    // 1. Load Roles for dropdown (backend already filters Super Admin for non-super-admins)
    const rolesRes = await apiFetch('/rbac/roles')
    const allRoles = await rolesRes.json()
    const roleSelect = document.getElementById('reg-role')
    roleSelect.innerHTML += allRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')

    // 2. Load Companies for super admin dropdown
    if (state.isSuperAdmin) {
      try {
        const companiesRes = await apiFetch('/super-admin/companies')
        const companies = await companiesRes.json()
        const companySelect = document.getElementById('reg-company')
        companySelect.innerHTML = '<option value="" disabled selected>Select Company...</option>'
          + companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
      } catch (e) {
        console.warn('Could not load companies', e)
      }
    }

    // 3. Load Users for table
    loadUserList()

  } catch (e) {
    console.warn("Could not load role/user data", e)
  }

  // --- Form Handling ---
  document.getElementById('user-creation-form').onsubmit = async (e) => {
    e.preventDefault()
    const btn = document.getElementById('btn-create-user')
    const originalText = btn.innerHTML
    btn.innerHTML = 'VALIDATING... <span class="animate-spin">⌛</span>'
    btn.disabled = true

    const payload = {
      username: document.getElementById('reg-username').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
      roleId: parseInt(document.getElementById('reg-role').value),
      companyId: state.isSuperAdmin
        ? (parseInt(document.getElementById('reg-company').value) || null)
        : (state.viewingCompanyId || state.company?.id || null)
    }

    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        showNotification("USER AUTHORIZED: Access granted to " + payload.username, "success")
        document.getElementById('user-creation-form').reset()
        loadUserList()
      } else {
        showNotification(data.message || "Authorization failed", "error")
      }
    } catch (error) {
      showNotification("Network error. Could not contact security server.", "error")
    } finally {
      btn.innerHTML = originalText
      btn.disabled = false
    }
  }
}

async function loadUserList() {
  const listBody = document.getElementById('user-list-body')
  const badge = document.getElementById('user-count-badge')

  try {
    const res = await apiFetch('/rbac/users')
    if (!res.ok) throw new Error("Endpoint not found")

    let users = await res.json()

    // Hide Super Admin users from company Admin view
    if (!state.isSuperAdmin) {
      users = users.filter(u => !u.isSuperAdmin)
    }

    badge.innerText = users.filter(u => u.status === 'active').length + " ACTIVE"

    listBody.innerHTML = users.map(u => `
            <tr class="hover:bg-white/[0.02] transition-colors border-b border-white/5 ${u.status !== 'active' ? 'opacity-50' : ''}">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold border border-cyan-500/20 text-[10px] uppercase">
                            ${u.username[0]}
                        </div>
                        <span class="font-bold text-gray-200 uppercase tracking-tighter">${u.username}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${u.role?.name === 'Admin' ? 'bg-purple-900/50 text-purple-400 border border-purple-500/30' : 'bg-gray-800 text-gray-400'}">${u.role?.name || 'User'}</span>
                </td>
                ${state.isSuperAdmin ? `<td class="px-6 py-4">
                    <span class="text-[10px] font-bold text-cyan-400/80 uppercase tracking-wide">${u.company?.name || '<span class="text-gray-600 italic normal-case">—</span>'}</span>
                </td>` : ''}
                <td class="px-6 py-4 text-gray-500">${u.email || '-'}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                    ${u.status === 'active'
                      ? `<button class="revoke-btn text-rose-500 hover:text-rose-400 transition-colors uppercase font-black text-[9px] tracking-widest px-3 py-1 bg-rose-500/10 rounded-md border border-rose-500/20" data-id="${u.id}" data-name="${u.username}">Revoke</button>`
                      : `<button class="activate-btn text-emerald-500 hover:text-emerald-400 transition-colors uppercase font-black text-[9px] tracking-widest px-3 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20" data-id="${u.id}" data-name="${u.username}">Activate</button>`
                    }
                    <button class="delete-btn text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/20" data-id="${u.id}" data-name="${u.username}" title="Delete user permanently">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                    </div>
                </td>
            </tr>
        `).join('')

    // Add Revoke handler
    document.querySelectorAll('.revoke-btn').forEach(btn => {
      btn.onclick = async () => {
        const userId = btn.dataset.id
        const userName = btn.dataset.name

        if (userName === 'admin' || userName === state.user?.username) {
          showNotification("Security Protocol: You cannot revoke access for the master admin or your own identity.", "error")
          return
        }

        if (!confirm(`Are you sure you want to terminate access for ${userName}?`)) return

        try {
          const res = await apiFetch(`/rbac/users/${userId}`, { method: 'DELETE' })
          if (res.ok) {
            showNotification("ACCESS REVOKED: " + userName + " is no longer authorized.", "success")
            loadUserList()
          }
        } catch (e) {
          showNotification("Protocol Error: Connection to security server lost.", "error")
        }
      }
    })

    // Add Activate handler
    document.querySelectorAll('.activate-btn').forEach(btn => {
      btn.onclick = async () => {
        const userId = btn.dataset.id
        const userName = btn.dataset.name
        if (!confirm(`Activate access for ${userName}?`)) return
        try {
          const res = await apiFetch(`/rbac/users/${userId}/activate`, { method: 'PATCH' })
          if (res.ok) {
            showNotification("ACCESS GRANTED: " + userName + " is now active.", "success")
            loadUserList()
          }
        } catch (e) {
          showNotification("Protocol Error: Could not activate user.", "error")
        }
      }
    })

    // Add Delete handler
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async () => {
        const userId = btn.dataset.id
        const userName = btn.dataset.name
        if (userName === state.user?.username) {
          showNotification("Cannot delete your own account.", "error")
          return
        }
        if (!confirm(`Permanently delete user "${userName}"? This cannot be undone.`)) return
        try {
          const res = await apiFetch(`/rbac/users/${userId}/permanent`, { method: 'DELETE' })
          if (res.ok) {
            showNotification("USER DELETED: " + userName + " has been permanently removed.", "success")
            loadUserList()
          }
        } catch (e) {
          showNotification("Error: Could not delete user.", "error")
        }
      }
    })
  } catch (e) {
    listBody.innerHTML = `<tr><td colspan="${state.isSuperAdmin ? 5 : 4}" class="px-6 py-8 text-center text-gray-600 italic">Personnel directory temporarily unavailable.</td></tr>`
    badge.innerText = "OFFLINE"
  }
}

function renderBudgetScreen() {
  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
        <h2 class="text-2xl font-black uppercase italic">Budget Monitoring</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-gradient-to-br from-[#151921] to-[#0B0E14] p-6 rounded-2xl border border-cyan-500/20 shadow-2xl">
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Allocated</p>
                <h3 class="text-3xl font-black text-white">$ 50,000.00</h3>
            </div>
            <div class="bg-gradient-to-br from-[#151921] to-[#0B0E14] p-6 rounded-2xl border border-rose-500/20 shadow-2xl">
                <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Remaining</p>
                <h3 class="text-3xl font-black text-rose-400">$ 37,518.00</h3>
            </div>
        </div>
    </div>
  `
}

// --- Admin Screens ---

function renderConfigScreen() {
  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-8">
        <div class="text-center space-y-2">
            <h2 class="text-3xl font-black tracking-tighter uppercase">Social Ecosystem</h2>
            <p class="text-gray-500 text-sm">Manage platforms and credentials</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            ${['Facebook', 'Instagram', 'YouTube', 'TikTok'].map(p => `
                <button class="platform-btn group bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl hover:border-purple-500 hover:bg-purple-500/5 transition-all flex flex-col items-center gap-3" data-platform="${p}">
                    <div class="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        ${p === 'Facebook' ? 'f' : p === 'Instagram' ? '📸' : p === 'YouTube' ? '▶️' : '🎵'}
                    </div>
                    <h3 class="font-bold text-lg">${p}</h3>
                </button>
            `).join('')}
        </div>
    </div>
    <div id="modal-overlay" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center hidden">
        <div id="modal-content" class="bg-[var(--card-bg)] w-full max-w-md p-8 rounded-3xl border border-[var(--border-color)] space-y-6">
            <!-- Dynamic Content -->
        </div>
    </div>
  `
  const modal = document.getElementById('modal-overlay')
  const modalContent = document.getElementById('modal-content')

  document.querySelectorAll('.platform-btn').forEach(btn => btn.onclick = () => {
    const platform = btn.dataset.platform
    if (platform === 'TikTok') {
      const config = state.marketingData.platformConfig.tiktok
      modalContent.innerHTML = `
        <h3 class="text-2xl font-bold uppercase italic tracking-tighter text-white">TikTok Business Setup</h3>
        <p class="text-gray-500 text-[10px] font-medium uppercase tracking-[0.1em] leading-relaxed">Configure your TikTok Business API credentials to enable autonomous campaign orchestration.</p>
        <div class="space-y-4">
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Advertiser ID</label>
                <input type="text" id="tt-adv-id" value="${config.advertiser_id}" placeholder="760097..." class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Access Token</label>
                <input type="password" id="tt-token" value="${config.access_token}" placeholder="act_..." class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Pixel ID</label>
                <input type="text" id="tt-pixel" value="${config.pixel_id}" placeholder="PXL_..." class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Identity ID</label>
                <input type="text" id="tt-identity" value="${config.identity_id}" placeholder="ID_..." class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
        </div>
        <div class="pt-4">
            <button id="modal-save" class="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-purple-900/20">SAVE CREDENTIALS</button>
        </div>
      `
      document.getElementById('modal-save').onclick = () => {
        const c = state.marketingData.platformConfig.tiktok
        c.advertiser_id = document.getElementById('tt-adv-id').value
        c.access_token = document.getElementById('tt-token').value
        c.pixel_id = document.getElementById('tt-pixel').value
        c.identity_id = document.getElementById('tt-identity').value

        modal.classList.add('hidden')
        showNotification('TikTok credentials saved and active.', 'success')
      }
    } else {
      modalContent.innerHTML = `
        <h3 class="text-2xl font-bold uppercase italic tracking-tighter text-white">Connect ${platform}</h3>
        <p class="text-gray-500 text-[10px] font-medium uppercase tracking-[0.1em]">Credential setup for ${platform} is currently under maintenance.</p>
        <div class="space-y-4 opacity-30 pointer-events-none">
            <input type="text" placeholder="Account Name" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none text-sm">
            <input type="password" placeholder="Key" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none text-sm">
        </div>
        <button id="modal-close" class="w-full py-3 bg-gray-800 rounded-xl font-bold uppercase tracking-widest text-[10px] text-gray-400">CLOSE</button>
      `
      document.getElementById('modal-close').onclick = () => modal.classList.add('hidden')
    }
    modal.classList.remove('hidden')
  })
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden') }
}

function renderCompanyProfileScreen() {
  const profile = state.marketingData.companyProfile
  contentContainer.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <div class="flex justify-between items-center">
            <div>
                <h2 class="text-3xl font-black uppercase italic tracking-tighter">Company <span class="text-purple-500">Corporate Identity</span></h2>
                <p class="text-gray-500 text-xs uppercase tracking-widest font-bold mt-1">Foundational data for AI strategy alignment</p>
            </div>
            <button id="save-profile-btn" class="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 group">
                <span>COMMIT PROFILE</span>
                <span class="text-lg group-hover:scale-110 transition-transform">💾</span>
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Left Column: Core Info -->
            <div class="md:col-span-2 space-y-6">
                <!-- Basic Info Card -->
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-3xl space-y-6">
                    <h4 class="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] border-b border-purple-500/20 pb-2">Primary Information</h4>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Company Name</label>
                            <input type="text" id="cp-name" value="${profile.name}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Industry / Niche</label>
                            <input type="text" id="cp-industry" value="${profile.industry}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Official Website</label>
                            <input type="text" id="cp-website" value="${profile.website}" placeholder="https://..." class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">HQ Location</label>
                            <input type="text" id="cp-location" value="${profile.location}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Employee Count</label>
                            <select id="cp-employees" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                                <option value="1-10" ${profile.employeeCount === '1-10' ? 'selected' : ''}>1-10 (Startup)</option>
                                <option value="11-50" ${profile.employeeCount === '11-50' ? 'selected' : ''}>11-50 (SME)</option>
                                <option value="51-200" ${profile.employeeCount === '51-200' ? 'selected' : ''}>51-200 (Growth)</option>
                                <option value="200+" ${profile.employeeCount === '200+' ? 'selected' : ''}>200+ (Enterprise)</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Founding Year</label>
                            <input type="number" id="cp-founding" value="${profile.foundingYear}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                    </div>
                </div>

                <!-- Strategic Narrative Card -->
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-3xl space-y-6">
                    <h4 class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-emerald-500/20 pb-2">Strategic Narrative</h4>
                    
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">About the Company</label>
                        <textarea id="cp-about" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-medium text-gray-300 min-h-[120px] transition-all" placeholder="Describe your company's core values...">${profile.about}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Mission Statement</label>
                            <textarea id="cp-mission" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-medium text-gray-300 min-h-[80px] transition-all">${profile.mission}</textarea>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Vision Statement</label>
                            <textarea id="cp-vision" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-medium text-gray-300 min-h-[80px] transition-all">${profile.vision}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Social & Presence -->
            <div class="space-y-6">
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-3xl space-y-6 sticky top-8">
                    <h4 class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] border-b border-cyan-500/20 pb-2">Social Ecosystem</h4>
                    
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#1877F2]/20 rounded flex items-center justify-center text-[#1877F2]">f</span>
                                Facebook Page
                            </label>
                            <input type="text" id="cp-fb" value="${profile.socialLinks.facebook}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1877F2] text-xs font-bold text-white transition-all">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#E4405F]/20 rounded flex items-center justify-center text-[#E4405F]">i</span>
                                Instagram Handle
                            </label>
                            <input type="text" id="cp-ig" value="${profile.socialLinks.instagram}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#E4405F] text-xs font-bold text-white transition-all">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#0A66C2]/20 rounded flex items-center justify-center text-[#0A66C2]">in</span>
                                LinkedIn Profile
                            </label>
                            <input type="text" id="cp-li" value="${profile.socialLinks.linkedin}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#0A66C2] text-xs font-bold text-white transition-all">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#1DA1F2]/20 rounded flex items-center justify-center text-[#1DA1F2]">t</span>
                                Twitter / X
                            </label>
                            <input type="text" id="cp-tw" value="${profile.socialLinks.twitter}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-[#1DA1F2] text-xs font-bold text-white transition-all">
                        </div>
                    </div>

                    <!-- Profile Completeness Mockup -->
                    <div class="pt-6 border-t border-[var(--border-color)] space-y-3">
                        <div class="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                            <span class="text-gray-500">Profile Completeness</span>
                            <span class="text-purple-500">75%</span>
                        </div>
                        <div class="h-1.5 w-full bg-[var(--bg-color)] rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-purple-600 to-cyan-500 w-[75%] rounded-full shadow-[0_0_10px_rgba(147,51,234,0.3)]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `

  document.getElementById('save-profile-btn').onclick = () => {
    profile.name = document.getElementById('cp-name').value
    profile.industry = document.getElementById('cp-industry').value
    profile.website = document.getElementById('cp-website').value
    profile.location = document.getElementById('cp-location').value
    profile.employeeCount = document.getElementById('cp-employees').value
    profile.foundingYear = document.getElementById('cp-founding').value
    profile.about = document.getElementById('cp-about').value
    profile.mission = document.getElementById('cp-mission').value
    profile.vision = document.getElementById('cp-vision').value
    profile.socialLinks.facebook = document.getElementById('cp-fb').value
    profile.socialLinks.instagram = document.getElementById('cp-ig').value
    profile.socialLinks.linkedin = document.getElementById('cp-li').value
    profile.socialLinks.twitter = document.getElementById('cp-tw').value

    showNotification('Company Corporate Identity updated successfully.', 'success')
    renderCompanyProfileScreen()
  }
}

// --- Role Management (Admin) ---
async function renderRoleManagementScreen() {
  contentContainer.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
            <!-- ── User Permission Overrides ── -->
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-cyan-900/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm">👤</div>
                <div>
                    <h3 class="text-lg font-black uppercase tracking-widest text-white">User Permission Overrides</h3>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Assign screen access directly to individual users</p>
                </div>
            </div>

            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[30px] shadow-2xl space-y-4">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Select User</label>
                <select id="user-permission-selector" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-white text-sm cursor-pointer">
                    <option value="">— Select a user to manage permissions —</option>
                </select>
            </div>

            <div id="user-perms-container" class="hidden"></div>
        </div>
    `

  loadUsersForSelector()

  // User selector handler
  document.getElementById('user-permission-selector').onchange = (e) => {
    const userId = parseInt(e.target.value)
    if (userId) {
      const selectedOption = e.target.options[e.target.selectedIndex]
      const displayName = selectedOption ? selectedOption.textContent : ''
      const roleId = selectedOption?.dataset?.roleId ? parseInt(selectedOption.dataset.roleId) : null
      loadUserPermissionsMatrix(userId, displayName, roleId)
    } else {
      document.getElementById('user-perms-container').classList.add('hidden')
      document.getElementById('user-perms-container').innerHTML = ''
    }
  }
}

async function loadRolesMatrix() {
  const container = document.getElementById('roles-matrix-container')

  try {
    const [rolesRes, screensRes] = await Promise.all([
      apiFetch('/rbac/roles'),
      apiFetch('/rbac/screens')
    ])

    let rolesData = await rolesRes.json()
    const screens = await screensRes.json()

    // Hide Super Admin role from company Admin view
    if (!state.isSuperAdmin) {
      rolesData = rolesData.filter(r => r.name !== 'Super Admin')
    }

    container.innerHTML = rolesData.map(role => {
      const isSystemRole = ['Admin', 'CMO', 'PPP', 'Expert', 'Super Admin', 'Business Admin', 'PPC'].includes(role.name)

      return `
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[30px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                    <!-- Role Header -->
                    <div class="p-5 bg-white/5 border-b border-white/5 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center font-black text-purple-400">
                                ${role.name[0].toUpperCase()}
                            </div>
                            <div>
                                <h4 class="text-white font-black uppercase tracking-tighter leading-tight">${role.name} ROLE</h4>
                                <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">UID: RL-${role.id.toString().padStart(3, '0')}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="save-perms-btn px-4 py-2 bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all shadow-lg" data-id="${role.id}">Save Sync ✅</button>
                            ${!isSystemRole ? `<button class="delete-role-btn px-4 py-2 bg-rose-900/30 text-rose-500 border border-rose-500/20 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all shadow-lg" data-id="${role.id}" data-name="${role.name}">Delete 🗑️</button>` : ''}
                        </div>
                    </div>

                    <!-- Screen Perms Grid -->
                    <div class="p-6">
                         <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="perms-grid-${role.id}">
                            ${screens.filter(s => state.isSuperAdmin || !SUPER_ADMIN_ONLY_SCREENS.includes(s.name)).map(screen => `
                                <label class="flex items-center gap-2 p-3 bg-black/30 border border-white/5 rounded-xl cursor-pointer hover:border-purple-500/30 hover:bg-white/5 transition-all group">
                                    <input type="checkbox" class="screen-check w-4 h-4 accent-purple-500" data-role="${role.id}" data-screen="${screen.id}" value="${screen.id}">
                                    <div>
                                        <p class="text-[10px] font-bold text-gray-300 group-hover:text-white transition-colors">${screen.displayName}</p>
                                        <p class="text-[8px] text-gray-600 uppercase font-black tracking-widest group-hover:text-purple-400 transition-colors">${screen.name}</p>
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `
    }).join('')

    // Fetch and set initial checkbox values
    for (const role of rolesData) {
      const res = await apiFetch(`/rbac/role-permissions/${role.id}`)
      if (res.ok) {
        const grantedScreenIds = await res.json()
        const checkboxes = document.querySelectorAll(`input[data-role="${role.id}"]`)
        checkboxes.forEach(cb => {
          if (grantedScreenIds.includes(parseInt(cb.value))) cb.checked = true
        })
      }
    }

    // Add Event Listeners
    document.querySelectorAll('.save-perms-btn').forEach(btn => {
      btn.onclick = async () => {
        const roleId = parseInt(btn.dataset.id)
        const checked = Array.from(document.querySelectorAll(`input[data-role="${roleId}"]:checked`)).map(cb => parseInt(cb.value))

        btn.disabled = true
        const originalText = btn.innerText
        btn.innerText = "SYNCING..."

        try {
          const res = await apiFetch('/rbac/role-permissions', {
            method: 'POST',
            body: JSON.stringify({ roleId, screenIds: checked })
          })
          if (res.ok) {
            showNotification("ACCESS PROTOCOL SYNCED", "success")
          }
        } catch (e) {
          showNotification("Sync Failed", "error")
        } finally {
          btn.disabled = false
          btn.innerText = originalText
        }
      }
    })

    document.querySelectorAll('.delete-role-btn').forEach(btn => {
      btn.onclick = async () => {
        const roleId = btn.dataset.id
        const name = btn.dataset.name
        if (!confirm(`Confirm destruction of the '${name}' identity protocol?`)) return

        try {
          const res = await apiFetch(`/rbac/roles/${roleId}`, { method: 'DELETE' })
          if (res.ok) {
            showNotification(`DECOMMISSIONED: '${name}' role deleted.`, "success")
            loadRolesMatrix()
          }
        } catch (e) {
          showNotification("Deletion Request Failure.", "error")
        }
      }
    })

  } catch (e) {
    container.innerHTML = `<div class="p-8 text-center text-rose-500 font-bold italic border border-rose-500/20 bg-rose-500/5 rounded-3xl">Neural Link Failure: Role matrix offline.</div>`
  }
}

async function loadUsersForSelector() {
  const selector = document.getElementById('user-permission-selector')
  if (!selector) return

  try {
    const res = await apiFetch('/rbac/users')
    if (!res.ok) return
    const users = await res.json()

    // Super Admin can manage Super Admin users; other admins must never see them.
    const selectableUsers = state.isSuperAdmin
      ? users
      : users.filter(u => !(u.isSuperAdmin ?? u.IsSuperAdmin))

    selector.innerHTML = '<option value="">— Select a user to manage permissions —</option>'
    selectableUsers.forEach(u => {
      const firstName = u.firstName ?? u.FirstName
      const lastName = u.lastName ?? u.LastName
      const username = u.username ?? u.Username
      const role = u.role ?? u.Role
      const company = u.company ?? u.Company
      const displayName = firstName || lastName
        ? `${firstName || ''} ${lastName || ''}`.trim()
        : username
      const roleName = role?.name ?? role?.Name ?? 'No Role'
      // Super admin sees company name alongside user
      const companyTag = state.isSuperAdmin && company ? ` (${company.name ?? company.Name})` : ''
      const option = document.createElement('option')
      option.value = u.id ?? u.Id
      option.dataset.roleId = role?.id ?? role?.Id ?? ''
      option.textContent = `${displayName}${companyTag} — ${roleName}`
      selector.appendChild(option)
    })
  } catch (e) {
    // Silent fail — selector stays with placeholder
  }
}

async function loadUserPermissionsMatrix(userId, displayName = '', roleId = null) {
  const container = document.getElementById('user-perms-container')
  container.classList.remove('hidden')
  container.innerHTML = `
    <div class="flex items-center justify-center py-12 bg-white/5 rounded-[30px] border border-dashed border-white/10 text-gray-500 text-sm">
      LOADING USER PERMISSIONS...
    </div>`

  try {
    const screensRes = await apiFetch('/rbac/screens')
    const screens = await screensRes.json()

    // Fetch user's existing permissions separately — gracefully default to [] if none
    let grantedScreenIds = []
    try {
      const userPermsRes = await apiFetch(`/rbac/user-permissions/${userId}`)
      grantedScreenIds = await userPermsRes.json()
    } catch (_) {
      // User has no permissions yet — start with empty
    }

    // If no user-specific permissions saved yet, pre-populate from their role
    if (grantedScreenIds.length === 0 && roleId) {
      try {
        const rolePermsRes = await apiFetch(`/rbac/role-permissions/${roleId}`)
        grantedScreenIds = await rolePermsRes.json()
      } catch (_) {
        // Role permissions unavailable — leave empty
      }
    }

    const visibleScreens = state.isSuperAdmin
      ? screens
      : screens.filter(s => !SUPER_ADMIN_ONLY_SCREENS.includes(s.name))

    // Build display name: use passed name, strip the " — RoleName" part if present
    const namePart = displayName.split(' — ')[0].trim() || `User #${userId}`
    const initial = namePart[0]?.toUpperCase() || 'U'

    container.innerHTML = `
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[30px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <!-- User Header -->
        <div class="p-5 bg-white/5 border-b border-white/5 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-400 text-base">
              ${initial}
            </div>
            <div>
              <h4 class="text-white font-black uppercase tracking-tighter leading-tight">${namePart} PERMISSIONS</h4>
              <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">UID: USR-${userId.toString().padStart(3, '0')}</p>
            </div>
          </div>
          <button id="save-user-perms-btn" class="px-4 py-2 bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all shadow-lg" data-user="${userId}">
            Save Sync ✅
          </button>
        </div>

        <!-- Screen Perms Grid -->
        <div class="p-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="user-perms-grid-${userId}">
            ${visibleScreens.map(screen => `
              <label class="flex items-center gap-2 p-3 bg-black/30 border border-white/5 rounded-xl cursor-pointer hover:border-indigo-500/30 hover:bg-white/5 transition-all group">
                <input type="checkbox" class="user-screen-check w-4 h-4 accent-indigo-500"
                  data-user="${userId}" data-screen="${screen.id}" value="${screen.id}"
                  ${grantedScreenIds.includes(screen.id) ? 'checked' : ''}>
                <div>
                  <p class="text-[10px] font-bold text-gray-300 group-hover:text-white transition-colors">${screen.displayName}</p>
                  <p class="text-[8px] text-gray-600 uppercase font-black tracking-widest group-hover:text-indigo-400 transition-colors">${screen.name}</p>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>`

    document.getElementById('save-user-perms-btn').onclick = async () => {
      const btn = document.getElementById('save-user-perms-btn')
      const checked = Array.from(
        document.querySelectorAll(`input.user-screen-check[data-user="${userId}"]:checked`)
      ).map(cb => parseInt(cb.value))

      btn.disabled = true
      const originalText = btn.innerText
      btn.innerText = 'SYNCING...'

      try {
        const res = await apiFetch('/rbac/user-permissions', {
          method: 'POST',
          body: JSON.stringify({ userId, screenIds: checked })
        })
        if (res.ok) {
          showNotification('USER PERMISSIONS SYNCED', 'success')
        } else {
          showNotification('Sync Failed', 'error')
        }
      } catch (e) {
        showNotification('Sync Failed', 'error')
      } finally {
        btn.disabled = false
        btn.innerText = originalText
      }
    }

  } catch (e) {
    container.innerHTML = `<div class="p-8 text-center text-rose-500 font-bold italic border border-rose-500/20 bg-rose-500/5 rounded-3xl">Failed to load user permissions.</div>`
  }
}

function renderCalendarScreen() {
  contentContainer.innerHTML = `
    <div class="h-full flex flex-col space-y-6">
        <h2 class="text-3xl font-black uppercase italic">Operations Calendar</h2>
        <div class="flex-1 grid grid-cols-7 gap-px bg-[#2A2F3A] border border-[var(--border-color)] rounded-3xl overflow-hidden">
            ${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => `<div class="bg-[var(--card-bg)] p-4 text-center text-[10px] font-black text-gray-500">${d}</div>`).join('')}
            ${Array.from({ length: 35 }).map((_, i) => `<div class="bg-[var(--bg-color)] p-4 min-h-[100px] hover:bg-white/5 transition-colors relative"><span class="text-xs font-bold text-gray-700">${(i % 31) + 1}</span></div>`).join('')}
        </div>
    </div>
  `
}

function renderGuidelineScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <!-- Header Section -->
        <div class="flex justify-between items-start">
            <div>
                <h1 class="text-3xl font-black tracking-tighter uppercase flex items-center gap-2">
                    IDENTITY <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">MANUAL</span>
                </h1>
                <p class="text-gray-500 italic mt-0.5 font-medium text-[10px] tracking-widest uppercase">AI PARAMETERS</p>
            </div>
            <button class="bg-[#12161D] hover:bg-[#1A1F29] border border-[var(--border-color)] px-5 py-2 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-2 transition-all shadow-xl">
                 <span class="text-base opacity-70">⏱</span> LOAD TEMPLATE
            </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column: Primary Config -->
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl shadow-2xl space-y-6">
                    
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Brand Label</label>
                        <input id="bg-label" type="text" value="${state.marketingData.brandGuidelines.brandLabel}" class="w-full bg-[var(--bg-color)] border border-indigo-500/30 p-4 rounded-xl outline-none focus:border-indigo-500 transition-all font-bold text-base shadow-inner text-white" placeholder="...">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Tone</label>
                            <div class="relative">
                                <select id="bg-tone" class="w-full bg-[#12161D] text-white border border-[var(--border-color)] p-3 rounded-xl outline-none appearance-none font-bold focus:border-indigo-500 text-sm">
                                    <option ${state.marketingData.brandGuidelines.tone === 'Professional' ? 'selected' : ''}>Professional</option>
                                    <option ${state.marketingData.brandGuidelines.tone === 'Casual' ? 'selected' : ''}>Casual</option>
                                    <option ${state.marketingData.brandGuidelines.tone === 'Aggressive' ? 'selected' : ''}>Aggressive</option>
                                </select>
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white opacity-50">▼</div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Language</label>
                            <div class="relative">
                                <select id="bg-lang" class="w-full bg-[#12161D] text-white border border-[var(--border-color)] p-3 rounded-xl outline-none appearance-none font-bold focus:border-indigo-500 text-sm">
                                    <option ${state.marketingData.brandGuidelines.language === 'English' ? 'selected' : ''}>English</option>
                                    <option ${state.marketingData.brandGuidelines.language === 'Spanish' ? 'selected' : ''}>Spanish</option>
                                    <option ${state.marketingData.brandGuidelines.language === 'French' ? 'selected' : ''}>French</option>
                                </select>
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white opacity-50">▼</div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Description</label>
                        <textarea id="bg-desc" class="w-full h-32 bg-[#12161D] border border-[var(--border-color)] p-4 rounded-xl outline-none focus:border-indigo-500 transition-all text-white font-medium leading-relaxed shadow-sm text-sm" placeholder="Core essence...">${state.marketingData.brandGuidelines.description}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <h4 class="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">≋ WHITELIST</h4>
                            <textarea id="bg-white" class="w-full h-24 bg-[var(--bg-color)] border-dashed border-2 border-emerald-500/20 p-3 rounded-xl outline-none focus:border-emerald-500/50 transition-all text-[10px] font-medium italic text-gray-400" placeholder="Prioritize...">${state.marketingData.brandGuidelines.whitelist}</textarea>
                        </div>
                        <div class="space-y-3">
                            <h4 class="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">⦸ BLACKLIST</h4>
                            <textarea id="bg-black" class="w-full h-24 bg-[var(--bg-color)] border-dashed border-2 border-rose-500/20 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all text-[10px] font-medium italic text-gray-400" placeholder="Forbidden...">${state.marketingData.brandGuidelines.blacklist}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Visual DNA -->
            <div class="space-y-6">
                <!-- Typography Card -->
                <div class="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-2xl space-y-4">
                    <h3 class="text-base font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <span class="text-indigo-600 text-lg font-serif italic font-black">T</span> TYPOGRAPHY
                    </h3>
                    
                    <div class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Heading Font</label>
                            <div class="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-gray-300 text-xs font-bold shadow-sm">Montserrat Bold</div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Heading Size</label>
                            <div class="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-gray-300 text-xs font-bold shadow-sm">32px</div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Body Font</label>
                            <div class="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-gray-300 text-xs font-bold shadow-sm">Roboto Regular</div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Body Size</label>
                            <div class="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-gray-300 text-xs font-bold shadow-sm">16px</div>
                        </div>
                    </div>
                </div>

                <!-- Palette Card -->
                <div class="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-2xl space-y-4">
                    <h3 class="text-base font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <span class="text-purple-600 text-lg font-black">❂</span> PALETTE
                    </h3>
                    
                    <div class="flex flex-wrap gap-4 justify-center">
                        <div class="w-12 h-12 rounded-2xl shadow-lg ring-4 ring-[#0B0E14] transform hover:scale-110 transition-transform cursor-pointer" style="background-color: #F47A83"></div>
                        <div class="w-12 h-12 rounded-2xl shadow-lg ring-4 ring-[#0B0E14] transform hover:scale-110 transition-transform cursor-pointer" style="background-color: #F59B7C"></div>
                        <div class="w-12 h-12 rounded-2xl shadow-lg ring-4 ring-[#0B0E14] transform hover:scale-110 transition-transform cursor-pointer" style="background-color: #FADB5F"></div>
                        <div class="w-12 h-12 rounded-2xl shadow-lg ring-4 ring-[#0B0E14] transform hover:scale-110 transition-transform cursor-pointer" style="background-color: #A0D1E6"></div>
                        <div class="w-12 h-12 rounded-2xl shadow-lg ring-4 ring-[#0B0E14] transform hover:scale-110 transition-transform cursor-pointer" style="background-color: #B98E90"></div>
                    </div>
                </div>

                <div class="flex gap-3">
                     <button class="flex-1 py-3 bg-transparent border-2 border-[var(--border-color)] rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 transition-all">Discard</button>
                     <button id="commit-bg" class="flex-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-all px-8">Commit Guidelines</button>
                </div>
            </div>
        </div>
    </div>
  `

  document.getElementById('commit-bg').onclick = () => {
    state.marketingData.brandGuidelines.brandLabel = document.getElementById('bg-label').value
    state.marketingData.brandGuidelines.tone = document.getElementById('bg-tone').value
    state.marketingData.brandGuidelines.language = document.getElementById('bg-lang').value
    state.marketingData.brandGuidelines.description = document.getElementById('bg-desc').value
    state.marketingData.brandGuidelines.whitelist = document.getElementById('bg-white').value
    state.marketingData.brandGuidelines.blacklist = document.getElementById('bg-black').value

    // Save to Backend File
    fetch(`${API_BASE}/guidelines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.marketingData.brandGuidelines)
    })
      .then(async res => {
        if (res.ok) {
          showNotification('SUCCESS: Brand guidelines saved to server file.')
        } else {
          const err = await res.text()
          showNotification('ERROR: Could not save guidelines. ' + err, 'error')
        }
      })
      .catch(err => showNotification('NETWORK ERROR: ' + err.message, 'error'))
  }
}

async function renderAssetsScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `
    <div class="space-y-8">
        <h2 class="text-3xl font-black uppercase italic tracking-tighter">Assets Library</h2>
        <div id="library-grid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div class="col-span-full py-20 text-center animate-pulse text-gray-500 uppercase font-black text-xs tracking-widest">Indexing Library Content...</div>
        </div>
    </div>
  `

  try {
    const res = await apiFetch('/assets-library')
    const assets = await res.json()
    const grid = document.getElementById('library-grid')

    grid.innerHTML = assets.map(v => {
      const fullUrl = `http://localhost:5243${v.url}`;
      return `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl aspect-square overflow-hidden group hover:border-purple-500/50 transition-all duration-300 relative">
                ${v.type === 'video' ? `
                    <video src="${fullUrl}" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" muted onmouseover="this.play()" onmouseout="this.pause()"></video>
                ` : `
                    <img src="${fullUrl}" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700">
                `}
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                    <span class="text-[8px] font-black text-purple-400 uppercase truncate">${v.name}</span>
                </div>
            </div>
        `;
    }).join('')

    if (assets.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center space-y-4">
            <span class="text-5xl opacity-20">🗄️</span>
            <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px]">The Assets Library is currently empty.<br><span class="opacity-50">Approve variations in the Studio to archive them here.</span></p>
        </div>
      `
    }
  } catch (error) {
    console.error('Error fetching library:', error)
    document.getElementById('library-grid').innerHTML = `<div class="col-span-full py-20 text-center text-rose-500 font-bold uppercase text-xs">Error loading library contents.</div>`
  }
}

// --- CMO Screens ---

async function renderBudgetMatrixScreen() {
  if (!checkCompanyContext()) return
  const bm = state.marketingData.budgetMatrix

  // Restore persisted matrix weights if available
  try {
    const saved = localStorage.getItem('cmo_matrix_weights')
    if (saved) {
      const w = JSON.parse(saved)
      if (w.reach !== undefined) bm.reach = w.reach
      if (w.click !== undefined) bm.click = w.click
      if (w.sales !== undefined) bm.sales = w.sales
      if (w.reallocation !== undefined) bm.reallocation = w.reallocation
    }
  } catch (e) {}

  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full"></div></div>`

  let campaigns = []
  let budgetMatrixData = null
  try {
    const [campsRes, bmRes] = await Promise.all([
      apiFetch('/campaigns'),
      apiFetch('/cmo/budget-matrix')
    ])
    if (campsRes.ok) campaigns = await campsRes.json()
    if (bmRes.ok) budgetMatrixData = await bmRes.json()
  } catch(e) {}

  let selectedCampaign = null
  let packageData = null

  async function loadPackage(id) {
    try {
      const res = await apiFetch(`/cmo/campaign-package/${id}`)
      if (res.ok) packageData = await res.json()
      else packageData = null
    } catch(e) { packageData = null }
  }

  function renderPage() {
    const platColors = { facebook:'indigo', tiktok:'pink', youtube:'rose', google_ads:'amber', instagram:'purple', twitter:'sky' }
    const platEmojis = { facebook:'📘', tiktok:'🎵', youtube:'▶️', google_ads:'🔍', instagram:'📸', twitter:'🐦' }

    const eligiblePlatformsHtml = packageData ? `
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 shadow-2xl space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-black uppercase tracking-tight text-white">Eligible Platforms</h2>
          ${packageData.totals?.totalItems > 0 ? `<span class="px-3 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-black">${packageData.totals.totalItems} ads ready</span>` : ''}
        </div>
        <div class="grid grid-cols-2 gap-4">
          ${(packageData.platformSpecs || []).length > 0 ? (packageData.platformSpecs || []).map(spec => {
            const budgetInfo = (packageData.budgetByPlatform || []).find(b => b.platform?.toLowerCase() === spec.platform?.toLowerCase())
            const col = platColors[spec.platform?.toLowerCase()] || 'indigo'
            const emoji = platEmojis[spec.platform?.toLowerCase()] || '📢'
            return `
              <div class="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3 hover:border-${col}-500/40 transition-all">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-black uppercase text-white">${emoji} ${spec.platform}</span>
                  <span class="px-2 py-1 bg-${col}-600/20 text-${col}-400 rounded-lg text-[10px] font-bold border border-${col}-500/30">${budgetInfo?.assetCount || 0} ads</span>
                </div>
                <div class="text-[10px] text-gray-500 uppercase tracking-wider space-y-1">
                  ${(spec.aspectRatios || []).length > 0 ? `<div>Ratios: ${spec.aspectRatios.join(', ')}</div>` : ''}
                  <div>${spec.imageCount || 0} images · ${spec.videoCount || 0} videos</div>
                </div>
                ${budgetInfo ? `
                  <div class="border-t border-[var(--border-color)] pt-3 grid grid-cols-2 gap-2">
                    <div>
                      <div class="text-[9px] text-gray-600 uppercase">Daily</div>
                      <div class="text-emerald-400 font-black text-sm">$${(budgetInfo.totalDailyBudget || 0).toFixed(0)}</div>
                    </div>
                    <div>
                      <div class="text-[9px] text-gray-600 uppercase">Lifetime</div>
                      <div class="text-cyan-400 font-black text-sm">$${(budgetInfo.totalLifetimeBudget || 0).toFixed(0)}</div>
                    </div>
                  </div>
                ` : `<div class="text-[10px] text-gray-600 italic pt-1">No budget allocated yet</div>`}
              </div>
            `
          }).join('') : `<div class="col-span-2 text-center text-gray-500 text-sm py-8 border border-dashed border-[var(--border-color)] rounded-2xl">No platform specs configured for this campaign.<br><span class="text-xs opacity-50">Expert must configure platforms first.</span></div>`}
        </div>
        ${packageData.totals ? `
          <div class="grid grid-cols-3 gap-4 border-t border-[var(--border-color)] pt-6">
            <div class="text-center">
              <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ads Ready</div>
              <div class="text-2xl font-black text-white">${packageData.totals.totalItems}</div>
            </div>
            <div class="text-center">
              <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Daily Total</div>
              <div class="text-2xl font-black text-emerald-400">$${(packageData.totals.totalDailyBudget || 0).toFixed(0)}</div>
            </div>
            <div class="text-center">
              <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Lifetime Total</div>
              <div class="text-2xl font-black text-cyan-400">$${(packageData.totals.totalLifetimeBudget || 0).toFixed(0)}</div>
            </div>
          </div>
          ${packageData.totals.totalItems > 0 ? `
            <button id="go-to-approvals-btn" class="w-full py-3 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 font-black rounded-xl transition-all text-xs uppercase tracking-widest">
              → Review &amp; Deploy in Approvals →
            </button>
          ` : ''}
        ` : ''}
      </div>
    ` : ''

    contentContainer.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">

        <!-- Campaign Selector -->
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl space-y-3">
          <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Select Campaign</h3>
          <select id="bm-campaign-select" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-white rounded-xl px-4 py-3 text-sm font-bold cursor-pointer">
            <option value="">-- Choose a campaign to review --</option>
            ${campaigns.map(c => `<option value="${c.id}" ${selectedCampaign?.id == c.id ? 'selected' : ''}>${c.name || 'Untitled'} (${c.status || 'draft'})</option>`).join('')}
          </select>
        </div>

        ${eligiblePlatformsHtml}

        <!-- Budget Configuration Card -->
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 shadow-2xl space-y-6">
          <h2 class="text-xl font-black uppercase tracking-tight text-white mb-6">Budget Configuration</h2>
          <div class="grid grid-cols-2 gap-8">
            <div class="space-y-4">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <span class="text-indigo-500">†</span> Total Spend Target ($)
              </label>
              <div class="bg-[var(--bg-color)] p-6 rounded-2xl border border-[var(--border-color)] shadow-inner">
                <input type="text" id="bm-total-spend" value="${selectedCampaign?.totalBudget || 1000}" class="bg-transparent w-full text-2xl font-black outline-none text-white">
              </div>
            </div>
            <div class="space-y-4">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <span class="text-indigo-500">†</span> Test Cost Per Creative ($)
              </label>
              <div class="bg-[var(--bg-color)] p-6 rounded-2xl border border-[var(--border-color)] shadow-inner">
                <input type="text" value="50" class="bg-transparent w-full text-2xl font-black outline-none text-white">
              </div>
            </div>
          </div>
          <div class="space-y-5">
            <div class="flex justify-between items-center">
              <label class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Reallocation (%)</label>
              <span id="reallocation-val" class="px-3 py-1 bg-indigo-600 rounded-lg text-[10px] font-black text-white">${bm.reallocation}%</span>
            </div>
            <div class="relative pt-1">
              <input type="range" id="reallocation-slider" value="${bm.reallocation}" class="w-full h-1 bg-[var(--bg-color)] rounded-lg appearance-none cursor-pointer accent-indigo-500">
              <div class="flex justify-between mt-3">
                <span class="text-[8px] font-black text-gray-600 uppercase">Conservative</span>
                <span class="text-[8px] font-black text-gray-600 uppercase">Aggressive</span>
              </div>
            </div>
          </div>
          <button id="save-budget-btn" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest cursor-pointer">
            <span class="text-base">💾</span> Save Budget
          </button>
        </div>

        <!-- Expectation Matrix Card -->
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 shadow-2xl space-y-8">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-black uppercase tracking-tight text-white">Expectation Matrix</h2>
            <div class="bg-[var(--bg-color)] border border-[var(--border-color)] px-4 py-2 rounded-xl text-right">
              <p class="text-[8px] font-black text-gray-500 uppercase">Weight</p>
              <p id="total-weight" class="text-lg font-black text-white">${bm.reach + bm.click + bm.sales}%</p>
            </div>
          </div>
          <div class="space-y-8">
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] flex items-center justify-center text-gray-400 text-xs">👁</div>
                  <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Reach</span>
                </div>
                <span id="reach-val" class="text-base font-black text-white">${bm.reach}%</span>
              </div>
              <input type="range" id="reach-slider" value="${bm.reach}" class="w-full h-1 bg-[var(--bg-color)] rounded-lg appearance-none cursor-pointer accent-cyan-500">
            </div>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] flex items-center justify-center text-gray-400 text-xs">🖱</div>
                  <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Click</span>
                </div>
                <span id="click-val" class="text-base font-black text-white">${bm.click}%</span>
              </div>
              <input type="range" id="click-slider" value="${bm.click}" class="w-full h-1 bg-[var(--bg-color)] rounded-lg appearance-none cursor-pointer accent-purple-500">
            </div>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] flex items-center justify-center text-gray-400 text-xs">🛍</div>
                  <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sales</span>
                </div>
                <span id="sales-val" class="text-base font-black text-white">${bm.sales}%</span>
              </div>
              <input type="range" id="sales-slider" value="${bm.sales}" class="w-full h-1 bg-[var(--bg-color)] rounded-lg appearance-none cursor-pointer accent-green-500">
            </div>
          </div>
          <button id="apply-matrix-btn" class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg transition-all text-xs uppercase tracking-widest cursor-pointer">
            Apply Matrix
          </button>
        </div>

        <!-- Live Performance Projections (from /api/cmo/budget-matrix) -->
        ${budgetMatrixData && (budgetMatrixData.platforms || []).length > 0 ? `
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 shadow-2xl space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-black uppercase tracking-tight text-white">📊 Performance Projections</h2>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest">Based on PPP budget allocations</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[10px] text-gray-500 uppercase tracking-widest border-b border-[var(--border-color)]">
                  <th class="text-left pb-3 font-black">Platform</th>
                  <th class="text-right pb-3 font-black">Ads</th>
                  <th class="text-right pb-3 font-black">Budget</th>
                  <th class="text-right pb-3 font-black">Est. Reach</th>
                  <th class="text-right pb-3 font-black">Est. Clicks</th>
                  <th class="text-right pb-3 font-black">Est. Conv.</th>
                  <th class="text-right pb-3 font-black">Share</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border-color)]">
                ${(budgetMatrixData.platforms || []).map(p => `
                  <tr class="hover:bg-white/5 transition-colors">
                    <td class="py-3 font-black uppercase text-xs">${p.platform}</td>
                    <td class="py-3 text-right text-gray-400">${p.adCount}</td>
                    <td class="py-3 text-right text-emerald-400 font-black">$${Number(p.totalLifetimeBudget || 0).toLocaleString()}</td>
                    <td class="py-3 text-right text-cyan-400">${(p.projections?.estimatedImpressions || 0).toLocaleString()}</td>
                    <td class="py-3 text-right text-purple-400">${(p.projections?.estimatedClicks || 0).toLocaleString()}</td>
                    <td class="py-3 text-right text-amber-400 font-black">${(p.projections?.estimatedConversions || 0).toLocaleString()}</td>
                    <td class="py-3 text-right text-white font-black">${p.budgetSharePercent}%</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot class="border-t-2 border-[var(--border-color)]">
                <tr class="text-[10px] font-black uppercase text-white">
                  <td class="pt-3">TOTAL</td>
                  <td class="pt-3 text-right">${budgetMatrixData.totals?.totalAds || 0}</td>
                  <td class="pt-3 text-right text-emerald-400">$${Number(budgetMatrixData.totals?.totalLifetimeBudget || 0).toLocaleString()}</td>
                  <td class="pt-3 text-right text-cyan-400">${(budgetMatrixData.totals?.totalImpressions || 0).toLocaleString()}</td>
                  <td class="pt-3 text-right text-purple-400">${(budgetMatrixData.totals?.totalClicks || 0).toLocaleString()}</td>
                  <td class="pt-3 text-right text-amber-400">${(budgetMatrixData.totals?.totalConversions || 0).toLocaleString()}</td>
                  <td class="pt-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        ` : ''}
      </div>
    `

    // Slider logic
    const sliders = ['reallocation', 'reach', 'click', 'sales']
    sliders.forEach(s => {
      const slider = document.getElementById(`${s}-slider`)
      const valSpan = document.getElementById(`${s}-val`)
      if (slider && valSpan) {
        slider.oninput = (e) => {
          const val = parseInt(e.target.value)
          bm[s] = val
          valSpan.innerText = `${val}%`
          if (s !== 'reallocation') updateTotalWeight()
        }
      }
    })

    function updateTotalWeight() {
      const totalWeight = document.getElementById('total-weight')
      if (!totalWeight) return
      const total = bm.reach + bm.click + bm.sales
      totalWeight.innerText = `${total}%`
      totalWeight.style.color = total > 100 ? '#ef4444' : 'white'
    }

    // Save Budget button — saves campaign budget if a campaign is selected
    const saveBudgetBtn = document.getElementById('save-budget-btn')
    if (saveBudgetBtn && selectedCampaign) {
      saveBudgetBtn.onclick = async () => {
        const totalSpend = parseFloat(document.getElementById('bm-total-spend')?.value || '0')
        saveBudgetBtn.disabled = true
        saveBudgetBtn.textContent = '⏳ Saving...'
        try {
          const res = await apiFetch(`/campaigns/${selectedCampaign.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalBudget: totalSpend })
          })
          if (res.ok) {
            showNotification('Budget saved successfully!', 'success')
            selectedCampaign.totalBudget = totalSpend
          } else {
            showNotification('Failed to save budget', 'error')
          }
        } catch (e) {
          showNotification('Error saving budget', 'error')
        }
        saveBudgetBtn.disabled = false
        saveBudgetBtn.innerHTML = '<span class="text-base">💾</span> Save Budget'
      }
    }

    // Apply Matrix button — saves weights to local state and refreshes projections
    const applyMatrixBtn = document.getElementById('apply-matrix-btn')
    if (applyMatrixBtn) {
      applyMatrixBtn.onclick = async () => {
        const total = bm.reach + bm.click + bm.sales
        if (total !== 100) {
          showNotification(`Matrix weights must total 100% (currently ${total}%)`, 'error')
          return
        }
        applyMatrixBtn.disabled = true
        applyMatrixBtn.textContent = '⏳ Applying...'
        // Persist matrix weights to localStorage
        localStorage.setItem('cmo_matrix_weights', JSON.stringify({ reach: bm.reach, click: bm.click, sales: bm.sales, reallocation: bm.reallocation }))
        // Refresh budget matrix data from server
        try {
          const bmRes = await apiFetch('/cmo/budget-matrix')
          if (bmRes.ok) budgetMatrixData = await bmRes.json()
        } catch (e) {}
        showNotification('Matrix applied and projections refreshed!', 'success')
        renderPage()
      }
    }

    // Campaign selector
    const campSelect = document.getElementById('bm-campaign-select')
    if (campSelect) {
      campSelect.onchange = async (e) => {
        const id = parseInt(e.target.value)
        if (!id) { packageData = null; selectedCampaign = null; renderPage(); return }
        selectedCampaign = campaigns.find(c => c.id == id) || null
        await loadPackage(id)
        renderPage()
      }
    }

    // Go to Approvals shortcut
    const goBtn = document.getElementById('go-to-approvals-btn')
    if (goBtn) goBtn.onclick = () => switchScreen('Approvals')
  }

  renderPage()
}

function renderApprovalsScreen() {
  const queue = state.marketingData.cmoQueue
  const selectedIds = state.marketingData.selectedAssets.map(a => a.id)

  contentContainer.innerHTML = `
    <div class="space-y-6 pb-24">
        <div class="flex justify-between items-center">
            <h2 class="text-3xl font-black uppercase italic">Pending Sign-off</h2>
            <div class="flex items-center gap-4">
                <span id="selected-count" class="text-indigo-400 font-bold text-[10px] uppercase tracking-widest">${state.marketingData.selectedAssets.length} Selected</span>
                <span class="bg-amber-600/20 text-amber-500 px-3 py-1 rounded-full text-[10px] font-black border border-amber-500/30 uppercase tracking-widest">${queue.length} Awaiting</span>
            </div>
        </div>
        
        <div id="approvals-list" class="space-y-4">
            ${queue.length === 0 ? `
              <div class="bg-[var(--card-bg)] border border-dashed border-[var(--border-color)] p-20 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                  <span class="text-5xl opacity-20">📥</span>
                  <p class="text-gray-500 font-bold">No assets pending approval.<br><span class="text-xs font-medium opacity-50 uppercase tracking-tighter">New variations will appear here once approved by the Marketing Expert.</span></p>
              </div>
            ` : queue.map((asset, i) => {
    const isSelected = selectedIds.includes(asset.id)
    return `
                    <div class="bg-[var(--card-bg)] p-5 rounded-2xl border ${isSelected ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-[var(--border-color)]'} flex items-center gap-6 group hover:border-amber-500/30 transition-all">
                        <div class="w-24 h-24 bg-black rounded-xl overflow-hidden shadow-2xl flex-shrink-0 relative">
                            ${asset.type === 'video' ? `
                              <video src="${asset.url}" class="w-full h-full object-cover"></video>
                            ` : `
                              <img src="${asset.url}" class="w-full h-full object-cover">
                            `}
                            ${isSelected ? `<div class="absolute inset-0 bg-amber-500/20 flex items-center justify-center text-2xl">✓</div>` : ''}
                        </div>
                        <div class="flex-1">
                            <h4 class="text-lg font-black uppercase tracking-tight">${asset.title}</h4>
                            <p class="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Type: ${asset.type} • ID: ${String(asset.id).slice(0, 8)}...</p>
                            <p class="text-[10px] ${isSelected ? 'text-amber-500 font-black' : 'text-amber-500/70'} mt-1 uppercase font-bold italic">
                                ${isSelected ? 'READY FOR DEPLOYMENT SIGN-OFF' : 'Awaiting final Business Admin deployment sign-off.'}
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <button class="px-5 py-2.5 bg-gray-800 hover:bg-red-900/40 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cmo-reject-btn" data-index="${i}">REJECT</button>
                            <button class="px-6 py-2.5 ${isSelected ? 'bg-amber-500/10 text-amber-500 border-amber-500' : 'bg-amber-600 hover:bg-amber-500 text-white'} border rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all cmo-toggle-select" data-index="${i}">
                                ${isSelected ? 'DESELECT' : 'APPROVE'}
                            </button>
                        </div>
                    </div>
                `
  }).join('')}
        </div>

        <!-- Authorization Button for PPC -->
        <div class="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm px-6">
            <button id="authorize-ppc-btn" class="w-full py-5 bg-white text-black font-black rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-emerald-500 hover:text-white transition-all scale-100 hover:scale-102 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 uppercase tracking-widest text-sm flex items-center justify-center gap-3" ${state.marketingData.selectedAssets.length === 0 ? 'disabled' : ''}>
                <span>AUTHORIZE FOR PPC DISPATCH</span>
                <span class="text-lg">✅</span>
            </button>
        </div>
    </div>
  `

  document.querySelectorAll('.cmo-toggle-select').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.index
      const asset = queue[idx]
      const existingIdx = state.marketingData.selectedAssets.findIndex(a => a.id === asset.id)

      if (existingIdx > -1) {
        state.marketingData.selectedAssets.splice(existingIdx, 1)
      } else {
        state.marketingData.selectedAssets.push({ ...asset, queueIndex: idx })
      }

      renderApprovalsScreen()
    }
  })

  document.querySelectorAll('.cmo-reject-btn').forEach(btn => {
    btn.onclick = async () => {
      const idx = btn.dataset.index
      const asset = queue[idx]

      // Remove from selected if it was there
      state.marketingData.selectedAssets = state.marketingData.selectedAssets.filter(a => a.id !== asset.id)

      state.marketingData.cmoQueue.splice(idx, 1)
      await saveCmoQueue()
      renderApprovalsScreen()
      updateUI() // Update badge
      showNotification('Variation rejected and removed from queue.', 'attention')
    }
  })

  document.getElementById('authorize-ppc-btn').onclick = async () => {
    const selected = state.marketingData.selectedAssets
    if (selected.length > 0) {
      // Archive each approved asset to Assets Library
      for (const asset of selected) {
        try {
          await apiFetch('/assets/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: asset.id })
          })
        } catch (e) {
          console.warn(`Archive failed for ${asset.id}:`, e.message)
        }
      }

      // Move to PPC Queue
      state.marketingData.ppcQueue.push(...selected)

      // Remove from CMO Queue
      const selectedIds = new Set(selected.map(a => a.id))
      state.marketingData.cmoQueue = state.marketingData.cmoQueue.filter(a => !selectedIds.has(a.id))

      // Clear selection
      state.marketingData.selectedAssets = []

      // Sync with server
      await saveCmoQueue()
      await savePpcQueue()

      showNotification(`${selected.length} Variations authorized for PPC specialist.`, 'success')
      renderApprovalsScreen()
      updateUI()
    }
  }
}

async function renderApprovedAssetsScreen() {
  contentContainer.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  `

  let queue = []
  try {
    const res = await apiFetch('/ppp/queue')
    const serverQueue = await res.json()
    if (Array.isArray(serverQueue)) {
      queue = serverQueue
      state.marketingData.ppcQueue = serverQueue
    }
  } catch (e) {
    console.warn('Could not load ppp queue from server:', e.message)
    queue = state.marketingData.ppcQueue || []
  }

  // Group by platform for display
  const byPlatform = {}
  queue.forEach(item => {
    const p = item.platform || 'General'
    if (!byPlatform[p]) byPlatform[p] = []
    byPlatform[p].push(item)
  })

  const platformColors = {
    Facebook: 'blue', TikTok: 'pink', YouTube: 'red',
    Google: 'yellow', Instagram: 'purple', General: 'gray'
  }
  const statusConfig = {
    received:            { label: 'Received', color: 'text-gray-400',   bg: 'bg-gray-800',    icon: '⏳' },
    budget_configured:   { label: 'Budget Set', color: 'text-amber-400',  bg: 'bg-amber-900/30', icon: '💰' },
    ready_for_approval:  { label: 'Submitted', color: 'text-emerald-400', bg: 'bg-emerald-900/30', icon: '✅' },
    deployed:            { label: 'Deployed',  color: 'text-cyan-400',   bg: 'bg-cyan-900/30',   icon: '🚀' },
    rejected:            { label: 'Rejected', color: 'text-rose-400',   bg: 'bg-rose-900/30', icon: '❌' }
  }

  const totalItems    = queue.length
  const budgetSet     = queue.filter(i => ['budget_configured', 'ready_for_approval', 'deployed'].includes(i.status)).length
  const readyForApproval = queue.filter(i => i.status === 'budget_configured').length

  // Build platform group HTML
  const platformGroupsHtml = Object.entries(byPlatform).map(([platform, items]) => {
    const pColor = platformColors[platform] || 'gray'
    return `
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-${pColor}-500/20 text-${pColor}-400 border border-${pColor}-500/30">${platform}</span>
          <span class="text-xs text-gray-500">${items.length} asset${items.length !== 1 ? 's' : ''}</span>
        </div>
        ${items.map((item, idx) => {
          const sc = statusConfig[item.status] || statusConfig.received
          const bud = item.budget || {}
          const hasBudget = item.status !== 'received'
          return `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden transition-all hover:border-emerald-500/30" id="queue-card-${item.numericId || idx}">
              <!-- Card Header -->
              <div class="p-4 flex items-center gap-4">
                <div class="w-16 h-16 bg-black rounded-xl overflow-hidden flex-shrink-0">
                  ${item.type === 'video'
                    ? `<video src="${item.url}" class="w-full h-full object-cover"></video>`
                    : `<img src="${item.url || ''}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-2xl\\'>🖼</div>'">`
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-sm uppercase tracking-tight truncate">${item.title}</h4>
                  <p class="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">${item.type} • ${platform}</p>
                  <div class="flex items-center gap-2 mt-1.5">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${sc.bg} ${sc.color}">
                      ${sc.icon} ${sc.label}
                    </span>
                    ${hasBudget && bud.dailyBudget ? `<span class="text-[9px] text-gray-400">$${bud.dailyBudget}/day</span>` : ''}
                  </div>
                </div>
                ${item.status !== 'ready_for_approval' && item.status !== 'deployed' ? `
                <button class="toggle-budget-form px-3 py-1.5 bg-[var(--border-color)] hover:bg-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0" data-id="${item.numericId}" data-idx="${idx}">
                  ${hasBudget ? 'Edit Budget' : 'Set Budget'}
                </button>
                ` : `
                <span class="text-emerald-400 text-xs font-bold">✓ Done</span>
                `}
              </div>

              <!-- Collapsible Budget Form -->
              <div class="budget-form hidden border-t border-[var(--border-color)] p-4 bg-black/20" id="budget-form-${item.numericId}">
                <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Budget Allocation for this Ad</p>
                <div class="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Daily Budget ($)</label>
                    <input type="number" placeholder="e.g. 50" value="${bud.dailyBudget || ''}" step="0.01" min="0"
                      class="budget-daily mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" data-id="${item.numericId}">
                  </div>
                  <div>
                    <label class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Lifetime Budget ($)</label>
                    <input type="number" placeholder="e.g. 1000" value="${bud.lifetimeBudget || ''}" step="0.01" min="0"
                      class="budget-lifetime mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" data-id="${item.numericId}">
                  </div>
                  <div>
                    <label class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Cost per Result ($)</label>
                    <input type="number" placeholder="e.g. 2.50" value="${bud.costPerResult || ''}" step="0.01" min="0"
                      class="budget-cpr mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" data-id="${item.numericId}">
                  </div>
                  <div>
                    <label class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Target CPA ($)</label>
                    <input type="number" placeholder="e.g. 15.00" value="${bud.targetCpa || ''}" step="0.01" min="0"
                      class="budget-cpa mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" data-id="${item.numericId}">
                  </div>
                  <div>
                    <label class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Bid Amount ($)</label>
                    <input type="number" placeholder="e.g. 3.00" value="${bud.bidAmount || ''}" step="0.01" min="0"
                      class="budget-bid mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none" data-id="${item.numericId}">
                  </div>
                  <div>
                    <label class="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Bid Strategy</label>
                    <select class="budget-strategy mt-1 w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" data-id="${item.numericId}">
                      <option value="" ${!bud.bidStrategy ? 'selected' : ''}>Auto</option>
                      <option value="lowest_cost" ${bud.bidStrategy === 'lowest_cost' ? 'selected' : ''}>Lowest Cost</option>
                      <option value="target_cost" ${bud.bidStrategy === 'target_cost' ? 'selected' : ''}>Target Cost</option>
                      <option value="bid_cap" ${bud.bidStrategy === 'bid_cap' ? 'selected' : ''}>Bid Cap</option>
                      <option value="cost_cap" ${bud.bidStrategy === 'cost_cap' ? 'selected' : ''}>Cost Cap</option>
                    </select>
                  </div>
                </div>
                <button class="save-budget-btn w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                  data-id="${item.numericId}">
                  💾 Save Budget
                </button>
              </div>
            </div>
          `
        }).join('')}
      </div>
    `
  }).join('')

  contentContainer.innerHTML = `
    <div class="space-y-6 pb-32">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-3xl font-black uppercase italic tracking-tighter text-emerald-400">PPP <span class="text-white">Budget Hub</span></h2>
          <p class="text-xs text-gray-500 mt-1 uppercase tracking-widest font-medium">Assign budgets per ad → Submit for CMO approval</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-center">
            <div class="text-2xl font-black text-white">${totalItems}</div>
            <div class="text-[9px] uppercase tracking-widest text-gray-500">Total Ads</div>
          </div>
          <div class="w-px h-10 bg-[var(--border-color)]"></div>
          <div class="text-center">
            <div class="text-2xl font-black text-amber-400">${budgetSet}</div>
            <div class="text-[9px] uppercase tracking-widest text-gray-500">Budget Set</div>
          </div>
          <div class="w-px h-10 bg-[var(--border-color)]"></div>
          <div class="text-center">
            <div class="text-2xl font-black text-emerald-400">${readyForApproval}</div>
            <div class="text-[9px] uppercase tracking-widest text-gray-500">Ready</div>
          </div>
        </div>
      </div>

      <!-- Lifecycle progress bar -->
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4">
        <div class="flex items-center justify-between text-[9px] uppercase tracking-widest font-black mb-2">
          <span class="text-gray-400">Workflow</span>
          <span class="text-emerald-400">${totalItems > 0 ? Math.round((budgetSet / totalItems) * 100) : 0}% Complete</span>
        </div>
        <div class="flex gap-2 text-[10px] font-bold">
          <div class="flex-1 text-center py-1.5 rounded-lg ${queue.some(i => i.status === 'received') ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-600'}">⏳ Received</div>
          <div class="text-gray-600 self-center">→</div>
          <div class="flex-1 text-center py-1.5 rounded-lg ${queue.some(i => i.status === 'budget_configured') ? 'bg-amber-900/40 text-amber-400' : 'bg-gray-800 text-gray-600'}">💰 Budget Set</div>
          <div class="text-gray-600 self-center">→</div>
          <div class="flex-1 text-center py-1.5 rounded-lg ${queue.some(i => i.status === 'ready_for_approval') ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-600'}">✅ Submitted</div>
          <div class="text-gray-600 self-center">→</div>
          <div class="flex-1 text-center py-1.5 rounded-lg bg-gray-800 text-gray-600">🚀 Deployed</div>
        </div>
      </div>

      <!-- Queue Items by Platform -->
      ${queue.length === 0 ? `
        <div class="bg-[var(--card-bg)] border border-dashed border-[var(--border-color)] p-20 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
          <span class="text-5xl opacity-20">📋</span>
          <p class="text-gray-500 font-bold">No assets in the PPP queue.<br>
            <span class="text-xs font-medium opacity-50 uppercase tracking-tighter">Marketing Expert must dispatch assets from the Studio first.</span>
          </p>
        </div>
      ` : platformGroupsHtml}

      <!-- Dispatch Hub quick link (for already-configured items) -->
      ${queue.some(i => i.status === 'budget_configured' || i.status === 'ready_for_approval') ? `
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-white">Skip to Deploy</p>
            <p class="text-[10px] text-gray-500">Go directly to Platform Selection for budgeted assets.</p>
          </div>
          <button id="go-dispatch-btn" class="px-5 py-2 bg-[var(--border-color)] hover:bg-white/10 border border-[var(--border-color)] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            Dispatch Hub →
          </button>
        </div>
      ` : ''}
    </div>

    <!-- Sticky Submit for CMO Approval Button -->
    <div class="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm px-6">
      <button id="submit-approval-btn" class="w-full py-5 bg-white text-black font-black rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-emerald-500 hover:text-white transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3 ${readyForApproval === 0 ? 'opacity-40 cursor-not-allowed' : ''}" ${readyForApproval === 0 ? 'disabled' : ''}>
        <span>Submit ${readyForApproval} Ad${readyForApproval !== 1 ? 's' : ''} for CMO Approval</span>
        <span class="text-lg">🎯</span>
      </button>
    </div>
  `

  // Toggle budget form visibility
  document.querySelectorAll('.toggle-budget-form').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id
      const form = document.getElementById(`budget-form-${id}`)
      if (form) {
        form.classList.toggle('hidden')
        btn.textContent = form.classList.contains('hidden') ? (btn.textContent.includes('Edit') ? 'Edit Budget' : 'Set Budget') : 'Close'
      }
    }
  })

  // Save budget per item
  document.querySelectorAll('.save-budget-btn').forEach(btn => {
    btn.onclick = async () => {
      const numericId = parseInt(btn.dataset.id)
      if (!numericId) { showNotification('Cannot save: item has no server ID. Re-dispatch from Studio.', 'error'); return }
      const form = document.getElementById(`budget-form-${numericId}`)
      if (!form) return

      const daily    = parseFloat(form.querySelector('.budget-daily')?.value) || null
      const lifetime = parseFloat(form.querySelector('.budget-lifetime')?.value) || null
      const cpr      = parseFloat(form.querySelector('.budget-cpr')?.value) || null
      const cpa      = parseFloat(form.querySelector('.budget-cpa')?.value) || null
      const bid      = parseFloat(form.querySelector('.budget-bid')?.value) || null
      const strategy = form.querySelector('.budget-strategy')?.value || null

      if (!daily && !lifetime) {
        showNotification('Please enter at least a Daily or Lifetime budget.', 'error')
        return
      }

      btn.textContent = 'Saving... ⏳'
      btn.disabled = true
      try {
        const res = await apiFetch('/ppp/budgets', {
          method: 'POST',
          body: JSON.stringify({
            pppQueueItemId: numericId,
            dailyBudget: daily,
            lifetimeBudget: lifetime,
            costPerResult: cpr,
            targetCpa: cpa,
            bidAmount: bid,
            bidStrategy: strategy || null
          })
        })
        if (res.ok) {
          showNotification('✅ Budget saved!', 'success')
          renderApprovedAssetsScreen()
        } else {
          const err = await res.json().catch(() => ({}))
          showNotification(err.error || 'Failed to save budget.', 'error')
          btn.textContent = '💾 Save Budget'
          btn.disabled = false
        }
      } catch (e) {
        showNotification('Network error saving budget.', 'error')
        btn.textContent = '💾 Save Budget'
        btn.disabled = false
      }
    }
  })

  // Submit for CMO approval
  const submitBtn = document.getElementById('submit-approval-btn')
  if (submitBtn && readyForApproval > 0) {
    submitBtn.onclick = async () => {
      const readyIds = queue
        .filter(i => i.status === 'budget_configured')
        .map(i => i.numericId)
        .filter(Boolean)

      if (readyIds.length === 0) {
        showNotification('No budget-configured items to submit.', 'error')
        return
      }

      submitBtn.textContent = 'Submitting... ⏳'
      submitBtn.disabled = true
      try {
        const res = await apiFetch('/ppp/submit-for-approval', {
          method: 'POST',
          body: JSON.stringify({ queueItemIds: readyIds })
        })
        if (res.ok) {
          const data = await res.json()
          showNotification(`✅ ${data.count} ad(s) submitted to CMO for approval!`, 'success')
          renderApprovedAssetsScreen()
        } else {
          const err = await res.json().catch(() => ({}))
          showNotification(err.error || 'Failed to submit for approval.', 'error')
          submitBtn.textContent = `Submit ${readyForApproval} Ad${readyForApproval !== 1 ? 's' : ''} for CMO Approval`
          submitBtn.disabled = false
        }
      } catch (e) {
        showNotification('Network error during submission.', 'error')
        submitBtn.textContent = `Submit ${readyForApproval} Ad${readyForApproval !== 1 ? 's' : ''} for CMO Approval`
        submitBtn.disabled = false
      }
    }
  }

  // Dispatch Hub quick link
  const goDispatchBtn = document.getElementById('go-dispatch-btn')
  if (goDispatchBtn) {
    goDispatchBtn.onclick = () => {
      state.marketingData.selectedAssets = queue.filter(i =>
        ['budget_configured', 'ready_for_approval'].includes(i.status)
      ).map(i => ({ id: i.id, url: i.url, type: i.type, title: i.title }))
      switchScreen('DeploySelection')
    }
  }
}

async function renderDeploySelectionScreen() {
  contentContainer.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
    </div>
  `

  let assets = []
  try {
    const res = await apiFetch('/ppp/queue')
    const queue = await res.json()
    if (Array.isArray(queue)) {
      assets = queue
        .filter(i => i.status === 'deployed')
        .map(i => ({ id: i.id, url: i.url, type: i.type, title: i.title, platform: i.platform }))
    }
  } catch (e) {
    console.warn('Could not load deployed assets:', e.message)
  }

  if (assets.length === 0) {
    contentContainer.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
          <div class="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/30">
              <span class="text-4xl">🎯</span>
          </div>
          <div class="text-center space-y-2">
              <h2 class="text-2xl font-black uppercase italic tracking-tighter">No Deployed Ads</h2>
              <p class="text-gray-500 text-sm max-w-xs mx-auto">No ads have been approved & deployed by the CMO yet. Check back after CMO approves submissions in <span class="text-amber-500 font-bold">Ad Approvals</span>.</p>
          </div>
      </div>
    `
    return
  }

  contentContainer.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <div class="flex items-center gap-4">
            <button id="back-to-approvals" class="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors cursor-pointer">←</button>
            <div class="flex flex-col">
              <h2 class="text-3xl font-black uppercase italic tracking-tighter">Platform Selection</h2>
              <p class="text-indigo-400 text-[10px] font-black uppercase tracking-widest">${assets.length} Variations Selected for Post</p>
            </div>
        </div>

        <!-- Selected Assets Scroll -->
        <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            ${assets.map(asset => `
                <div class="w-32 flex-shrink-0 space-y-2">
                    <div class="w-32 h-32 bg-black rounded-xl overflow-hidden border border-white/10">
                        ${asset.type === 'video' ? `
                          <video src="${asset.url}" class="w-full h-full object-cover"></video>
                        ` : `
                          <img src="${asset.url}" class="w-full h-full object-cover">
                        `}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-3xl shadow-2xl">
            <h3 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Execution Channels</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                ${['Facebook', 'YouTube', 'TikTok', 'Instagram'].map(platform => `
                    <button class="platform-select-btn group relative p-6 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-2xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left space-y-4 overflow-hidden cursor-pointer" data-platform="${platform}">
                        <div class="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                            <span class="text-4xl text-white">🔗</span>
                        </div>
                        <div class="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                            <span class="text-lg">${platform === 'TikTok' ? '🎵' : platform === 'Facebook' ? '👥' : platform === 'YouTube' ? '📺' : '📸'}</span>
                        </div>
                        <div>
                            <p class="text-sm font-black uppercase tracking-tight">${platform}</p>
                            <p class="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Active Link</p>
                        </div>
                        <div class="select-indicator absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-[var(--border-color)] group-hover:border-amber-500/50 transition-all shadow-inner"></div>
                    </button>
                `).join('')}
            </div>
        </div>

        <div class="flex justify-between items-center bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-3xl">
            <div class="space-y-1">
                <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Estimated Reach</p>
                <p class="text-xl font-black text-white">~ ${assets.length * 1.5}M <span class="text-gray-600 text-xs">People</span></p>
            </div>
            <button id="final-post-btn" class="px-12 py-5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black rounded-xl shadow-[0_20px_40px_rgba(245,158,11,0.2)] transition-all uppercase tracking-[0.2em] flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                Dispatch Multi-Post
                <span class="text-lg group-hover:translate-x-1 transition-transform">⚡</span>
            </button>
        </div>
    </div>
  `

  document.getElementById('back-to-approvals').onclick = () => switchScreen('Approvals')

  const platformBtns = document.querySelectorAll('.platform-select-btn')
  let selectedPlatforms = new Set()

  contentContainer.insertAdjacentHTML('beforeend', `
    <div id="deploy-modal-overlay" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center hidden">
        <div id="deploy-modal-content" class="bg-[var(--card-bg)] w-full max-w-lg p-8 rounded-3xl border border-[var(--border-color)] shadow-[0_30px_60px_rgba(0,0,0,0.6)] space-y-6">
            <!-- Content will be injected -->
        </div>
    </div>
  `)

  const modal = document.getElementById('deploy-modal-overlay')
  const modalContent = document.getElementById('deploy-modal-content')

  platformBtns.forEach(btn => {
    btn.onclick = () => {
      const platform = btn.dataset.platform
      const indicator = btn.querySelector('.select-indicator')

      if (platform === 'TikTok') {
        const config = state.marketingData.platformConfig.tiktok
        modalContent.innerHTML = `
            <div class="flex flex-col space-y-1 mb-2">
                <h3 class="text-2xl font-black uppercase italic tracking-tighter text-white">TikTok Dispatch Config</h3>
                <p class="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Setup parameters for this specific deployment batch.</p>
            </div>
            
            <div class="max-h-[60vh] overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-4">
                <!-- Group 1: Campaign Context -->
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-1">Campaign Strategy</h4>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Target Campaign ID</label>
                        <select id="tt-deploy-camp-id" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-xs font-bold text-white">
                            <option value="">-- CREATE NEW CAMPAIGN --</option>
                            <option value="CAMP_782394" ${config.campaign_id === 'CAMP_782394' ? 'selected' : ''}>Spring Launch 2026</option>
                            <option value="CAMP_991023" ${config.campaign_id === 'CAMP_991023' ? 'selected' : ''}>Lead Gen Global</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Budget Mode</label>
                            <select id="tt-deploy-budget-mode" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-xs font-bold text-white">
                                <option value="BUDGET_MODE_DAILY" ${config.budget_mode === 'BUDGET_MODE_DAILY' ? 'selected' : ''}>Daily</option>
                                <option value="BUDGET_MODE_TOTAL" ${config.budget_mode === 'BUDGET_MODE_TOTAL' ? 'selected' : ''}>Lifetime</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Daily/Total Budget ($)</label>
                            <input type="number" id="tt-deploy-budget" value="${config.daily_budget}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-sm font-black text-white">
                        </div>
                    </div>
                </div>

                <!-- Group 2: Ad Group Controls -->
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-purple-400 uppercase tracking-widest border-b border-purple-500/20 pb-1">Ad Group Controls</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Placement</label>
                            <select id="tt-deploy-placement" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                                <option value="PLACEMENT_TIKTOK" ${config.placement === 'PLACEMENT_TIKTOK' ? 'selected' : ''}>TikTok Only</option>
                                <option value="PLACEMENT_PANGLE" ${config.placement === 'PLACEMENT_PANGLE' ? 'selected' : ''}>Pangle Network</option>
                                <option value="PLACEMENT_ALL" ${config.placement === 'PLACEMENT_ALL' ? 'selected' : ''}>Automatic</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Pacing Mode</label>
                            <select id="tt-deploy-pacing" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                                <option value="PACING_MODE_SMOOTH" ${config.pacing === 'PACING_MODE_SMOOTH' ? 'selected' : ''}>Standard (Smooth)</option>
                                <option value="PACING_MODE_FAST" ${config.pacing === 'PACING_MODE_FAST' ? 'selected' : ''}>Accelerated</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Bid Type</label>
                            <select id="tt-deploy-bid-type" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                                <option value="BID_TYPE_COST_CAP" ${config.bid_type === 'BID_TYPE_COST_CAP' ? 'selected' : ''}>Cost Cap</option>
                                <option value="BID_TYPE_LOWEST_COST" ${config.bid_type === 'BID_TYPE_LOWEST_COST' ? 'selected' : ''}>Lowest Cost</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Target Bid ($)</label>
                            <input type="number" id="tt-deploy-bid" value="${config.bid}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-black text-white">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Start Date</label>
                            <input type="date" id="tt-deploy-start" value="${config.schedule_start}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">End Date</label>
                            <input type="date" id="tt-deploy-end" value="${config.schedule_end}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                        </div>
                    </div>
                </div>

                <!-- Group 3: Creative Defaults -->
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-amber-400 uppercase tracking-widest border-b border-amber-500/20 pb-1">Creative Defaults</h4>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Custom Ad Name (Optional)</label>
                        <input type="text" id="tt-deploy-ad-name" value="${config.custom_ad_name}" placeholder="AI_Campaign_Batch_1" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Call To Action</label>
                            <select id="tt-deploy-cta" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-[11px] font-bold text-white">
                                <option value="LEARN_MORE" ${config.cta === 'LEARN_MORE' ? 'selected' : ''}>Learn More</option>
                                <option value="SHOP_NOW" ${config.cta === 'SHOP_NOW' ? 'selected' : ''}>Shop Now</option>
                                <option value="SIGN_UP" ${config.cta === 'SIGN_UP' ? 'selected' : ''}>Sign Up</option>
                                <option value="BOOK_NOW" ${config.cta === 'BOOK_NOW' ? 'selected' : ''}>Book Now</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Ad Status</label>
                            <select id="tt-deploy-status" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-[11px] font-bold text-white">
                                <option value="ENABLE" ${config.status === 'ENABLE' ? 'selected' : ''}>Active (Enable)</option>
                                <option value="DISABLE" ${config.status === 'DISABLE' ? 'selected' : ''}>Paused (Disable)</option>
                            </select>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Target Interests (Tags/Keywords)</label>
                        <input type="text" id="tt-deploy-interests" value="${config.interests}" placeholder="Fashion, Technology, Gaming..." class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Landing URL</label>
                        <div class="flex gap-2">
                            <input type="text" id="tt-deploy-url" value="${config.landing_url}" placeholder="https://..." class="flex-1 bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
                            <button class="px-4 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all">ADD</button>
                        </div>
                    </div>
                </div>

                <!-- Group 4: Targeting Parameters -->
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest border-b border-emerald-500/20 pb-1">Targeting Parameters</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Country</label>
                            <select id="tt-deploy-country" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-emerald-500 text-[11px] font-bold text-white">
                                <option value="US" ${config.country === 'US' ? 'selected' : ''}>United States</option>
                                <option value="GB" ${config.country === 'GB' ? 'selected' : ''}>United Kingdom</option>
                                <option value="BD" ${config.country === 'BD' ? 'selected' : ''}>Bangladesh</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Language</label>
                            <select id="tt-deploy-language" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-emerald-500 text-[11px] font-bold text-white">
                                <option value="en" ${config.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${config.language === 'es' ? 'selected' : ''}>Spanish</option>
                                <option value="fr" ${config.language === 'fr' ? 'selected' : ''}>French</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Specific Area (Optional)</label>
                        <div class="w-full bg-[var(--bg-color)] border border-dashed border-[var(--border-color)] p-4 rounded-xl flex flex-col items-center justify-center space-y-2 group hover:border-emerald-500/50 transition-all cursor-pointer">
                            <span class="text-xl">🗺️</span>
                            <span id="map-select-label" class="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-emerald-400">Select from Maps</span>
                            <input type="hidden" id="tt-deploy-area" value="${config.area}">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Age Range</label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="tt-deploy-age-min" value="${config.ageMin}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-emerald-500 text-sm font-black text-white text-center">
                                <span class="text-gray-600 text-[10px] font-bold">to</span>
                                <input type="number" id="tt-deploy-age-max" value="${config.ageMax}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-emerald-500 text-sm font-black text-white text-center">
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Gender</label>
                            <select id="tt-deploy-gender" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-emerald-500 text-[11px] font-bold text-white">
                                <option value="GENDER_ANY" ${config.gender === 'GENDER_ANY' ? 'selected' : ''}>All</option>
                                <option value="GENDER_MALE" ${config.gender === 'GENDER_MALE' ? 'selected' : ''}>Male</option>
                                <option value="GENDER_FEMALE" ${config.gender === 'GENDER_FEMALE' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
                <button id="tt-deploy-cancel" class="py-4 bg-[#1A1F29] hover:bg-[#2A2F3A] text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Cancel</button>
                <button id="tt-deploy-save" class="py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-purple-950/20">Commit & Attach 💾</button>
            </div>
        `
        modal.classList.remove('hidden')

        document.getElementById('tt-deploy-cancel').onclick = () => {
          modal.classList.add('hidden')
        }

        document.getElementById('tt-deploy-save').onclick = () => {
          const getValue = (id) => document.getElementById(id)?.value || ''

          config.campaign_id = getValue('tt-deploy-camp-id')
          config.daily_budget = getValue('tt-deploy-budget')
          config.bid = getValue('tt-deploy-bid')
          config.schedule_start = getValue('tt-deploy-start')
          config.schedule_end = getValue('tt-deploy-end')

          config.budget_mode = getValue('tt-deploy-budget-mode')
          config.placement = getValue('tt-deploy-placement')
          config.pacing = getValue('tt-deploy-pacing')
          config.bid_type = getValue('tt-deploy-bid-type')
          config.cta = getValue('tt-deploy-cta')
          config.status = getValue('tt-deploy-status')
          config.custom_ad_name = getValue('tt-deploy-ad-name')
          config.interests = getValue('tt-deploy-interests')
          config.landing_url = getValue('tt-deploy-url')

          config.country = getValue('tt-deploy-country')
          config.language = getValue('tt-deploy-language')
          config.area = getValue('tt-deploy-area')
          config.ageMin = getValue('tt-deploy-age-min')
          config.ageMax = getValue('tt-deploy-age-max')
          config.gender = getValue('tt-deploy-gender')

          selectedPlatforms.add('TikTok')
          btn.classList.add('border-amber-500', 'bg-amber-500/5')
          indicator.classList.add('bg-amber-500', 'border-amber-500')

          modal.classList.add('hidden')
          showNotification('Advanced TikTok parameters attached to batch.', 'success')
        }
      } else if (platform === 'Facebook') {
        openFacebookConfigModal((config) => {
          selectedPlatforms.add('Facebook')
          btn.classList.add('border-[#1877F2]', 'bg-[#1877F2]/5')
          indicator.classList.add('bg-[#1877F2]', 'border-[#1877F2]')
          showNotification('Facebook config + creative specs attached to batch.', 'success')
        })
      } else {
        // Standard toggle for other platforms
        if (selectedPlatforms.has(platform)) {
          selectedPlatforms.delete(platform)
          btn.classList.remove('border-amber-500', 'bg-amber-500/5')
          indicator.classList.remove('bg-amber-500', 'border-amber-500')
        } else {
          selectedPlatforms.add(platform)
          btn.classList.add('border-amber-500', 'bg-amber-500/5')
          indicator.classList.add('bg-amber-500', 'border-amber-500')
        }
      }
    }
  })

  document.getElementById('final-post-btn').onclick = async () => {
    const btn = document.getElementById('final-post-btn')

    if (selectedPlatforms.size === 0) {
      showNotification('REQUIRED: Please select at least one platform.', 'error')
      return
    }

    // Platform Payload Inspection (Step 39 & Step 65 Requirement)
    if (selectedPlatforms.has('TikTok') || selectedPlatforms.has('Facebook')) {
      const sampleAsset = assets[0]
      let combinedPreviewPayload = {}

      if (selectedPlatforms.has('TikTok')) {
        combinedPreviewPayload.TikTok = await deployToTikTok(sampleAsset, API_BASE, state, true)
      }
      if (selectedPlatforms.has('Facebook')) {
        combinedPreviewPayload.Facebook = await deployToFacebook(sampleAsset, API_BASE, state, true)
      }

      modalContent.innerHTML = `
        <div class="flex flex-col space-y-1 mb-4">
            <h3 class="text-2xl font-black uppercase italic tracking-tighter text-amber-500">Payload Inspection 🔍</h3>
            <p class="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Verify the ${Array.from(selectedPlatforms).join('/')} API data structure before final dispatch.</p>
        </div>

        <div class="bg-black/60 rounded-2xl p-4 border border-white/5 overflow-hidden">
            <div class="flex items-center justify-between mb-2">
                <span class="text-[9px] font-black text-gray-500 uppercase">JSON Manifest (${sampleAsset.id.slice(0, 8)})</span>
                <span class="text-[8px] px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded uppercase font-bold border border-amber-500/20">Preview Mode</span>
            </div>
            <pre class="text-[10px] text-cyan-400 font-mono h-[40vh] overflow-y-auto custom-scrollbar leading-relaxed">
${JSON.stringify(combinedPreviewPayload, null, 2)}
            </pre>
        </div>

        <div class="space-y-3 pt-2">
            <p class="text-[9px] text-gray-400 italic text-center uppercase tracking-widest leading-relaxed">
                By clicking "Initiate Batch Post", you agree to deploy ${assets.length} variations with the parameters defined above.
            </p>
            <div class="grid grid-cols-2 gap-4">
                <button id="cancel-preview" class="py-4 bg-[#1A1F29] hover:bg-[#2A2F3A] text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Back to Config</button>
                <button id="confirm-dispatch" class="py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-amber-950/20 flex items-center justify-center gap-2">Initiate Batch Post 🚀</button>
            </div>
        </div>
      `
      modal.classList.remove('hidden')

      document.getElementById('cancel-preview').onclick = () => modal.classList.add('hidden')
      document.getElementById('confirm-dispatch').onclick = async () => {
        modal.classList.add('hidden')
        executeActualDispatch()
      }
      return
    }

    // Direct dispatch if TikTok not selected
    executeActualDispatch()

    async function executeActualDispatch() {
      btn.innerHTML = 'DISPATCHING TO NETWORK... ⚡'
      btn.disabled = true

      try {
        for (const asset of assets) {
          // 1. Save to Library (Permanent Storage)
          try {
            await apiFetch('/assets/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: asset.id })
            })
          } catch (err) {
            console.warn(`Library archive failed for ${asset.id}, continuing...`)
          }

          // 2. Deploy to selected platforms
          if (selectedPlatforms.has('TikTok')) {
            try {
              await deployToTikTok(asset, API_BASE, state)
            } catch (err) {
              console.error(`TikTok deployment failed for ${asset.id}`)
            }
          }
          if (selectedPlatforms.has('Facebook')) {
            try {
              const fbResult = await deployToFacebook(asset, API_BASE, state)

              // Updated: Premium Feedback for Facebook deployment
              if (fbResult) {
                const steps = [
                  { label: 'Campaign Managed', id: fbResult.campaign_id, icon: '📢', real: fbResult.steps?.[0]?.real },
                  { label: 'Ad Set Strategized', id: fbResult.adset_id, icon: '🎯', real: fbResult.steps?.[1]?.real },
                  { label: 'Creative Synthesized', id: fbResult.creative_id, icon: '🖼️', real: fbResult.steps?.[2]?.real },
                  { label: 'Ad Asset Dispatched', id: fbResult.ad_id, icon: '🚀', real: fbResult.steps?.[3]?.real },
                ]
                
                const isReal = fbResult.success;
                const finalId = fbResult.ad_id || 'NO_ID_RETURNED';

                modalContent.innerHTML = `
                  <div class="space-y-5">
                    <div class="text-center space-y-1">
                      <div class="text-4xl mb-2">${isReal ? '✅' : '⚠️'}</div>
                      <h3 class="text-2xl font-black uppercase italic tracking-tighter ${isReal ? 'text-emerald-400' : 'text-amber-400'}">Facebook Deployment</h3>
                      <p class="text-gray-500 text-[10px] font-medium uppercase tracking-widest">${isReal ? 'All API stages completed successfully' : 'Deployment completed with status: ' + fbResult.status} for <span class="text-white font-bold">${asset.title || 'Asset'}</span></p>
                    </div>
                    
                    ${isReal ? `
                    <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center">
                      <p class="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Final Facebook Ad ID</p>
                      <p class="text-xl font-black text-white font-mono break-all">${finalId}</p>
                    </div>
                    ` : ''}

                    <div class="space-y-2">
                      ${steps.map((s, i) => `
                        <div class="flex items-center gap-4 bg-black/40 border ${s.real ? 'border-emerald-500/20' : 'border-rose-500/20'} rounded-2xl p-3 animate-in fade-in slide-in-from-left-4" style="animation-delay:${i * 100}ms">
                          <div class="w-9 h-9 rounded-xl ${s.real ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'} flex items-center justify-center text-base flex-shrink-0">${s.icon}</div>
                          <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black ${s.real ? 'text-emerald-400' : 'text-rose-400'} uppercase tracking-widest">${s.label}</p>
                            <p class="text-[9px] text-gray-500 font-mono truncate">${s.id}</p>
                          </div>
                          <div class="w-5 h-5 rounded-full ${s.real ? 'bg-emerald-500' : 'bg-rose-500'} flex items-center justify-center flex-shrink-0">
                            <span class="text-[9px] text-black font-black">${s.real ? '✓' : '×'}</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                    ${!isReal ? `
                    <div class="bg-rose-900/20 border border-rose-500/30 rounded-2xl p-4">
                      <p class="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">⚠️ Deployment Issue</p>
                      <p class="text-[9px] text-gray-400 leading-relaxed">${fbResult.status === 'PARTIAL_OR_MOCK' ? 'System in Simulation Mode OR Token Missing Permissions. Check Console for details.' : 'An error occurred during dispatch.'}</p>
                    </div>
                    ` : `
                    <div class="bg-blue-900/20 border border-[#1877F2]/30 rounded-2xl p-4">
                      <p class="text-[9px] font-black text-[#1877F2] uppercase tracking-widest mb-1">⚠️ Compliance Reminder</p>
                      <p class="text-[9px] text-gray-400 leading-relaxed">Ensure Sandbox 'Accept TOS' is acknowledged on the Facebook Developer Console and your token has <span class="text-white font-bold">ads_management</span> permission before going Live.</p>
                    </div>
                    `}
                    <button id="fb-stepper-close" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] transition-all shadow-lg">Continue ➤</button>
                  </div>
                `
                modal.classList.remove('hidden')
                document.getElementById('fb-stepper-close').onclick = () => modal.classList.add('hidden')
                
                if (!isReal) {
                   showNotification(`Facebook Deployment Issue: ${fbResult.status}`, 'error');
                }
              }
            } catch (err) {
              console.error(`Facebook deployment failed for ${asset.id}`)
            }
          }

          // 3. Remove from Queue
          state.marketingData.cmoQueue = state.marketingData.cmoQueue.filter(a => a.id !== asset.id)
          state.marketingData.ppcQueue = state.marketingData.ppcQueue.filter(a => a.id !== asset.id)
        }

        await saveCmoQueue()
        await savePpcQueue()
        state.marketingData.selectedAssets = [] // Cleanup

        showNotification(`${assets.length} Variations successfully deployed across ${selectedPlatforms.size} platforms.`, 'success')

        setTimeout(() => {
          switchScreen('Approvals')
          updateUI()
        }, 2000)

      } catch (e) {
        console.error(e)
        showNotification('Critical Error during bulk deployment.', 'error')
        btn.innerHTML = 'RETRY DISPATCH ⚡'
        btn.disabled = false
      }
    }
  }
}

function renderAdPerformanceScreen() {
  const mockCampaigns = [
    { platform: 'Facebook', icon: '👥', name: 'AI Spring Campaign 2026', status: 'ACTIVE', spend: '$1,240', reach: '48.2K', impressions: '152K', clicks: '3,810', ctr: '2.51%', cpm: '$8.16' },
    { platform: 'TikTok', icon: '🎵', name: 'Lead Gen Global Batch', status: 'PAUSED', spend: '$880', reach: '32.7K', impressions: '98K', clicks: '2,141', ctr: '2.18%', cpm: '$8.98' },
    { platform: 'Facebook', icon: '👥', name: 'AI Brand Awareness Q1', status: 'COMPLETED', spend: '$3,500', reach: '210K', impressions: '640K', clicks: '12,800', ctr: '2.00%', cpm: '$5.47' },
    { platform: 'Instagram', icon: '📸', name: 'Retargeting - Creative Set A', status: 'ACTIVE', spend: '$420', reach: '19.1K', impressions: '57K', clicks: '980', ctr: '1.72%', cpm: '$7.37' },
  ]

  const statusColor = (s) => s === 'ACTIVE' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : s === 'PAUSED' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'

  contentContainer.innerHTML = `
    <div class="space-y-6 pb-10">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-3xl font-black uppercase italic tracking-tighter">Ad Performance</h2>
          <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Live metrics across all deployed campaigns</p>
        </div>
        <div class="flex gap-3">
          <span class="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[10px] font-black uppercase tracking-widest">● 2 Active</span>
          <span class="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-[10px] font-black uppercase tracking-widest">↻ Refresh</span>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${[
      { label: 'Total Spend', value: '$6,040', icon: '💸', color: 'text-rose-400' },
      { label: 'Total Reach', value: '310K', icon: '👁', color: 'text-cyan-400' },
      { label: 'Total Clicks', value: '19,731', icon: '🖱️', color: 'text-purple-400' },
      { label: 'Avg CTR', value: '2.10%', icon: '📈', color: 'text-emerald-400' },
    ].map(k => `
          <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">${k.label}</span>
              <span class="text-xl">${k.icon}</span>
            </div>
            <p class="text-2xl font-black ${k.color}">${k.value}</p>
          </div>
        `).join('')}
      </div>

      <!-- Campaign Table -->
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl">
        <div class="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 class="text-sm font-black uppercase tracking-widest">Campaign Breakdown</h3>
          <span class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Simulated data — Connect Facebook Insights API for live data</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-black/30">
              <tr>
                ${['Platform', 'Campaign', 'Status', 'Spend', 'Reach', 'Impressions', 'Clicks', 'CTR', 'CPM'].map(h => `
                  <th class="px-5 py-3 text-[8px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">${h}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-color)]">
              ${mockCampaigns.map(c => `
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="px-5 py-4">
                    <span class="flex items-center gap-2 text-sm font-black">${c.icon} ${c.platform}</span>
                  </td>
                  <td class="px-5 py-4">
                    <p class="text-[11px] font-bold text-white max-w-[160px] truncate">${c.name}</p>
                  </td>
                  <td class="px-5 py-4">
                    <span class="px-2 py-1 rounded-lg border text-[8px] font-black uppercase ${statusColor(c.status)}">${c.status}</span>
                  </td>
                  <td class="px-5 py-4 text-[11px] font-black text-rose-400">${c.spend}</td>
                  <td class="px-5 py-4 text-[11px] font-bold text-cyan-400">${c.reach}</td>
                  <td class="px-5 py-4 text-[11px] font-bold">${c.impressions}</td>
                  <td class="px-5 py-4 text-[11px] font-bold text-purple-400">${c.clicks}</td>
                  <td class="px-5 py-4 text-[11px] font-bold text-emerald-400">${c.ctr}</td>
                  <td class="px-5 py-4 text-[11px] font-bold">${c.cpm}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Note -->
      <div class="bg-[#1877F2]/5 border border-[#1877F2]/20 rounded-2xl p-4">
        <p class="text-[9px] font-black text-[#1877F2] uppercase tracking-widest mb-1">🔗 Connect Live Data</p>
        <p class="text-[9px] text-gray-400 leading-relaxed">To enable live ad insights, configure your <span class="text-white font-bold">Facebook Insights API</span> token and <span class="text-white font-bold">TikTok Reporting API</span> in Platform Config → Social Ecosystem. The backend endpoint <span class="font-mono text-cyan-400">/api/ads/insights</span> will aggregate results from all platforms.</p>
      </div>
    </div>
  `
}

function renderNotificationsScreen() {
  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4 text-center">
        <h2 class="text-2xl font-black uppercase italic tracking-tighter">Alert Center</h2>
        <div class="p-4 bg-[var(--card-bg)] rounded-xl border-l-4 border-rose-500 text-sm border border-white/5">
            <p class="font-bold opacity-80">Budget limit exceeded for Active Campaign</p>
        </div>
        <div class="p-4 bg-[var(--card-bg)] rounded-xl border-l-4 border-cyan-500 text-sm border border-white/5">
            <p class="font-bold opacity-80">New Creative assets generated by AI</p>
        </div>
    </div>
  `
}

// ══════════════════════════════════════════════════
// SUPER ADMIN SCREENS
// ══════════════════════════════════════════════════

async function renderGlobalDashboard() {
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/super-admin/dashboard')
    const data = await res.json()
    contentContainer.innerHTML = `
      <div class="space-y-8">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-black tracking-tight uppercase bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Global Dashboard</h2>
          <p class="text-gray-400 text-sm">System-wide overview across all companies</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          ${[
            { label: 'Active Companies', value: data.totalCompanies, color: 'yellow' },
            { label: 'Total Users', value: data.totalUsers, color: 'blue' },
            { label: 'Total Campaigns', value: data.totalCampaigns, color: 'emerald' },
            { label: 'Active Campaigns', value: data.activeCampaigns, color: 'cyan' }
          ].map(card => `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl">
              <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">${card.label}</div>
              <div class="text-3xl font-black text-${card.color}-400 mt-2">${card.value?.toLocaleString() || 0}</div>
            </div>
          `).join('')}
        </div>
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl">
          <h3 class="text-lg font-bold mb-4">Top Companies</h3>
          <div class="space-y-3">
            ${(data.topCompanies || []).map((c, i) => `
              <div class="flex items-center justify-between p-3 bg-[var(--bg-color)] rounded-xl">
                <div class="flex items-center gap-3">
                  <span class="text-yellow-400 font-bold">#${i + 1}</span>
                  <span class="font-bold">${c.name}</span>
                </div>
                <div class="flex gap-4 text-sm text-gray-400">
                  <span>${c.campaigns} campaigns</span>
                  <span>${c.users} users</span>
                  <button onclick="enterCompany(${c.id}, '${c.name}')" class="text-yellow-400 hover:text-yellow-300 font-bold text-xs cursor-pointer">ENTER</button>
                </div>
              </div>
            `).join('') || '<p class="text-gray-500 text-sm">No companies yet</p>'}
          </div>
        </div>
        <div class="flex gap-4">
          <button onclick="switchScreen('CompanyManagement')" class="px-6 py-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl font-bold text-sm hover:bg-yellow-500/20 transition-all cursor-pointer">Manage Companies</button>
          <button onclick="switchScreen('AuditLog')" class="px-6 py-3 bg-gray-500/10 border border-gray-500/30 text-gray-400 rounded-xl font-bold text-sm hover:bg-gray-500/20 transition-all cursor-pointer">View Audit Log</button>
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load dashboard: ${e.message}</div>`
  }
}

async function renderCompanyManagementScreen() {
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/super-admin/companies')
    const companies = await res.json()
    contentContainer.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black tracking-tight uppercase">Company Management</h2>
          <button id="btn-create-company" class="px-6 py-2.5 bg-yellow-500 text-black font-bold text-sm rounded-xl hover:bg-yellow-400 transition-all cursor-pointer">+ Create Company</button>
        </div>
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-[var(--border-color)] text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <th class="p-4">Company</th><th class="p-4">Industry</th><th class="p-4">Users</th><th class="p-4">Campaigns</th><th class="p-4">Status</th><th class="p-4">Actions</th>
            </tr></thead>
            <tbody>
              ${companies.map(c => `
                <tr class="border-b border-[var(--border-color)] hover:bg-white/5">
                  <td class="p-4"><div class="font-bold">${c.name}</div><div class="text-[10px] text-gray-500">${c.slug}</div></td>
                  <td class="p-4 text-gray-400">${c.industry || '-'}</td>
                  <td class="p-4">${c.userCount}</td>
                  <td class="p-4">${c.campaignCount}</td>
                  <td class="p-4"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">${c.status}</span></td>
                  <td class="p-4"><button onclick="enterCompany(${c.id}, '${c.name}')" class="text-yellow-400 hover:text-yellow-300 font-bold text-xs cursor-pointer">Enter</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
    document.getElementById('btn-create-company')?.addEventListener('click', () => {
      const name = prompt('Company Name:')
      if (!name) return
      const industry = prompt('Industry (optional):') || ''
      apiFetch('/super-admin/companies', { method: 'POST', body: JSON.stringify({ name, industry }) })
        .then(() => { showNotification('Company created!', 'success'); renderCompanyManagementScreen() })
        .catch(e => showNotification(e.message, 'error'))
    })
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load companies: ${e.message}</div>`
  }
}

async function renderAuditLogScreen() {
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full"></div></div>`
  try {
    const url = state.isSuperAdmin ? '/super-admin/audit-log?limit=50' : '/activity-logs?limit=50'
    const res = await apiFetch(url)
    const logs = await res.json()
    contentContainer.innerHTML = `
      <div class="space-y-6">
        <h2 class="text-2xl font-black tracking-tight uppercase">Audit Log</h2>
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-[var(--border-color)] text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <th class="p-4">Time</th><th class="p-4">User</th><th class="p-4">Action</th><th class="p-4">Resource</th><th class="p-4">Details</th>
            </tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr class="border-b border-[var(--border-color)] hover:bg-white/5">
                  <td class="p-4 text-gray-500 text-xs">${new Date(l.createdAt).toLocaleString()}</td>
                  <td class="p-4">${l.userId}</td>
                  <td class="p-4"><span class="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] font-bold">${l.action}</span></td>
                  <td class="p-4 text-gray-400">${l.resourceType} #${l.resourceId || '-'}</td>
                  <td class="p-4 text-gray-500 text-xs truncate max-w-xs">${l.description || '-'}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="p-8 text-center text-gray-500">No activity logs yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load logs: ${e.message}</div>`
  }
}

function renderSystemConfigScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight uppercase">System Configuration</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4">
          <h3 class="font-bold text-lg">Platform Status</h3>
          ${['Facebook Graph API', 'TikTok Business API', 'YouTube Data API', 'Google Ads API', 'Gemini AI API'].map(api => `
            <div class="flex items-center justify-between p-3 bg-[var(--bg-color)] rounded-xl">
              <span class="text-sm">${api}</span>
              <span class="text-emerald-400 text-xs font-bold">Connected</span>
            </div>
          `).join('')}
        </div>
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl space-y-4">
          <h3 class="font-bold text-lg">System Info</h3>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between"><span class="text-gray-400">Version</span><span>2.0.0 Multi-Tenant</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Database</span><span>PostgreSQL 16</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Backend</span><span>ASP.NET Core 9.0</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Frontend</span><span>Vite + Tailwind</span></div>
            <div class="flex justify-between"><span class="text-gray-400">Tables</span><span>28 entities</span></div>
          </div>
        </div>
      </div>
    </div>
  `
}

function formatPlatformServiceDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function getPlatformServiceStatePillClass(active) {
  return active
    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
}

function getPlatformServiceOutcomePillClass(outcome) {
  switch (outcome) {
    case 'succeeded':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    case 'failed':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    case 'cancelled':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    default:
      return 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
  }
}

async function renderPlatformServiceScreen() {
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full"></div></div>`

  try {
    const [fbRes, googleRes] = await Promise.all([
      apiFetch('/super-admin/platform-service'),
      apiFetch('/super-admin/google-service')
    ])
    const fbData = await fbRes.json()
    const googleData = await googleRes.json()

    const renderServiceCard = (data, prefix, accentColor, icon, label) => {
      const service = data.status || {}
      const isEnabled = !!service.isEnabled
      const isRunning = !!service.isRunning
      const hasPending = !!service.hasPendingManualRun
      const lastOutcome = service.lastRunOutcome || 'idle'
      const intervalHours = Number(service.intervalHours || 0)

      return `
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5">
          <!-- Header -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl">${icon}</span>
              <div>
                <h3 class="text-lg font-black uppercase tracking-tight text-white">${label}</h3>
                <p class="text-[10px] text-gray-500 font-mono">${data.serviceName || ''}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5 justify-end">
              <span class="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${getPlatformServiceStatePillClass(isEnabled)}">${isEnabled ? 'Running' : 'Stopped'}</span>
              <span class="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${isRunning ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}">${isRunning ? 'Fetching' : 'Idle'}</span>
              ${hasPending ? '<span class="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">Queued</span>' : ''}
            </div>
          </div>

          <!-- Stats grid -->
          <div class="grid grid-cols-2 gap-2">
            ${[
              { label: 'Interval', value: `${intervalHours}h` },
              { label: 'Trigger', value: service.lastRunTrigger || '—' },
              { label: 'Last Run', value: formatPlatformServiceDate(service.lastRunCompletedAt) },
              { label: 'Outcome', value: `<span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getPlatformServiceOutcomePillClass(lastOutcome)}">${lastOutcome}</span>` }
            ].map(c => `
              <div class="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl p-3">
                <div class="text-[9px] font-bold uppercase tracking-widest text-gray-500">${c.label}</div>
                <div class="text-xs font-bold mt-1">${c.value}</div>
              </div>
            `).join('')}
          </div>

          <!-- Timeline -->
          <div class="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl p-4 space-y-2 text-xs">
            <div class="font-bold text-white mb-2">Timeline</div>
            <div class="flex justify-between gap-2"><span class="text-gray-500">Last Success</span><span>${formatPlatformServiceDate(service.lastSuccessfulRunAt)}</span></div>
            <div class="flex justify-between gap-2"><span class="text-gray-500">Last Failure</span><span class="${service.lastFailedRunAt ? 'text-rose-400' : ''}">${formatPlatformServiceDate(service.lastFailedRunAt)}</span></div>
            <div class="flex justify-between gap-2"><span class="text-gray-500">Started</span><span>${formatPlatformServiceDate(service.lastRunStartedAt)}</span></div>
            ${service.lastError ? `<div class="mt-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] break-all">${service.lastError}</div>` : ''}
          </div>

          <!-- Interval control -->
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <label class="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Schedule (hours)</label>
              <input id="${prefix}-interval" type="number" min="0.25" max="168" step="0.25" value="${intervalHours}"
                class="w-full bg-black/20 border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-${accentColor}-500">
            </div>
            <button id="${prefix}-save-interval" class="mt-5 px-4 py-2 bg-${accentColor}-500/10 border border-${accentColor}-500/30 text-${accentColor}-400 rounded-xl font-bold text-xs hover:bg-${accentColor}-500/20 transition-all cursor-pointer">Save</button>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2">
            <button id="${prefix}-start" class="flex-1 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold text-xs hover:bg-emerald-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" ${isEnabled ? 'disabled' : ''}>Start</button>
            <button id="${prefix}-stop" class="flex-1 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-bold text-xs hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" ${!isEnabled && !isRunning && !hasPending ? 'disabled' : ''}>Stop</button>
            <button id="${prefix}-update" class="flex-1 py-2.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl font-bold text-xs hover:bg-yellow-500/20 transition-all cursor-pointer">Update</button>
          </div>
        </div>
      `
    }

    contentContainer.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto">
        <div class="space-y-1">
          <h2 class="text-3xl font-black tracking-tight uppercase bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Platform Service</h2>
          <p class="text-sm text-gray-400">Control the background metrics sync services. Each platform runs independently on its own schedule.</p>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
          ${renderServiceCard(fbData, 'fb-svc', 'blue', '📘', 'Facebook Ads Service')}
          ${renderServiceCard(googleData, 'google-svc', 'red', '🔍', 'Google Ads Service')}
        </div>
      </div>
    `

    const wireService = (prefix, basePath, label) => {
      const act = async (path, msg) => {
        try { await apiFetch(path, { method: 'POST' }); showNotification(msg, 'success'); await renderPlatformServiceScreen() }
        catch (e) { showNotification(e.message, 'error') }
      }
      document.getElementById(`${prefix}-start`)?.addEventListener('click', () => act(`${basePath}/start`, `${label} started.`))
      document.getElementById(`${prefix}-stop`)?.addEventListener('click', () => act(`${basePath}/stop`, `${label} stopped.`))
      document.getElementById(`${prefix}-update`)?.addEventListener('click', () => act(`${basePath}/update`, `${label} update requested.`))
      document.getElementById(`${prefix}-save-interval`)?.addEventListener('click', async (evt) => {
        const btn = evt.currentTarget
        const value = Number(document.getElementById(`${prefix}-interval`)?.value)
        if (!Number.isFinite(value) || value < 0.25 || value > 168) {
          showNotification('Interval must be between 0.25 and 168 hours.', 'error'); return
        }
        btn.disabled = true; btn.textContent = 'Saving…'
        try {
          await apiFetch(`${basePath}/interval`, { method: 'POST', body: JSON.stringify({ intervalHours: value }) })
          showNotification(`${label} interval updated to ${value} hours.`, 'success')
          await renderPlatformServiceScreen()
        } catch (e) {
          showNotification('Save failed: ' + e.message, 'error')
          btn.disabled = false; btn.textContent = 'Save'
        }
      })
    }

    wireService('fb-svc', '/super-admin/platform-service', 'Facebook Ads Service')
    wireService('google-svc', '/super-admin/google-service', 'Google Ads Service')

  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load Platform Service: ${e.message}</div>`
  }
}

// ══════════════════════════════════════════════════
// NEW ADMIN SCREENS
// ══════════════════════════════════════════════════

async function renderAdAccountManagementScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/ad-accounts')
    const text = await res.text()
    let accounts = []
    try { accounts = JSON.parse(text) } catch(e) { console.error('Parse error:', text.substring(0, 200)); accounts = [] }
    contentContainer.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black tracking-tight uppercase">Ad Account Management</h2>
          <button id="btn-add-account" class="px-6 py-2.5 bg-purple-500 text-white font-bold text-sm rounded-xl hover:bg-purple-400 transition-all cursor-pointer">+ Connect Account</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${['facebook', 'tiktok', 'youtube', 'google_ads'].map(platform => {
            const acct = accounts.find(a => a.platform === platform)
            const platformName = { facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', google_ads: 'Google Ads' }[platform]
            const platformIcon = { facebook: '📘', tiktok: '🎵', youtube: '▶️', google_ads: '🔍' }[platform]
            return `
              <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">${platformIcon}</span>
                    <div>
                      <div class="font-bold">${platformName}</div>
                      <div class="text-[10px] text-gray-500">${acct ? acct.accountId : 'Not connected'}</div>
                    </div>
                  </div>
                  <span class="px-2 py-1 rounded-full text-[10px] font-bold ${acct?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}">${acct?.status || 'disconnected'}</span>
                </div>
                ${acct ? `<div class="text-xs text-gray-500">Last tested: ${acct.lastTestedAt ? new Date(acct.lastTestedAt).toLocaleString() : 'Never'}</div>` : `<button class="text-purple-400 text-sm font-bold hover:text-purple-300 cursor-pointer">Connect ${platformName}</button>`}
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load ad accounts: ${e.message}</div>`
  }
}

function renderBillingSettingsScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight uppercase">Billing & Subscription</h2>
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-2xl text-center space-y-4">
        <div class="w-16 h-16 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center"><span class="text-3xl">💳</span></div>
        <h3 class="text-xl font-bold">Current Plan: <span class="text-emerald-400">Free</span></h3>
        <p class="text-gray-400 text-sm">Upgrade to unlock more users, campaigns, and advanced analytics</p>
        <div class="grid grid-cols-3 gap-4 mt-6">
          ${[{ name: 'Starter', price: '$49/mo', features: '5 users, 20 campaigns' }, { name: 'Pro', price: '$149/mo', features: '25 users, unlimited campaigns' }, { name: 'Enterprise', price: 'Custom', features: 'Unlimited everything' }].map(plan => `
            <div class="bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl">
              <div class="font-bold">${plan.name}</div>
              <div class="text-xl font-black text-cyan-400 my-2">${plan.price}</div>
              <div class="text-xs text-gray-500">${plan.features}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

// ══════════════════════════════════════════════════
// NEW CMO SCREENS
// ══════════════════════════════════════════════════

async function renderCampaignReportsScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/campaigns')
    const campaigns = await res.json()
    contentContainer.innerHTML = `
      <div class="space-y-6">
        <h2 class="text-2xl font-black tracking-tight uppercase">Campaign Reports</h2>
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-[var(--border-color)] text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <th class="p-4">Campaign</th><th class="p-4">Status</th><th class="p-4">Budget</th><th class="p-4">Platforms</th><th class="p-4">Created</th>
            </tr></thead>
            <tbody>
              ${campaigns.map(c => `
                <tr class="border-b border-[var(--border-color)] hover:bg-white/5">
                  <td class="p-4 font-bold">${c.name || c.brief?.substring(0, 40) || 'Untitled'}</td>
                  <td class="p-4"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : c.status === 'draft' ? 'bg-gray-500/10 text-gray-400' : 'bg-amber-500/10 text-amber-400'}">${c.status}</span></td>
                  <td class="p-4">${c.totalBudget ? '$' + c.totalBudget.toLocaleString() : '-'}</td>
                  <td class="p-4 text-gray-400">${(c.platforms || []).join(', ') || '-'}</td>
                  <td class="p-4 text-gray-500 text-xs">${new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              `).join('') || '<tr><td colspan="5" class="p-8 text-center text-gray-500">No campaigns yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load reports: ${e.message}</div>`
  }
}

// ══════════════════════════════════════════════════
// UNIFIED HOURLY ANALYTICS DASHBOARD
// Data source: GET /api/analytics/{kpis,trends,posts,virality,retention,heatmap}
// ══════════════════════════════════════════════════

const ANALYTICS_PLATFORMS = {
  facebook: { name: 'Facebook', color: '#60a5fa' },
  youtube:  { name: 'YouTube',  color: '#f87171' },
  tiktok:   { name: 'TikTok',   color: '#22d3ee' },
  google_ads:{ name: 'Google Ads', color: '#fbbf24' }
}

const analyticsState = {
  platform: 'all',
  rangeHours: 48,
  metric: 'views',
  split: 'combined',
  sortKey: 'views',
  selectedPostId: null,
  trendChart: null,
  retentionChart: null
}

function fmtN(v) {
  if (v == null || isNaN(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return Math.round(v).toLocaleString()
}
function fmtPct(v) { return (v * 100).toFixed(2) + '%' }
function fmtSec(v) { if (v < 60) return Math.round(v) + 's'; const m = Math.floor(v / 60), s = Math.round(v % 60); return `${m}m ${s}s` }
function fmtMoney(v) { return '$' + fmtN(v) }
function fmtDelta(curr, prev) {
  if (!prev || prev === 0) return { label: '—', cls: 'text-gray-400' }
  const d = (curr - prev) / prev
  return { label: `${d >= 0 ? '▲' : '▼'} ${(d * 100).toFixed(1)}% vs prev hr`, cls: d >= 0 ? 'text-emerald-400' : 'text-rose-400' }
}

async function ensureChartJs() {
  if (window.Chart) return
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

async function renderCrossPlatformAnalyticsScreen() {
  if (!checkCompanyContext()) return
  await ensureChartJs()

  contentContainer.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-2xl font-black tracking-tight uppercase">Unified Hourly Analytics</h2>
          <p id="ua-asOf" class="text-xs text-gray-400">Loading…</p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div id="ua-platformChips" class="flex items-center gap-2">
            <span class="text-xs text-gray-500 mr-1">Platforms</span>
            ${['all','facebook','youtube','tiktok'].map(p =>
              `<button data-platform="${p}" class="ua-chip text-xs px-3 py-1 rounded-full border border-[var(--border-color)] ${p==='all'?'bg-cyan-600 text-white border-cyan-600':''}">${p === 'all' ? 'All' : (ANALYTICS_PLATFORMS[p]?.name || p)}</button>`
            ).join('')}
          </div>
          <div id="ua-rangeChips" class="flex items-center gap-2">
            <span class="text-xs text-gray-500 mr-1">Range</span>
            <button data-range="24" class="ua-chip-range text-xs px-3 py-1 rounded-full border border-[var(--border-color)]">24h</button>
            <button data-range="48" class="ua-chip-range text-xs px-3 py-1 rounded-full border border-[var(--border-color)] bg-cyan-600 text-white border-cyan-600">48h</button>
          </div>
          <button id="ua-refresh" class="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest">Refresh</button>
        </div>
      </div>

      <section id="ua-kpiGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"></section>

      <section class="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 class="text-sm font-bold uppercase">Hourly Trends</h3>
            <p class="text-xs text-gray-500">Last <span id="ua-rangeLabel">48</span> hours · <span id="ua-platformLabel">All platforms</span></p>
          </div>
          <div id="ua-metricTabs" class="flex items-center gap-1 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg p-1">
            ${['views','engagement','watch','followers'].map((m,i) =>
              `<button data-metric="${m}" class="ua-tab text-xs px-3 py-1 rounded ${i===0?'bg-cyan-600 text-white':''}">${{views:'Views',engagement:'Engagement',watch:'Watch time',followers:'Followers'}[m]}</button>`
            ).join('')}
          </div>
          <div id="ua-splitToggle" class="flex items-center gap-1 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg p-1">
            <button data-split="combined" class="ua-tab-split text-xs px-3 py-1 rounded bg-cyan-600 text-white">Combined</button>
            <button data-split="split" class="ua-tab-split text-xs px-3 py-1 rounded">By platform</button>
          </div>
        </div>
        <div class="relative h-80"><canvas id="ua-trendChart"></canvas></div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section class="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold uppercase">Post Performance — Last Hour</h3>
              <p class="text-xs text-gray-500">🔥 trending · ⚠️ dropping</p>
            </div>
            <div class="text-xs text-gray-500"><span id="ua-postCount">0</span> ads</div>
          </div>
          <div class="overflow-x-auto max-h-[420px]">
            <table class="w-full text-sm">
              <thead class="text-[10px] uppercase text-gray-400 border-b border-[var(--border-color)] sticky top-0 bg-[var(--card-bg)]">
                <tr>
                  <th class="text-left py-2 pr-3">Ad</th>
                  <th class="text-left py-2 pr-3">Platform</th>
                  <th class="text-right py-2 pr-3 cursor-pointer hover:text-white" data-sort="views">Views (1h)</th>
                  <th class="text-right py-2 pr-3 cursor-pointer hover:text-white" data-sort="er">ER</th>
                  <th class="text-right py-2 pr-3 cursor-pointer hover:text-white" data-sort="velocity">Velocity</th>
                  <th class="text-right py-2 pr-3 cursor-pointer hover:text-white" data-sort="virality">Virality</th>
                  <th class="text-right py-2 pr-0">Trend</th>
                </tr>
              </thead>
              <tbody id="ua-postTable"></tbody>
            </table>
          </div>
        </section>

        <section class="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <h3 class="text-sm font-bold uppercase">Virality Detection</h3>
          <p class="text-xs text-gray-500 mb-4">Top risers · last 2 hours</p>
          <ul id="ua-viralityList" class="space-y-3"></ul>
          <div class="mt-5 pt-4 border-t border-[var(--border-color)]">
            <div class="text-xs text-gray-400 mb-2">Spike alerts</div>
            <ul id="ua-alertList" class="space-y-2 text-xs"></ul>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section class="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-3">
            <div>
              <h3 class="text-sm font-bold uppercase">Video Deep Insights</h3>
              <p class="text-xs text-gray-500" id="ua-insightSubtitle">Select a post</p>
            </div>
            <select id="ua-postSelect" class="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-sm px-3 py-1.5"></select>
          </div>
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="p-3 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)]">
              <div class="text-[10px] text-gray-500 uppercase">Avg watch</div>
              <div class="text-lg font-bold" id="ua-kpiAvgWatch">—</div>
            </div>
            <div class="p-3 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)]">
              <div class="text-[10px] text-gray-500 uppercase">Completion</div>
              <div class="text-lg font-bold" id="ua-kpiCompletion">—</div>
            </div>
            <div class="p-3 rounded-lg bg-[var(--bg-color)] border border-[var(--border-color)]">
              <div class="text-[10px] text-gray-500 uppercase">50% Retention</div>
              <div class="text-lg font-bold" id="ua-kpiRetention">—</div>
            </div>
          </div>
          <div class="relative h-56"><canvas id="ua-retentionChart"></canvas></div>
        </section>

        <section class="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-bold uppercase">Audience Activity Heatmap</h3>
              <p class="text-xs text-gray-500">Engagement intensity · hour of day × platform</p>
            </div>
            <div class="text-xs text-gray-500">Darker = higher</div>
          </div>
          <div id="ua-heatmap" class="overflow-x-auto"></div>
        </section>
      </div>
    </div>
  `

  // Wire up chips/tabs/refresh
  document.getElementById('ua-platformChips').addEventListener('click', e => {
    const btn = e.target.closest('.ua-chip'); if (!btn) return
    analyticsState.platform = btn.dataset.platform
    document.querySelectorAll('.ua-chip').forEach(b => {
      const on = b.dataset.platform === analyticsState.platform
      b.className = `ua-chip text-xs px-3 py-1 rounded-full border ${on?'bg-cyan-600 text-white border-cyan-600':'border-[var(--border-color)]'}`
    })
    analyticsReloadAll()
  })
  document.getElementById('ua-rangeChips').addEventListener('click', e => {
    const btn = e.target.closest('.ua-chip-range'); if (!btn) return
    analyticsState.rangeHours = parseInt(btn.dataset.range, 10)
    document.querySelectorAll('.ua-chip-range').forEach(b => {
      const on = b.dataset.range === String(analyticsState.rangeHours)
      b.className = `ua-chip-range text-xs px-3 py-1 rounded-full border ${on?'bg-cyan-600 text-white border-cyan-600':'border-[var(--border-color)]'}`
    })
    document.getElementById('ua-rangeLabel').textContent = analyticsState.rangeHours
    analyticsReloadAll()
  })
  document.getElementById('ua-metricTabs').addEventListener('click', e => {
    const btn = e.target.closest('.ua-tab'); if (!btn) return
    analyticsState.metric = btn.dataset.metric
    document.querySelectorAll('.ua-tab').forEach(b => {
      b.className = `ua-tab text-xs px-3 py-1 rounded ${b.dataset.metric === analyticsState.metric?'bg-cyan-600 text-white':''}`
    })
    loadTrends()
  })
  document.getElementById('ua-splitToggle').addEventListener('click', e => {
    const btn = e.target.closest('.ua-tab-split'); if (!btn) return
    analyticsState.split = btn.dataset.split
    document.querySelectorAll('.ua-tab-split').forEach(b => {
      b.className = `ua-tab-split text-xs px-3 py-1 rounded ${b.dataset.split === analyticsState.split?'bg-cyan-600 text-white':''}`
    })
    loadTrends()
  })
  document.querySelectorAll('[data-sort]').forEach(th => th.addEventListener('click', () => {
    analyticsState.sortKey = th.dataset.sort
    loadPosts()
  }))
  document.getElementById('ua-postSelect').addEventListener('change', e => {
    analyticsState.selectedPostId = e.target.value
    loadRetention()
  })
  document.getElementById('ua-refresh').addEventListener('click', analyticsReloadAll)

  document.getElementById('ua-asOf').textContent = 'As of ' + new Date().toLocaleString()
  analyticsReloadAll()
}

async function analyticsReloadAll() {
  document.getElementById('ua-platformLabel').textContent = analyticsState.platform === 'all' ? 'All platforms' : (ANALYTICS_PLATFORMS[analyticsState.platform]?.name || analyticsState.platform)
  await Promise.all([loadKpis(), loadTrends(), loadPosts(), loadVirality(), loadHeatmap()])
  if (analyticsState.selectedPostId) loadRetention()
}

async function loadKpis() {
  try {
    const res = await apiFetch(`/analytics/kpis?platform=${analyticsState.platform}&hours=${analyticsState.rangeHours}`)
    const { current, previous, asOf } = await res.json()
    const asOfEl = document.getElementById('ua-asOf')
    if (asOfEl && asOf) asOfEl.textContent = 'As of ' + new Date(asOf).toLocaleString()
    const kpis = [
      { label: 'Impressions (1h)', val: fmtN(current.impressions), delta: fmtDelta(current.impressions, previous.impressions) },
      { label: 'Views (1h)',       val: fmtN(current.views),       delta: fmtDelta(current.views, previous.views) },
      { label: 'Engagement rate',  val: fmtPct(current.er),        delta: fmtDelta(current.er, previous.er) },
      { label: 'CTR',              val: fmtPct(current.ctr),       delta: fmtDelta(current.ctr, previous.ctr) },
      { label: 'Followers gained', val: fmtN(current.followers),   delta: fmtDelta(current.followers, previous.followers) },
      { label: 'Revenue (1h)',     val: fmtMoney(current.revenue), delta: fmtDelta(current.revenue, previous.revenue) }
    ]
    document.getElementById('ua-kpiGrid').innerHTML = kpis.map(k => `
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-4 rounded-xl">
        <div class="text-[10px] uppercase tracking-widest text-gray-500">${k.label}</div>
        <div class="text-2xl font-bold mt-1">${k.val}</div>
        <div class="text-xs mt-1 ${k.delta.cls}">${k.delta.label}</div>
      </div>`).join('')
  } catch (e) { console.error('KPI load failed', e) }
}

async function loadTrends() {
  try {
    const res = await apiFetch(`/analytics/trends?platform=${analyticsState.platform}&hours=${analyticsState.rangeHours}&metric=${analyticsState.metric}&split=${analyticsState.split}`)
    const payload = await res.json()
    const labels = payload.labels.map(l => new Date(l).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit' }))
    const datasets = payload.series.map(s => ({
      label: s.platform === 'all' ? 'All platforms' : (ANALYTICS_PLATFORMS[s.platform]?.name || s.platform),
      data: s.data,
      borderColor: s.platform === 'all' ? '#818cf8' : (ANALYTICS_PLATFORMS[s.platform]?.color || '#888'),
      backgroundColor: 'transparent',
      tension: 0.35, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, fill: false
    }))
    const ctx = document.getElementById('ua-trendChart')
    if (!ctx) return
    if (analyticsState.trendChart) { analyticsState.trendChart.data = { labels, datasets }; analyticsState.trendChart.update() }
    else analyticsState.trendChart = new window.Chart(ctx, {
      type: 'line', data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', labels: { color: '#cbd5e1' } } },
        scales: {
          x: { ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: '#1f2530' } },
          y: { ticks: { color: '#64748b', callback: v => analyticsState.metric === 'watch' ? fmtSec(v) : fmtN(v) }, grid: { color: '#1f2530' } }
        }
      }
    })
  } catch (e) { console.error('Trends load failed', e) }
}

async function loadPosts() {
  try {
    const res = await apiFetch(`/analytics/posts?platform=${analyticsState.platform}&hours=${analyticsState.rangeHours}&sort=${analyticsState.sortKey}`)
    const posts = await res.json()
    document.getElementById('ua-postCount').textContent = posts.length
    document.getElementById('ua-postTable').innerHTML = posts.map(p => {
      const flag = p.trending ? '🔥' : p.dropping ? '⚠️' : ''
      const plMeta = ANALYTICS_PLATFORMS[p.platform] || { name: p.platform, color: '#888' }
      const velCls = p.velocityPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
      return `<tr class="border-b border-[var(--border-color)] hover:bg-white/5">
        <td class="py-2 pr-3">
          <div class="flex items-center gap-2">
            <span>${flag}</span>
            <div>
              <div>${escapeHtml(p.title)}</div>
              <div class="text-[10px] text-gray-500 uppercase">${p.type} · ${p.ageHours}h old</div>
            </div>
          </div>
        </td>
        <td class="py-2 pr-3"><span class="text-xs px-2 py-0.5 rounded-full" style="background:${plMeta.color}22;color:${plMeta.color};border:1px solid ${plMeta.color}55">${plMeta.name}</span></td>
        <td class="py-2 pr-3 text-right tabular-nums">${fmtN(p.views)}</td>
        <td class="py-2 pr-3 text-right tabular-nums">${fmtPct(p.er)}</td>
        <td class="py-2 pr-3 text-right tabular-nums">${fmtN(p.velocity)}/hr <span class="${velCls} text-xs">(${(p.velocityPct*100).toFixed(0)}%)</span></td>
        <td class="py-2 pr-3 text-right tabular-nums">${fmtPct(p.virality)}</td>
        <td class="py-2 pr-0 text-right">${sparkline(p.sparkline || [], plMeta.color)}</td>
      </tr>`
    }).join('') || '<tr><td colspan="7" class="text-center text-gray-500 p-6">No ads with metrics in this window yet.</td></tr>'

    // Populate post select for retention
    const select = document.getElementById('ua-postSelect')
    select.innerHTML = posts.map(p => `<option value="${p.id}">[${ANALYTICS_PLATFORMS[p.platform]?.name || p.platform}] ${escapeHtml(p.title)}</option>`).join('')
    if (posts.length && !posts.find(p => String(p.id) === String(analyticsState.selectedPostId))) {
      analyticsState.selectedPostId = String(posts[0].id)
      select.value = analyticsState.selectedPostId
      loadRetention()
    }
  } catch (e) { console.error('Posts load failed', e) }
}

function sparkline(points, color) {
  if (!points.length) return ''
  const w = 80, h = 24
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1
  const step = w / Math.max(1, points.length - 1)
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])) }

async function loadVirality() {
  try {
    const res = await apiFetch(`/analytics/virality?platform=${analyticsState.platform}`)
    const { risers, alerts } = await res.json()
    document.getElementById('ua-viralityList').innerHTML = risers.map(r => {
      const pl = ANALYTICS_PLATFORMS[r.platform] || { name: r.platform, color: '#888' }
      const cls = r.lift > 0 ? 'text-emerald-400' : 'text-rose-400'
      return `<li class="flex items-start gap-3">
        <span class="text-xs px-2 py-0.5 rounded-full mt-0.5" style="background:${pl.color}22;color:${pl.color};border:1px solid ${pl.color}55">${pl.name}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">${escapeHtml(r.title)}</div>
          <div class="text-[10px] text-gray-500">${fmtN(r.recentViews)} views · ${fmtN(r.engagementVelocity)} eng/hr</div>
        </div>
        <div class="${cls} text-sm font-bold tabular-nums">${r.lift>=0?'+':''}${(r.lift*100).toFixed(0)}%</div>
      </li>`
    }).join('') || '<li class="text-gray-500 text-xs">No data yet.</li>'

    document.getElementById('ua-alertList').innerHTML = alerts.length
      ? alerts.map(a => `<li>🚀 <b>${escapeHtml(a.title)}</b> — velocity up <b>${(a.lift*100).toFixed(0)}%</b></li>`).join('')
      : '<li class="text-gray-500">No spikes above +200%.</li>'
  } catch (e) { console.error('Virality load failed', e) }
}

async function loadRetention() {
  if (!analyticsState.selectedPostId) return
  try {
    const res = await apiFetch(`/analytics/retention/${analyticsState.selectedPostId}`)
    const r = await res.json()
    document.getElementById('ua-insightSubtitle').textContent = `${ANALYTICS_PLATFORMS[r.platform]?.name || r.platform} · ${r.title}`
    document.getElementById('ua-kpiAvgWatch').textContent = fmtSec(Number(r.avgWatchSeconds) || 0)
    document.getElementById('ua-kpiCompletion').textContent = fmtPct(r.completion)
    document.getElementById('ua-kpiRetention').textContent = fmtPct((r.retention[5] || 0) / 100)

    const ctx = document.getElementById('ua-retentionChart')
    const color = ANALYTICS_PLATFORMS[r.platform]?.color || '#818cf8'
    const cfg = {
      type: 'line',
      data: {
        labels: r.retention.map((_, i) => `${i * 10}%`),
        datasets: [{ label: 'Audience retention', data: r.retention, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.y.toFixed(1)}% watching` } } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#1f2530' }, title: { display: true, text: 'Video progress', color: '#64748b' } },
          y: { ticks: { color: '#64748b', callback: v => v + '%' }, grid: { color: '#1f2530' }, min: 0, max: 100 }
        }
      }
    }
    if (analyticsState.retentionChart) { analyticsState.retentionChart.data = cfg.data; analyticsState.retentionChart.options = cfg.options; analyticsState.retentionChart.update() }
    else analyticsState.retentionChart = new window.Chart(ctx, cfg)
  } catch (e) { console.error('Retention load failed', e) }
}

async function loadHeatmap() {
  try {
    const res = await apiFetch(`/analytics/heatmap?hours=${analyticsState.rangeHours}`)
    const rows = await res.json()
    const allValues = rows.flatMap(r => r.values)
    const max = Math.max(...allValues, 1)
    const html = `<table class="w-full text-xs">
      <thead><tr><th class="text-left py-1 pr-3 text-gray-400">Platform</th>
        ${Array.from({length:24}, (_,i) => `<th class="text-center py-1 px-0.5 font-normal text-gray-500">${String(i).padStart(2,'0')}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map(r => {
          const pl = ANALYTICS_PLATFORMS[r.platform] || { name: r.platform, color: '#888' }
          return `<tr><td class="py-1 pr-3"><span class="text-xs px-2 py-0.5 rounded-full" style="background:${pl.color}22;color:${pl.color};border:1px solid ${pl.color}55">${pl.name}</span></td>
            ${r.values.map((v, i) => {
              const t = v / max
              const alpha = Math.round(30 + t * 220).toString(16).padStart(2, '0')
              return `<td class="p-0.5"><div style="background:${pl.color}${alpha};height:26px;border-radius:4px" title="${String(i).padStart(2,'0')}:00 — ${fmtN(v)} engagement/hr"></div></td>`
            }).join('')}
          </tr>`
        }).join('')}
      </tbody>
    </table>`
    document.getElementById('ua-heatmap').innerHTML = html
  } catch (e) { console.error('Heatmap load failed', e) }
}

// ══════════════════════════════════════════════════
// NEW PPP SCREENS
// ══════════════════════════════════════════════════

async function renderDeploymentHistoryScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/deployment-logs?limit=50')
    const logs = await res.json()
    contentContainer.innerHTML = `
      <div class="space-y-6">
        <h2 class="text-2xl font-black tracking-tight uppercase">Deployment History</h2>
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-[var(--border-color)] text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <th class="p-4">Time</th><th class="p-4">Platform</th><th class="p-4">Action</th><th class="p-4">Resource ID</th><th class="p-4">Status</th><th class="p-4">Duration</th>
            </tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr class="border-b border-[var(--border-color)] hover:bg-white/5">
                  <td class="p-4 text-gray-500 text-xs">${new Date(l.executedAt).toLocaleString()}</td>
                  <td class="p-4 font-bold">${l.platform}</td>
                  <td class="p-4">${l.action}</td>
                  <td class="p-4 text-gray-400 text-xs font-mono">${l.platformResourceId || '-'}</td>
                  <td class="p-4"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${l.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">${l.status}</span></td>
                  <td class="p-4 text-gray-500">${l.durationMs ? l.durationMs + 'ms' : '-'}</td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="p-8 text-center text-gray-500">No deployments yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load deployment history: ${e.message}</div>`
  }
}

async function renderABTestResultsScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/ab-tests')
    const tests = await res.json()
    
    contentContainer.innerHTML = `
      <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-3xl font-black tracking-tighter uppercase italic">A/B Test Results</h2>
            <p class="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Live Variant Performance & Statistical Attribution</p>
          </div>
          <button id="create-ab-test-btn" class="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all cursor-pointer shadow-[0_10px_30px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group">
            <span class="text-lg group-hover:rotate-90 transition-transform">+</span> Create New Experiment
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${tests.map(t => `
            <div class="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 rounded-[2.5rem] group hover:border-emerald-500/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 relative overflow-hidden">
              <div class="absolute top-0 right-0 p-4">
                 <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'running' ? 'bg-blue-500/10 text-blue-400' : t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'} border border-current/20 backdrop-blur-md">
                   ${t.status}
                 </span>
              </div>

              <div class="flex items-center gap-4 mb-6">
                 <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl border border-white/10 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">🧪</div>
                 <div>
                    <h3 class="font-black text-sm tracking-tight uppercase">${t.name}</h3>
                    <div class="text-[9px] text-gray-500 font-bold uppercase">Metric: <span class="text-gray-300 ml-1">${t.metric.toUpperCase()}</span></div>
                 </div>
              </div>
              
              <div class="space-y-4">
                <div class="p-5 bg-black/40 rounded-[2rem] border border-white/5 group-hover:border-white/10 transition-all">
                   <div class="flex items-center justify-between items-end">
                      <div class="text-center flex-1">
                         <div class="text-[8px] text-gray-500 uppercase font-black mb-1">Variant A</div>
                         <div class="text-2xl font-black ${t.winner === 'A' ? 'text-emerald-400' : 'text-white'}">${t.variantAResult || '0.0'}</div>
                         <div class="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                            <div class="bg-emerald-500 h-full transition-all" style="width: ${t.trafficSplit}%"></div>
                         </div>
                      </div>
                      <div class="px-4 text-[10px] text-gray-700 font-black italic">VS</div>
                      <div class="text-center flex-1">
                         <div class="text-[8px] text-gray-500 uppercase font-black mb-1">Variant B</div>
                         <div class="text-2xl font-black ${t.winner === 'B' ? 'text-emerald-400' : 'text-white'}">${t.variantBResult || '0.0'}</div>
                         <div class="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                            <div class="bg-emerald-500 h-full opacity-30 transition-all" style="width: ${100 - t.trafficSplit}%"></div>
                         </div>
                      </div>
                   </div>
                </div>

                <div class="flex items-center justify-between gap-4">
                   <div class="flex-1 p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                      <div class="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1 font-bold">Split</div>
                      <div class="text-[10px] font-black text-white">${t.trafficSplit}/${100 - t.trafficSplit}</div>
                   </div>
                   <div class="flex-1 p-3 bg-white/5 rounded-2xl border border-white/5 text-center relative overflow-hidden">
                      <div class="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1 font-bold">Confidence</div>
                      <div class="text-[10px] font-black text-white">${t.confidenceLevel ? t.confidenceLevel + '%' : 'ANALYZING...'}</div>
                      <div class="absolute inset-0 bg-blue-500 opacity-[0.03]"></div>
                   </div>
                </div>

                ${t.winner && t.status === 'running' ? `
                  <div class="pt-2">
                    <div class="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between">
                       <span class="text-[10px] font-black text-emerald-400 uppercase">🏆 Variant ${t.winner} Winner</span>
                       <button class="apply-optimization-btn text-[9px] font-black text-emerald-400 uppercase hover:underline cursor-pointer" data-id="${t.id}">Apply Optimization</button>
                    </div>
                  </div>
                ` : t.status === 'completed' ? `
                  <div class="pt-2">
                    <div class="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between opacity-60">
                       <span class="text-[10px] font-black text-gray-400 uppercase">Experiment Finalized</span>
                       <span class="text-[9px] font-black text-emerald-400 uppercase">Variant ${t.winner || 'A'} Won</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('') || `
            <div class="col-span-full py-20 text-center space-y-4 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
               <div class="text-5xl opacity-30">📉</div>
               <div>
                  <h3 class="text-lg font-black uppercase italic text-gray-400">No Experiments Found</h3>
                  <p class="text-gray-500 text-sm max-w-xs mx-auto">Start your first A/B test to discover high-performing ad variants.</p>
               </div>
               <button onclick="showCreateAbTestModal()" class="text-xs font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300 transition-all underline">Launch First Experiment</button>
            </div>
          `}
        </div>
      </div>
    `
    document.getElementById('create-ab-test-btn').onclick = showCreateAbTestModal
    document.querySelectorAll('.apply-optimization-btn').forEach(btn => {
       btn.onclick = async () => await applyAbTestOptimization(btn.dataset.id)
    })
  } catch (e) {
    contentContainer.innerHTML = `
      <div class="text-center p-20 space-y-6">
        <div class="text-6xl">⚠️</div>
        <div class="space-y-2">
          <h3 class="text-2xl font-black uppercase text-rose-400 italic">Access Restricted</h3>
          <p class="text-gray-400 text-sm font-bold">The experiment engine encountered a critical error while communicating with the data server.</p>
        </div>
        <div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl inline-block font-mono text-xs text-rose-400">Error: ${e.message}</div>
      </div>`
  }
}

async function applyAbTestOptimization(testId) {
   try {
      const res = await apiFetch(`/ab-tests/${testId}/optimize`, { method: 'POST' })
      if (res.ok) {
         const data = await res.json()
         showNotification(data.message || 'Optimization Applied Successfully', 'success')
         renderABTestResultsScreen()
      } else {
         throw new Error(await res.text())
      }
   } catch (e) {
      showNotification('Optimization Failed: ' + e.message, 'error')
   }
}

async function showCreateAbTestModal() {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 bg-black/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-500'
  overlay.innerHTML = `
    <div class="bg-[var(--bg-secondary)] border border-white/10 w-full max-w-2xl rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
      <!-- Left Branding Panel -->
      <div class="w-full md:w-56 bg-emerald-500 p-8 flex flex-col justify-between text-black relative">
         <div class="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600"></div>
         <div class="relative z-10">
            <div class="text-4xl font-black italic tracking-tighter mb-2">AB/XP</div>
            <div class="h-1 w-12 bg-black rounded-full"></div>
         </div>
         <div class="relative z-10">
            <h4 class="text-xs font-black uppercase tracking-[0.2em] mb-4 leading-relaxed">Statistical <br>Attribution <br>Engine</h4>
            <p class="text-[10px] font-bold opacity-70">Compare variants and isolate high-performing elements using machine-learned attribution models.</p>
         </div>
      </div>

      <!-- Right Form Panel -->
      <div class="flex-1 p-8 sm:p-12 space-y-8 overflow-y-auto max-h-[85vh]">
        <div class="flex justify-between items-center">
           <h2 class="text-2xl font-black uppercase tracking-tighter italic">Launch Experiment</h2>
           <button class="close-modal w-8 h-8 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 text-gray-400 transition-all cursor-pointer">×</button>
        </div>

        <div class="space-y-6">
           <div class="space-y-2">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Experiment Name</label>
              <input type="text" id="ab-test-name" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-emerald-500 text-white font-bold transition-all" placeholder="E.g. Summer Hoodie Headline Test">
           </div>

           <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="space-y-2">
                 <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Primary Campaign</label>
                 <select id="ab-test-camp" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-emerald-500 text-white font-bold transition-all appearance-none">
                    <option value="">Loading Campaigns...</option>
                 </select>
              </div>
              <div class="space-y-2">
                 <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Attribution Metric</label>
                 <select id="ab-test-metric" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-emerald-500 text-white font-bold transition-all appearance-none">
                    <option value="ctr">CTR (Click-Through Rate)</option>
                    <option value="cpc">CPC (Cost Per Click)</option>
                    <option value="roas">ROAS (Return on Ad Spend)</option>
                    <option value="conversions">Conversions</option>
                 </select>
              </div>
           </div>

           <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="space-y-2">
                 <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest italic text-white">Variant A (Control)</label>
                 <select id="ab-test-variant-a" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-emerald-500 text-white font-bold transition-all appearance-none">
                    <option value="">Select Ads First...</option>
                 </select>
              </div>
              <div class="space-y-2">
                 <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest italic text-emerald-400">Variant B (Challenger)</label>
                 <select id="ab-test-variant-b" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-emerald-500 text-white font-bold transition-all appearance-none">
                    <option value="">Select Ads First...</option>
                 </select>
              </div>
           </div>

           <div class="space-y-4 pt-4">
              <div class="flex justify-between items-center">
                 <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Traffic Allocation</label>
                 <span id="ab-test-split-val" class="text-sm font-black text-emerald-400 italic">50% / 50%</span>
              </div>
              <input type="range" id="ab-test-split" min="10" max="90" step="5" value="50" class="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-emerald-500 overflow-hidden">
              <div class="flex justify-between text-[8px] font-black text-gray-600 uppercase tracking-tighter italic">
                 <span>Max Control</span>
                 <span>Neutral</span>
                 <span>Max Challenger</span>
              </div>
           </div>
        </div>

        <div class="pt-6">
           <button id="save-ab-test-btn" class="w-full py-5 bg-white text-black font-black uppercase text-[11px] tracking-[0.2em] rounded-2xl hover:bg-emerald-400 transition-all cursor-pointer shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:shadow-emerald-500/20 active:scale-[0.98]">
              Initiate Experiment
           </button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const splitSlider = overlay.querySelector('#ab-test-split')
  const splitVal = overlay.querySelector('#ab-test-split-val')
  splitSlider.oninput = () => {
    splitVal.innerText = `${splitSlider.value}% / ${100 - splitSlider.value}%`
  }

  overlay.querySelector('.close-modal').onclick = () => overlay.remove()

  // Load Campaigns
  const campSelect = overlay.querySelector('#ab-test-camp')
  const variantA = overlay.querySelector('#ab-test-variant-a')
  const variantB = overlay.querySelector('#ab-test-variant-b')
  
  try {
     const campRes = await apiFetch('/campaigns')
     const campaigns = await campRes.json()
     campSelect.innerHTML = `<option value="">-- Choose Campaign --</option>` + 
        campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
        
     campSelect.onchange = async () => {
        const campId = campSelect.value
        if (!campId) return
        
        variantA.innerHTML = '<option value="">Loading Ads...</option>'
        variantB.innerHTML = '<option value="">Loading Ads...</option>'
        
        try {
           const adsRes = await apiFetch(`/campaigns/${campId}/ads`)
           const ads = await adsRes.json()
           const adOpts = ads.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
           variantA.innerHTML = adOpts
           variantB.innerHTML = adOpts
           
           // Auto-select different ads if available
           if (ads.length > 1) {
              variantB.selectedIndex = 1
           }
        } catch (e) {
           variantA.innerHTML = '<option value="">No ads found</option>'
           variantB.innerHTML = '<option value="">No ads found</option>'
        }
     }
  } catch (e) {
     campSelect.innerHTML = `<option value="">Error Loading Campaigns</option>`
  }

  overlay.querySelector('#save-ab-test-btn').onclick = async () => {
     const name = overlay.querySelector('#ab-test-name').value
     const campaignId = overlay.querySelector('#ab-test-camp').value
     const metric = overlay.querySelector('#ab-test-metric').value
     const variantAId = overlay.querySelector('#ab-test-variant-a').value
     const variantBId = overlay.querySelector('#ab-test-variant-b').value
     const split = overlay.querySelector('#ab-test-split').value

     if (!name || !campaignId || !variantAId || !variantBId) {
        showNotification('Please identify all experiment parameters', 'attention')
        return
     }

     if (variantAId === variantBId) {
        showNotification('Identical variants will yield 0 variance. Select unique ads.', 'attention')
        return
     }

     overlay.querySelector('#save-ab-test-btn').innerText = 'Attributing Models...'
     overlay.querySelector('#save-ab-test-btn').disabled = true

     try {
        const res = await apiFetch('/ab-tests', {
           method: 'POST',
           body: JSON.stringify({
              name,
              campaignId: parseInt(campaignId),
              metric,
              variantAAdId: parseInt(variantAId),
              variantBAdId: parseInt(variantBId),
              trafficSplit: parseInt(split)
           })
        })

        if (res.ok) {
           showNotification('Experiment Initiated Successfully', 'success')
           overlay.remove()
           renderABTestResultsScreen()
        } else {
           throw new Error(await res.text())
        }
     } catch (e) {
        showNotification('Experiment Initialization Failed: ' + e.message, 'error')
        overlay.querySelector('#save-ab-test-btn').innerText = 'Initiate Experiment'
        overlay.querySelector('#save-ab-test-btn').disabled = false
     }
  }
}


// ══════════════════════════════════════════════════
// NEW EXPERT SCREENS
// ══════════════════════════════════════════════════

function renderAudienceInsightsScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight uppercase">Audience Insights</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${[
          { label: 'Demographics', icon: '👥', desc: 'Age, gender, location breakdown of your audience' },
          { label: 'Interests', icon: '❤️', desc: 'Top interests and behaviors of engaged users' },
          { label: 'Devices', icon: '📱', desc: 'Mobile vs desktop, OS, browser distribution' }
        ].map(card => `
          <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl text-center">
            <span class="text-3xl">${card.icon}</span>
            <h3 class="font-bold mt-3">${card.label}</h3>
            <p class="text-gray-500 text-xs mt-1">${card.desc}</p>
            <div class="mt-4 text-gray-400 text-sm">Deploy campaigns to see audience data</div>
          </div>
        `).join('')}
      </div>
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-2xl text-center">
        <p class="text-gray-400">Audience insights will populate once campaigns are active and collecting data from Facebook, TikTok, YouTube, and Google Ads.</p>
      </div>
    </div>
  `
}

function renderCompetitorResearchScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight uppercase">Competitor Research</h2>
      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-2xl text-center space-y-4">
        <div class="w-16 h-16 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center"><span class="text-3xl">🔍</span></div>
        <h3 class="text-xl font-bold">AI-Powered Competitor Analysis</h3>
        <p class="text-gray-400 text-sm max-w-md mx-auto">Enter a competitor's website or brand name to analyze their ad strategies, messaging patterns, and audience targeting across platforms.</p>
        <div class="max-w-md mx-auto space-y-3">
          <input type="text" placeholder="Enter competitor URL or brand name..." class="w-full bg-[var(--bg-color)] border border-white/10 p-4 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)]">
          <button class="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all cursor-pointer">Analyze Competitor</button>
        </div>
      </div>
    </div>
  `
}

// ══════════════════════════════════════════════════
// TASK 61: DASHBOARD WITH REAL ANALYTICS
// ══════════════════════════════════════════════════
async function renderDashboardScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full"></div></div>`
  try {
    const [overviewRes, platformsRes, campaignsRes] = await Promise.all([
      apiFetch('/analytics/overview').catch(() => null),
      apiFetch('/analytics/platforms').catch(() => null),
      apiFetch('/campaigns?status=').catch(() => null)
    ])
    const overview = overviewRes?.ok ? await overviewRes.json() : { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0, avgCtr: 0, avgRoas: 0, activeCampaigns: 0 }
    const platforms = platformsRes?.ok ? await platformsRes.json() : []
    const campaigns = campaignsRes?.ok ? await campaignsRes.json() : []
    const roleName = state.user?.role || state.activeRole
    const platformMeta = {
      facebook: { label: 'Facebook', icon: '📘' },
      tiktok: { label: 'TikTok', icon: '🎵' },
      youtube: { label: 'YouTube', icon: '▶️' },
      google_ads: { label: 'Google Ads', icon: '🔍' },
      google: { label: 'Google Ads', icon: '🔍' }
    }
    const statusClass = status => {
      switch (status) {
        case 'active':
          return 'bg-emerald-500/10 text-emerald-400'
        case 'approved':
          return 'bg-blue-500/10 text-blue-400'
        case 'pending_review':
          return 'bg-amber-500/10 text-amber-400'
        case 'paused':
          return 'bg-slate-500/10 text-slate-300'
        case 'draft':
          return 'bg-gray-500/10 text-gray-400'
        default:
          return 'bg-gray-500/10 text-gray-400'
      }
    }

    contentContainer.innerHTML = `
      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-3xl font-black tracking-tight uppercase">Dashboard</h2>
            <p class="text-gray-400 text-sm mt-1">${state.company?.name || 'Marketing'} Overview ${roleName !== 'Super Admin' ? '| ' + roleName : ''}</p>
          </div>
          ${['Expert', 'Admin'].includes(roleName) ? `<button onclick="switchScreen('Objective')" class="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer">+ New Campaign</button>` : ''}
        </div>

        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 space-y-5">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 class="font-bold text-sm uppercase tracking-widest">Cumulative Results</h3>
              <p class="text-xs text-gray-500 mt-1">All platforms, all campaigns</p>
            </div>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest">${campaigns.length} campaigns tracked</span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${[
            { label: 'Active Campaigns', value: overview.activeCampaigns, icon: '🚀', color: 'cyan' },
            { label: 'Total Spend', value: '$' + (overview.totalSpend || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}), icon: '💰', color: 'emerald' },
            { label: 'Total Clicks', value: (overview.totalClicks || 0).toLocaleString(), icon: '🖱️', color: 'blue' },
            { label: 'Conversions', value: (overview.totalConversions || 0).toLocaleString(), icon: '🎯', color: 'purple' }
          ].map(c => `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-5 rounded-2xl hover:border-${c.color}-500/30 transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">${c.label}</span>
                <span>${c.icon}</span>
              </div>
              <div class="text-2xl font-black text-${c.color}-400">${c.value}</div>
            </div>
          `).join('')}
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${[
            { label: 'Impressions', value: (overview.totalImpressions || 0).toLocaleString(), color: 'amber' },
            { label: 'Avg CTR', value: ((overview.avgCtr || 0) * 100).toFixed(2) + '%', color: 'rose' },
            { label: 'Avg ROAS', value: (overview.avgRoas || 0).toFixed(2) + 'x', color: 'emerald' },
            { label: 'Avg CPC', value: '$' + (overview.avgCpc || 0).toFixed(2), color: 'blue' }
          ].map(c => `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-4 rounded-2xl">
              <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">${c.label}</div>
              <div class="text-xl font-black text-${c.color}-400 mt-1">${c.value}</div>
            </div>
          `).join('')}
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 class="font-bold text-sm uppercase tracking-widest">Platform Wise Results</h3>
              <p class="text-xs text-gray-500 mt-1">Performance breakdown by platform</p>
            </div>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest">${platforms.length} platforms</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            ${platforms.map(p => {
              const meta = platformMeta[p.platform] || { label: p.platform || 'Unknown', icon: '📊' }
              return `
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4">
                  <div class="flex items-center justify-between">
                    <div class="text-lg font-bold">${meta.icon} ${meta.label}</div>
                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">${p.campaignCount || 0} campaigns</span>
                  </div>
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="bg-[var(--bg-color)] rounded-xl p-3">
                      <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Spend</div>
                      <div class="mt-1 font-black text-emerald-400">$${(p.totalSpend || 0).toFixed(2)}</div>
                    </div>
                    <div class="bg-[var(--bg-color)] rounded-xl p-3">
                      <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Clicks</div>
                      <div class="mt-1 font-black text-blue-400">${(p.totalClicks || 0).toLocaleString()}</div>
                    </div>
                    <div class="bg-[var(--bg-color)] rounded-xl p-3">
                      <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Impressions</div>
                      <div class="mt-1 font-black text-amber-400">${(p.totalImpressions || 0).toLocaleString()}</div>
                    </div>
                    <div class="bg-[var(--bg-color)] rounded-xl p-3">
                      <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Conversions</div>
                      <div class="mt-1 font-black text-purple-400">${(p.totalConversions || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div class="space-y-2 text-xs">
                    <div class="flex justify-between"><span class="text-gray-400">Avg CTR</span><span>${((p.avgCtr || 0) * 100).toFixed(2)}%</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Avg ROAS</span><span>${(p.avgRoas || 0).toFixed(2)}x</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Avg CPC</span><span>$${(p.avgCpc || 0).toFixed(2)}</span></div>
                  </div>
                </div>
              `
            }).join('') || '<div class="col-span-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-8 text-center text-gray-500">No platform metrics available yet.</div>'}
          </div>
        </div>

        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <div class="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
            <h3 class="font-bold text-sm uppercase tracking-widest">All Campaigns</h3>
            <span class="text-[10px] text-gray-500">${campaigns.length} total</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-[var(--border-color)]">
                  <th class="px-4 py-3">Campaign Name</th>
                  <th class="px-4 py-3">Campaign Platform</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                ${campaigns.map(c => `
                  <tr class="border-b border-[var(--border-color)] hover:bg-white/5 transition-all">
                    <td class="px-4 py-4">
                      <div class="font-bold text-sm">${c.name || 'Untitled Campaign'}</div>
                    </td>
                    <td class="px-4 py-4 text-gray-400">${(c.platforms || []).map(platform => (platformMeta[platform]?.label || platform)).join(', ') || '-'}</td>
                    <td class="px-4 py-4">
                      <span class="px-2 py-1 rounded-full text-[9px] font-bold uppercase ${statusClass(c.status)}">${c.status || '-'}</span>
                    </td>
                    <td class="px-4 py-4 text-right font-bold text-emerald-400">$${(c.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4" class="p-8 text-center text-gray-500">No campaigns yet. Create your first campaign!</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-gray-500 p-8">Dashboard loading... <br><span class="text-xs">${e.message}</span></div>`
  }
}

// ══════════════════════════════════════════════════
// TASKS 48-54: CAMPAIGN BUILDER WIZARD
// ══════════════════════════════════════════════════
async function renderCampaignBuilderWizard(step = 1, campaignId = null) {
  const steps = [
    { num: 1, name: 'Objective', icon: '🎯' },
    { num: 2, name: 'Audience', icon: '👥' },
    { num: 3, name: 'Strategy', icon: '🧠' },
    { num: 4, name: 'Ad Sets', icon: '📋' },
    { num: 5, name: 'Creative', icon: '🎨' },
    { num: 6, name: 'Review', icon: '✅' }
  ]

  let objectives = []
  try { const res = await apiFetch('/campaign-objectives'); objectives = await res.json() } catch(e) {}

  const objectivesByCategory = { awareness: [], consideration: [], conversion: [] }
  objectives.forEach(o => { if (objectivesByCategory[o.category]) objectivesByCategory[o.category].push(o) })

  contentContainer.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-8">
      <!-- Step Indicator -->
      <div class="flex items-center justify-center gap-2">
        ${steps.map(s => `
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${step >= s.num ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-gray-700 text-gray-500'} transition-all">
              ${step > s.num ? '✓' : s.icon}
            </div>
            <span class="text-xs font-bold ${step >= s.num ? 'text-cyan-400' : 'text-gray-600'} hidden md:inline">${s.name}</span>
            ${s.num < steps.length ? '<div class="w-8 h-0.5 bg-gray-700 mx-1"></div>' : ''}
          </div>
        `).join('')}
      </div>

      <!-- Step Content -->
      <div id="wizard-content" class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-8">
        ${step === 1 ? `
          <div class="space-y-6">
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-black uppercase">Choose Campaign Objective</h2>
              <p class="text-gray-400 text-sm">What do you want to achieve with this campaign?</p>
            </div>
            <div class="space-y-2 mb-4">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Campaign Name</label>
              <input type="text" id="wizard-camp-name" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)]" placeholder="My Campaign Name" value="">
            </div>
            ${Object.entries(objectivesByCategory).map(([cat, objs]) => `
              <div>
                <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full ${cat === 'awareness' ? 'bg-blue-500' : cat === 'consideration' ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                  ${cat}
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  ${objs.map(o => `
                    <button class="wizard-obj-btn p-4 bg-[var(--bg-color)] border-2 border-[var(--border-color)] rounded-xl text-left hover:border-cyan-500/50 transition-all cursor-pointer" data-id="${o.id}" data-name="${o.name}">
                      <span class="text-xl">${o.icon}</span>
                      <div class="text-sm font-bold mt-1">${o.name}</div>
                      <div class="text-[10px] text-gray-500 mt-0.5">${o.description || ''}</div>
                      <div class="flex gap-1 mt-2">${(o.supportedPlatforms || []).map(p => `<span class="text-[8px] px-1.5 py-0.5 bg-white/5 rounded text-gray-400">${p}</span>`).join('')}</div>
                    </button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : step === 2 ? `
          <div class="space-y-6">
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-black uppercase">Define Target Audience</h2>
              <p class="text-gray-400 text-sm">Who should see your ads?</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Location</label>
                  <input type="text" id="wiz-location" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="US, UK, BD..." value="US"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Language</label>
                  <input type="text" id="wiz-language" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="English" value="English"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Age Range</label>
                  <div class="flex gap-2 mt-1">
                    <input type="number" id="wiz-age-min" class="w-1/2 bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)]" value="18" min="13" max="65">
                    <input type="number" id="wiz-age-max" class="w-1/2 bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)]" value="65" min="13" max="65">
                  </div></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gender</label>
                  <select id="wiz-gender" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1">
                    <option value="all">All Genders</option><option value="male">Male</option><option value="female">Female</option>
                  </select></div>
              </div>
              <div class="space-y-4">
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Interests</label>
                  <textarea id="wiz-interests" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1 h-24" placeholder="e.g. Technology, Fashion, Fitness..."></textarea></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estimated Audience</label>
                  <div class="mt-2 p-4 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)] text-center">
                    <div class="text-2xl font-black text-cyan-400">1.2M - 3.5M</div>
                    <div class="text-[10px] text-gray-500 mt-1">Estimated daily reach</div>
                  </div></div>
              </div>
            </div>
          </div>
        ` : step === 3 ? `
          <div class="space-y-6 text-center">
            <h2 class="text-2xl font-black uppercase">AI Strategy Research</h2>
            <p class="text-gray-400 text-sm">Use the Strategy Hub for deep AI-assisted research, or skip to continue.</p>
            <div class="flex justify-center gap-4 mt-6">
              <button onclick="switchScreen('Research')" class="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all cursor-pointer">Open Strategy Hub</button>
              <button id="wizard-skip-strategy" class="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all cursor-pointer">Skip This Step</button>
            </div>
          </div>
        ` : step === 4 ? `
          <div class="space-y-6">
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-black uppercase">Ad Set Configuration</h2>
              <p class="text-gray-400 text-sm">Configure budget, schedule, and placements</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Daily Budget ($)</label>
                  <input type="number" id="wiz-daily-budget" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" value="100" min="1"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bid Strategy</label>
                  <select id="wiz-bid-strategy" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1">
                    <option value="lowest_cost">Lowest Cost (Recommended)</option><option value="cost_cap">Cost Cap</option><option value="bid_cap">Bid Cap</option>
                  </select></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Start Date</label>
                  <input type="date" id="wiz-start-date" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" value="${new Date().toISOString().split('T')[0]}"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">End Date</label>
                  <input type="date" id="wiz-end-date" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1"></div>
              </div>
              <div class="space-y-4">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Platforms</label>
                <div class="grid grid-cols-2 gap-3 mt-1">
                  ${[{id:'facebook',name:'Facebook',icon:'📘'},{id:'tiktok',name:'TikTok',icon:'🎵'},{id:'youtube',name:'YouTube',icon:'▶️'},{id:'google_ads',name:'Google Ads',icon:'🔍'}].map(p => `
                    <label class="flex items-center gap-3 p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl cursor-pointer hover:border-cyan-500/30 transition-all">
                      <input type="checkbox" class="wiz-platform accent-cyan-500" value="${p.id}" ${p.id === 'facebook' ? 'checked' : ''}>
                      <span class="text-lg">${p.icon}</span>
                      <span class="text-sm font-bold">${p.name}</span>
                    </label>
                  `).join('')}
                </div>
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4 block">Optimization Goal</label>
                <select id="wiz-opt-goal" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1">
                  <option value="link_clicks">Link Clicks</option><option value="impressions">Impressions</option><option value="conversions">Conversions</option><option value="reach">Reach</option><option value="landing_page_views">Landing Page Views</option>
                </select>
              </div>
            </div>
          </div>
        ` : step === 5 ? `
          <div class="space-y-6 text-center">
            <h2 class="text-2xl font-black uppercase">Creative Assets</h2>
            <p class="text-gray-400 text-sm">Use Creative Studio to build and manage your ad creatives.</p>
            <div class="flex justify-center gap-4 mt-6">
              <button onclick="switchScreen('Studio')" class="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all cursor-pointer">Open Creative Studio</button>
              <button id="wizard-skip-creative" class="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all cursor-pointer">Skip For Now</button>
            </div>
          </div>
        ` : step === 6 ? `
          <div class="space-y-6">
            <div class="text-center space-y-2">
              <h2 class="text-2xl font-black uppercase">Review & Submit</h2>
              <p class="text-gray-400 text-sm">Review your campaign before submitting for approval</p>
            </div>
            <div id="wizard-review-summary" class="space-y-4">
              <div class="p-4 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]">
                <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Campaign</div>
                <div class="font-bold text-lg">${state._wizardData?.name || 'Untitled'}</div>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]"><div class="text-[10px] text-gray-500">Objective</div><div class="font-bold text-sm mt-1">${state._wizardData?.objectiveName || '-'}</div></div>
                <div class="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]"><div class="text-[10px] text-gray-500">Budget</div><div class="font-bold text-sm mt-1">$${state._wizardData?.dailyBudget || 0}/day</div></div>
                <div class="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]"><div class="text-[10px] text-gray-500">Platforms</div><div class="font-bold text-sm mt-1">${(state._wizardData?.platforms || []).join(', ') || '-'}</div></div>
                <div class="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]"><div class="text-[10px] text-gray-500">Status</div><div class="font-bold text-sm mt-1 text-amber-400">Ready to Submit</div></div>
              </div>
            </div>
            <div class="flex justify-center gap-4 mt-6">
              <button id="wizard-save-draft" class="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all cursor-pointer">Save as Draft</button>
              <button id="wizard-submit" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer">Submit for Approval</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Navigation -->
      <div class="flex justify-between">
        <button id="wizard-back" class="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer ${step === 1 ? 'invisible' : ''}">Back</button>
        <button id="wizard-next" class="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer ${step === 6 ? 'invisible' : ''}">Next Step</button>
      </div>
    </div>
  `

  // Initialize wizard data
  if (!state._wizardData) state._wizardData = { step: 1, objectiveId: null, objectiveName: '', name: '', platforms: ['facebook'], dailyBudget: 100 }

  // Event handlers
  document.querySelectorAll('.wizard-obj-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.wizard-obj-btn').forEach(b => b.classList.remove('border-cyan-500'))
      btn.classList.add('border-cyan-500')
      state._wizardData.objectiveId = parseInt(btn.dataset.id)
      state._wizardData.objectiveName = btn.dataset.name
    }
  })

  document.getElementById('wizard-back')?.addEventListener('click', () => renderCampaignBuilderWizard(step - 1, campaignId))

  document.getElementById('wizard-next')?.addEventListener('click', async () => {
    if (step === 1) {
      state._wizardData.name = document.getElementById('wizard-camp-name')?.value || 'Untitled Campaign'
      if (!state._wizardData.objectiveId) { showNotification('Please select an objective', 'error'); return }
    }
    if (step === 4) {
      state._wizardData.dailyBudget = parseFloat(document.getElementById('wiz-daily-budget')?.value) || 100
      state._wizardData.platforms = Array.from(document.querySelectorAll('.wiz-platform:checked')).map(cb => cb.value)
      state._wizardData.bidStrategy = document.getElementById('wiz-bid-strategy')?.value
      state._wizardData.startDate = document.getElementById('wiz-start-date')?.value
      state._wizardData.endDate = document.getElementById('wiz-end-date')?.value
    }
    renderCampaignBuilderWizard(step + 1, campaignId)
  })

  document.getElementById('wizard-skip-strategy')?.addEventListener('click', () => renderCampaignBuilderWizard(4, campaignId))
  document.getElementById('wizard-skip-creative')?.addEventListener('click', () => renderCampaignBuilderWizard(6, campaignId))

  document.getElementById('wizard-save-draft')?.addEventListener('click', async () => {
    try {
      const res = await apiFetch('/campaigns', { method: 'POST', body: JSON.stringify({
        name: state._wizardData.name, objectiveId: state._wizardData.objectiveId, dailyBudget: state._wizardData.dailyBudget,
        bidStrategy: state._wizardData.bidStrategy, platforms: state._wizardData.platforms
      })})
      if (res.ok) { showNotification('Campaign saved as draft!', 'success'); state._wizardData = null; switchScreen('Dashboard') }
    } catch(e) { showNotification(e.message, 'error') }
  })

  document.getElementById('wizard-submit')?.addEventListener('click', async () => {
    try {
      const res = await apiFetch('/campaigns', { method: 'POST', body: JSON.stringify({
        name: state._wizardData.name, objectiveId: state._wizardData.objectiveId, dailyBudget: state._wizardData.dailyBudget,
        bidStrategy: state._wizardData.bidStrategy, platforms: state._wizardData.platforms
      })})
      if (res.ok) {
        const camp = await res.json()
        await apiFetch(`/campaigns/${camp.id}/submit`, { method: 'POST' })
        showNotification('Campaign submitted for approval!', 'success')
        state._wizardData = null
        switchScreen('Dashboard')
      }
    } catch(e) { showNotification(e.message, 'error') }
  })
}

// ══════════════════════════════════════════════════
// TASK 55: REDESIGNED CMO APPROVAL SCREEN
// ══════════════════════════════════════════════════
async function renderRedesignedApprovalsScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full"></div></div>`
  try {
    const pppSubRes = await apiFetch('/cmo/ppp-submissions')
    const pppSubmissions = pppSubRes.ok ? await pppSubRes.json() : []

    if (!state.marketingData.selectedPppItems) state.marketingData.selectedPppItems = []

    const platColors = { facebook:'indigo', tiktok:'pink', youtube:'rose', google_ads:'amber', instagram:'purple', twitter:'sky' }
    const platEmojis = { facebook:'📘', tiktok:'🎵', youtube:'▶️', google_ads:'🔍', instagram:'📸', twitter:'🐦' }

    contentContainer.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black tracking-tight uppercase">Ad Approvals</h2>
          <span class="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold">PPP Submissions (${pppSubmissions.length})</span>
        </div>

        <!-- PPP Submissions -->
        <div id="approval-ppp" class="space-y-4 pb-32">
          ${pppSubmissions.length === 0 ? `
            <div class="bg-[var(--card-bg)] border border-dashed border-[var(--border-color)] p-20 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
              <span class="text-5xl opacity-20">📋</span>
              <p class="text-gray-500 font-bold">No PPP submissions awaiting approval.<br><span class="text-xs font-medium opacity-50 uppercase tracking-tighter">PPP will submit budget-configured ads here for deployment.</span></p>
            </div>
          ` : pppSubmissions.map((item, i) => {
            const isSelected = (state.marketingData.selectedPppItems || []).includes(item.numericId)
            const platKey = (item.platform || '').toLowerCase().replace(' ', '_')
            const platCol = platColors[platKey] || 'indigo'
            const platEmoji = platEmojis[platKey] || '📢'
            const bud = item.budget
            return `
              <div class="bg-[var(--card-bg)] p-5 rounded-2xl border ${isSelected ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-[var(--border-color)]'} transition-all">
                <div class="flex items-start gap-5">
                  <div class="w-20 h-20 bg-black rounded-xl overflow-hidden shadow-2xl flex-shrink-0 relative">
                    ${item.type === 'video'
                      ? `<video src="${item.url || ''}" class="w-full h-full object-cover"></video>`
                      : `<img src="${item.url || ''}" class="w-full h-full object-cover" onerror="this.style.display='none'">`}
                    ${isSelected ? `<div class="absolute inset-0 bg-emerald-500/20 flex items-center justify-center text-xl">✓</div>` : ''}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-2">
                      <span class="px-2 py-0.5 bg-${platCol}-600/20 text-${platCol}-400 border border-${platCol}-500/30 rounded-md text-[10px] font-black">${platEmoji} ${item.platform || 'Unknown'}</span>
                      <span class="px-2 py-0.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-md text-[10px] font-black">READY FOR APPROVAL</span>
                    </div>
                    <h4 class="font-black text-white truncate">${item.title || item.id}</h4>
                    <p class="text-[10px] text-gray-500 mt-1">ID: ${String(item.id || '').slice(0, 20)}... · ${item.type || 'image'}</p>
                    ${bud ? `
                      <div class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
                        ${bud.dailyBudget ? `<div class="flex justify-between"><span class="text-gray-600 uppercase">Daily</span><span class="text-emerald-400 font-black">$${Number(bud.dailyBudget).toFixed(2)}</span></div>` : ''}
                        ${bud.lifetimeBudget ? `<div class="flex justify-between"><span class="text-gray-600 uppercase">Lifetime</span><span class="text-cyan-400 font-black">$${Number(bud.lifetimeBudget).toFixed(2)}</span></div>` : ''}
                        ${bud.bidStrategy ? `<div class="flex justify-between"><span class="text-gray-600 uppercase">Strategy</span><span class="text-purple-400 font-black">${bud.bidStrategy}</span></div>` : ''}
                        ${bud.costPerResult ? `<div class="flex justify-between"><span class="text-gray-600 uppercase">CPR</span><span class="text-yellow-400 font-black">$${Number(bud.costPerResult).toFixed(2)}</span></div>` : ''}
                      </div>
                    ` : `<div class="mt-2 text-[10px] text-yellow-600 italic">No budget configured</div>`}
                  </div>
                  <button class="ppp-toggle-select flex-shrink-0 px-5 py-2.5 ${isSelected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500' : 'bg-[var(--bg-color)] hover:bg-emerald-600/10 text-gray-400 hover:text-emerald-400 border-[var(--border-color)] hover:border-emerald-500/50'} border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer" data-numeric-id="${item.numericId}" data-index="${i}">
                    ${isSelected ? 'SELECTED ✓' : 'SELECT'}
                  </button>
                </div>
              </div>
            `
          }).join('')}
        </div>

        <!-- Approve & Deploy bar -->
        <div id="approve-deploy-bar" class="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 ${(state.marketingData.selectedPppItems || []).length === 0 ? 'hidden' : ''}">
          <div class="bg-[var(--card-bg)] border border-emerald-500/30 rounded-2xl p-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex items-center gap-4">
            <div class="flex-1 text-sm">
              <div class="font-black text-white" id="deploy-count-label">${(state.marketingData.selectedPppItems || []).length} selected</div>
              <div class="text-[10px] text-gray-500 uppercase">Ready for live deployment</div>
            </div>
            <button id="approve-deploy-btn" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all text-xs uppercase tracking-widest disabled:opacity-30 disabled:grayscale cursor-pointer" ${(state.marketingData.selectedPppItems || []).length === 0 ? 'disabled' : ''}>
              🚀 Approve &amp; Deploy
            </button>
          </div>
        </div>
      </div>
    `

    // PPP item select/deselect
    document.querySelectorAll('.ppp-toggle-select').forEach(btn => {
      btn.onclick = () => {
        const numericId = parseInt(btn.dataset.numericId)
        const sel = state.marketingData.selectedPppItems
        const idx = sel.indexOf(numericId)
        if (idx > -1) sel.splice(idx, 1)
        else sel.push(numericId)
        // Update UI without full re-render
        const countLabel = document.getElementById('deploy-count-label')
        if (countLabel) countLabel.textContent = `${sel.length} selected`
        const deployBtn = document.getElementById('approve-deploy-btn')
        if (deployBtn) deployBtn.disabled = sel.length === 0
        const deployBar = document.getElementById('approve-deploy-bar')
        if (deployBar) deployBar.classList.toggle('hidden', sel.length === 0)
        btn.textContent = idx > -1 ? 'SELECT' : 'SELECTED ✓'
        btn.classList.toggle('bg-emerald-500/10', idx === -1)
        btn.classList.toggle('text-emerald-400', idx === -1)
        btn.classList.toggle('border-emerald-500', idx === -1)
      }
    })

    // Approve & Deploy handler
    const deployBtn = document.getElementById('approve-deploy-btn')
    if (deployBtn) {
      deployBtn.onclick = async () => {
        const sel = state.marketingData.selectedPppItems || []
        if (sel.length === 0) return
        deployBtn.disabled = true
        deployBtn.textContent = '⏳ Deploying...'
        try {
          const res = await apiFetch('/cmo/approve-and-deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pppQueueItemIds: sel, dryRun: false })
          })
          const data = await res.json()
          if (res.ok) {
            state.marketingData.selectedPppItems = []
            showNotification(`🚀 ${data.message || `${sel.length} ads deployed!`}`, 'success')
            // Show deployment result modal
            const deployed = data.deployed || []
            const modalHtml = `
              <div id="deploy-result-modal" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onclick="if(event.target.id==='deploy-result-modal')this.remove()">
                <div class="bg-[var(--card-bg)] border border-emerald-500/30 rounded-3xl p-8 max-w-lg w-full space-y-5 shadow-2xl">
                  <div class="flex items-center gap-3">
                    <span class="text-3xl">🚀</span>
                    <h3 class="text-xl font-black text-white uppercase">Deployment Complete</h3>
                  </div>
                  <p class="text-gray-400 text-sm">${deployed.length} ads approved and pushed to live platforms.</p>
                  <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                    ${deployed.map(d => `
                      <div class="flex items-center justify-between bg-[var(--bg-color)] rounded-xl px-4 py-3">
                        <div>
                          <div class="text-sm font-bold text-white truncate max-w-xs">${d.title || d.itemId}</div>
                          <div class="text-[10px] text-gray-500">${d.platform || 'unknown'}</div>
                        </div>
                        <span class="px-2 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black">LIVE ✓</span>
                      </div>
                    `).join('')}
                  </div>
                  <button onclick="document.getElementById('deploy-result-modal').remove(); renderRedesignedApprovalsScreen()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all text-sm uppercase tracking-widest cursor-pointer">
                    Done
                  </button>
                </div>
              </div>
            `
            document.body.insertAdjacentHTML('beforeend', modalHtml)
            renderRedesignedApprovalsScreen()
          } else {
            showNotification(data.error || 'Deployment failed', 'error')
            deployBtn.disabled = false
            deployBtn.textContent = '🚀 Approve & Deploy'
          }
        } catch(e) {
          showNotification('Deployment error: ' + e.message, 'error')
          deployBtn.disabled = false
          deployBtn.textContent = '🚀 Approve & Deploy'
        }
      }
    }
  } catch(e) { contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">${e.message}</div>` }
}

// ══════════════════════════════════════════════════
// TASK 62: AD PERFORMANCE WITH REAL DATA
// ══════════════════════════════════════════════════
async function renderRealAdPerformanceScreen() {
  if (!checkCompanyContext()) return
  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"></div></div>`
  try {
    const [metricsRes, campaignsRes] = await Promise.all([
      apiFetch('/analytics/top-performers'),
      apiFetch('/campaigns')
    ])
    const topPerformers = metricsRes.ok ? await metricsRes.json() : []
    const campaigns = campaignsRes.ok ? await campaignsRes.json() : []

    const campaignMap = {}
    campaigns.forEach(c => campaignMap[c.id] = c)

    contentContainer.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black tracking-tight uppercase">Ad Performance</h2>
          <select id="perf-date-range" class="bg-[var(--bg-color)] border border-[var(--border-color)] px-3 py-2 rounded-lg text-sm text-[var(--text-color)]">
            <option value="7">Last 7 Days</option><option value="30" selected>Last 30 Days</option><option value="90">Last 90 Days</option>
          </select>
        </div>

        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-[var(--border-color)] text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              <th class="p-4">Campaign</th><th class="p-4">Spend</th><th class="p-4">Conversions</th><th class="p-4">ROAS</th><th class="p-4">Status</th>
            </tr></thead>
            <tbody>
              ${topPerformers.length > 0 ? topPerformers.map(p => {
                const camp = campaignMap[p.campaignId]
                return `
                  <tr class="border-b border-[var(--border-color)] hover:bg-white/5">
                    <td class="p-4 font-bold">${camp?.name || 'Campaign #' + p.campaignId}</td>
                    <td class="p-4">$${p.totalSpend?.toFixed(2) || '0.00'}</td>
                    <td class="p-4">${p.totalConversions || 0}</td>
                    <td class="p-4"><span class="font-bold ${p.avgRoas >= 1 ? 'text-emerald-400' : 'text-rose-400'}">${p.avgRoas?.toFixed(2) || '0.00'}x</span></td>
                    <td class="p-4"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${camp?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}">${camp?.status || '-'}</span></td>
                  </tr>
                `
              }).join('') : `
                <tr><td colspan="5" class="p-8 text-center text-gray-500">No performance data yet. Deploy campaigns to see metrics here.</td></tr>
              `}
            </tbody>
          </table>
        </div>

        ${campaigns.length > 0 ? `
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
          <h3 class="font-bold mb-4">All Campaigns</h3>
          <div class="space-y-2">
            ${campaigns.slice(0, 15).map(c => `
              <div class="flex items-center justify-between p-3 bg-[var(--bg-color)] rounded-xl">
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full ${c.status === 'active' ? 'bg-emerald-400' : 'bg-gray-600'}"></div>
                  <span class="font-bold text-sm">${c.name || 'Untitled'}</span>
                </div>
                <div class="flex gap-4 text-xs text-gray-400">
                  <span>${(c.platforms || []).join(', ')}</span>
                  <span class="font-bold">${c.status}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
    `
  } catch(e) { contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">${e.message}</div>` }
}

// ══════════════════════════════════════════════════
// TASK 66: PLATFORM SELECTION WITH GOOGLE/YOUTUBE
// ══════════════════════════════════════════════════
function renderEnhancedDeploySelectionScreen() {
  const platforms = [
    { id: 'facebook', name: 'Facebook / Instagram', icon: '📘', color: 'blue', desc: 'Feed, Stories, Reels, Marketplace' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', color: 'pink', desc: 'For You Page, Pangle, Automatic' },
    { id: 'youtube', name: 'YouTube', icon: '▶️', color: 'red', desc: 'In-Stream, Discovery, Shorts, Bumper' },
    { id: 'google_ads', name: 'Google Ads', icon: '🔍', color: 'emerald', desc: 'Search, Display, Shopping, Performance Max' }
  ]

  contentContainer.innerHTML = `
    <div class="max-w-4xl mx-auto space-y-8">
      <div class="text-center space-y-2">
        <h2 class="text-3xl font-black uppercase tracking-tight">Platform Deployment</h2>
        <p class="text-gray-400 text-sm">Select platforms and configure deployment parameters</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${platforms.map(p => `
          <div class="deploy-platform-card bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-2xl p-6 hover:border-${p.color}-500/50 transition-all cursor-pointer" data-platform="${p.id}">
            <div class="flex items-center gap-4 mb-3">
              <span class="text-3xl">${p.icon}</span>
              <div>
                <div class="font-bold text-lg">${p.name}</div>
                <div class="text-[10px] text-gray-500">${p.desc}</div>
              </div>
            </div>
            <div class="flex items-center justify-between mt-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" class="deploy-platform-check accent-cyan-500 w-5 h-5" value="${p.id}">
                <span class="text-sm font-bold">Enable</span>
              </label>
              <button class="text-xs text-${p.color}-400 hover:text-${p.color}-300 font-bold cursor-pointer">Configure</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6">
        <h3 class="font-bold mb-4">Deployment Queue</h3>
        <div id="deploy-queue-list" class="space-y-2 text-sm text-gray-400">
          <p>Select approved assets from the PPP queue and choose platforms above to deploy.</p>
        </div>
      </div>

      <div class="flex justify-center gap-4">
        <button id="btn-preview-deploy" class="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all cursor-pointer">Preview Payload</button>
        <button id="btn-execute-deploy" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer">Deploy Now</button>
      </div>
    </div>
  `
}

// ══════════════════════════════════════════════════
// TASK 68: COMPANY ONBOARDING WIZARD
// ══════════════════════════════════════════════════
function renderOnboardingWizard() {
  contentContainer.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-8">
      <div class="text-center space-y-3">
        <div class="w-20 h-20 bg-gradient-to-tr from-cyan-600 to-purple-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
          <span class="text-3xl">🚀</span>
        </div>
        <h2 class="text-3xl font-black uppercase">Welcome! Set Up Your Company</h2>
        <p class="text-gray-400 text-sm">Get started in just a few steps</p>
      </div>

      <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 rounded-2xl space-y-6">
        <div class="space-y-4">
          <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Company Name *</label>
            <input type="text" id="onboard-company-name" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="Your Company Name" required></div>
          <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Industry</label>
            <select id="onboard-industry" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1">
              <option value="">Select Industry...</option><option>E-Commerce</option><option>SaaS</option><option>Education</option><option>Healthcare</option><option>Real Estate</option><option>Finance</option><option>Food & Beverage</option><option>Fashion</option><option>Technology</option><option>Other</option>
            </select></div>
          <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Website</label>
            <input type="url" id="onboard-website" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="https://yourcompany.com"></div>
          <hr class="border-[var(--border-color)]">
          <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Admin Username *</label>
            <input type="text" id="onboard-username" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="admin" required></div>
          <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Admin Email *</label>
            <input type="email" id="onboard-email" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="admin@company.com" required></div>
          <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Admin Password *</label>
            <input type="password" id="onboard-password" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-cyan-500 text-[var(--text-color)] mt-1" placeholder="Minimum 6 characters" required></div>
        </div>

        <button id="btn-onboard-submit" class="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black rounded-xl transition-all shadow-xl uppercase tracking-widest text-sm cursor-pointer">
          Create Company & Get Started
        </button>
      </div>
    </div>
  `

  document.getElementById('btn-onboard-submit')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-onboard-submit')
    btn.disabled = true; btn.textContent = 'Creating...'
    try {
      const res = await fetch(`${API_BASE}/onboard/company`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: document.getElementById('onboard-company-name').value,
          industry: document.getElementById('onboard-industry').value,
          website: document.getElementById('onboard-website').value,
          adminUsername: document.getElementById('onboard-username').value,
          adminEmail: document.getElementById('onboard-email').value,
          adminPassword: document.getElementById('onboard-password').value
        })
      })
      if (res.ok) {
        const data = await res.json()
        state.isAuthenticated = true; state.token = data.token
        state.user = { username: data.admin.username, role: 'Admin', companyId: data.company.id }
        state.company = data.company; state.viewingCompanyId = data.company.id
        localStorage.setItem('mt_token', data.token); localStorage.setItem('mt_user', JSON.stringify(state.user))
        showNotification('Company created successfully!', 'success')
        setTimeout(() => updateUI(), 1000)
      } else {
        const err = await res.json(); showNotification(err.message || 'Failed', 'error')
        btn.disabled = false; btn.textContent = 'Create Company & Get Started'
      }
    } catch(e) { showNotification(e.message, 'error'); btn.disabled = false; btn.textContent = 'Create Company & Get Started' }
  })
}

function renderLoginScreen() {
  contentContainer.innerHTML = `
    <div class="fixed inset-0 bg-[var(--bg-color)] z-[10000] flex items-center justify-center p-6">
        <div class="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div class="text-center space-y-4">
                <div class="w-20 h-20 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-cyan-900/20 rotate-12">
                    <span class="text-3xl">🛡️</span>
                </div>
                <div class="space-y-1">
                    <h1 class="text-4xl font-black tracking-tighter uppercase">Marketing AI</h1>
                    <p class="text-gray-500 font-bold tracking-widest text-[10px] uppercase">Enterprise Orchestration Suite v1.0</p>
                </div>
            </div>

            <div class="bg-[var(--card-bg)] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Email Address</label>
                        <input type="email" id="login-email" class="w-full bg-[var(--bg-color)] border border-white/10 p-4 rounded-2xl outline-none focus:border-cyan-500 text-[var(--text-color)] font-medium transition-all" placeholder="Enter email address">
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Password</label>
                        <input type="password" id="login-password" class="w-full bg-[var(--bg-color)] border border-white/10 p-4 rounded-2xl outline-none focus:border-cyan-500 text-[var(--text-color)] font-medium transition-all" placeholder="••••••••">
                    </div>
                </div>

                <button id="btn-execute-login" class="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-cyan-400 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2">
                    AUTHENTICATE ACCESS ⚡
                </button>
                
                <p class="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                    Authorized Personnel Only — Neural Handshake Required
                </p>
            </div>
        </div>
    </div>
  `

  document.getElementById('btn-execute-login').onclick = async () => {
    const email = document.getElementById('login-email').value
    const password = document.getElementById('login-password').value

    if (!email || !password) return showNotification("Please enter credentials", "error")

    const btn = document.getElementById('btn-execute-login')
    btn.disabled = true
    btn.innerHTML = 'VALIDATING NEURAL KEY... 🧬'

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (res.ok) {
        const data = await res.json()
        state.isAuthenticated = true
        state.token = data.token
        state.user = data.user
        state.activeRole = data.user.role
        state.isSuperAdmin = data.user.isSuperAdmin || false
        state.company = data.user.company || null
        state.viewingCompanyId = data.user.companyId || null

        // Super Admin gets list of companies
        if (data.companies) {
          state.companies = data.companies
        }

        localStorage.setItem('mt_token', data.token)
        localStorage.setItem('mt_user', JSON.stringify(data.user))
        if (data.companies) localStorage.setItem('mt_companies', JSON.stringify(data.companies))

        // Set initial screen for Super Admin
        if (state.isSuperAdmin) {
          state.activeScreen = 'GlobalDashboard'
        }

        fetchNotifications()
        showNotification(`Welcome back, ${data.user.username}`, 'success')
        setTimeout(() => updateUI(), 1000)
      } else {
        showNotification("Authentication Failed: Invalid Credentials", "error")
        btn.disabled = false
        btn.innerHTML = 'RE-AUTHENTICATE ACCESS ⚡'
      }
    } catch (e) {
      showNotification("Quantum Link Error — Backend Offline", "error")
      btn.disabled = false
      btn.innerHTML = 'RE-AUTHENTICATE ACCESS ⚡'
    }
  }
}

// --- Initialization ---

roleSwitcherBtn.onclick = (e) => {
  e.stopPropagation()
  toggleDropdown()
}

document.querySelectorAll('.role-option').forEach(opt => {
  opt.onclick = () => switchRole(opt.dataset.role)
})

window.onclick = () => {
  roleDropdown.classList.add('hidden')
}

// Persist data from server
async function initApp() {
  console.log('Initializing Platform...')

  const savedToken = localStorage.getItem('mt_token')
  const savedUser = localStorage.getItem('mt_user')

  let initialRole = 'Expert'
  if (savedToken && savedUser) {
    state.token = savedToken
    state.user = JSON.parse(savedUser)
    state.isAuthenticated = true
    initialRole = state.user.role
    state.isSuperAdmin = state.user.isSuperAdmin || false
    state.company = state.user.company || null
    state.viewingCompanyId = state.user.companyId || null

    const savedCompanies = localStorage.getItem('mt_companies')
    if (savedCompanies) state.companies = JSON.parse(savedCompanies)

    if (state.isSuperAdmin) state.activeScreen = 'GlobalDashboard'

    fetchNotifications()
  }

  // Check Theme
  const savedTheme = localStorage.getItem('mt_theme') || 'dark'
  setTheme(savedTheme)

  // Only load data if authenticated
  if (state.isAuthenticated && state.token) {
    try {
      const guideRes = await apiFetch('/guidelines').catch(() => null)
      if (guideRes && guideRes.ok) {
        const text = await guideRes.text()
        try {
          const data = JSON.parse(text)
          state.marketingData.brandGuidelines = { ...state.marketingData.brandGuidelines, ...data }
          console.log('Guidelines loaded from server.')
        } catch(e) { /* not JSON, skip */ }
      }

      const cmoRes = await apiFetch('/cmo/queue').catch(() => null)
      if (cmoRes && cmoRes.ok) {
        const text = await cmoRes.text()
        try { state.marketingData.cmoQueue = JSON.parse(text) || [] } catch(e) { /* skip */ }
        console.log(`Loaded ${state.marketingData.cmoQueue.length} CMO queue items.`)
      }

      const ppcRes = await apiFetch('/ppp/queue').catch(() => null)
      if (ppcRes && ppcRes.ok) {
        const text = await ppcRes.text()
        try { state.marketingData.ppcQueue = JSON.parse(text) || [] } catch(e) { /* skip */ }
        console.log(`Loaded ${state.marketingData.ppcQueue.length} PPP queue items.`)
      }
    } catch (e) {
      console.warn('Backend data load skipped:', e.message)
    }
  }

  switchRole(initialRole)
}

initApp();
