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
        page_id: '792318557298112'
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

const SUPER_ADMIN_ONLY_SCREENS = ['GlobalDashboard', 'CompanyManagement', 'SystemConfig', 'AuditLog']

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
  try {
    await apiFetch('/ppp/queue', {
      method: 'POST',
      body: JSON.stringify(state.marketingData.pppQueue || state.marketingData.ppcQueue)
    })
    console.log('PPP Queue synced to server.')
  } catch (e) {
    console.warn('Could not sync PPP Queue:', e.message)
  }
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

                <!-- Aspect Ratio -->
                <div class="space-y-3">
                    <h3 class="text-base font-black text-[var(--text-color)] uppercase tracking-tight">Aspect Ratio</h3>
                    <div class="flex gap-2">
                        ${['1:1', '16:9', '9:16'].map(ratio => `
                            <button class="aspect-ratio-btn flex-1 py-3 rounded-lg font-black text-xs transition-all ${state.marketingData.aspectRatio === ratio ? 'bg-[var(--accent-color)] text-[var(--text-inverse)] ring-2 ring-[var(--accent-color)]' : 'bg-[var(--bg-color)] text-[var(--text-color)] border border-[var(--border-color)] shadow-lg hover:bg-[var(--bg-secondary)]'}" data-ratio="${ratio}">
                                ${ratio}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-gray-800/50">
                <!-- Assets Section -->
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <h3 class="text-base font-black text-[var(--text-color)] uppercase tracking-tight">Assets</h3>
                        <span class="text-[8px] font-bold text-[var(--text-dim)] uppercase tracking-widest">Photos, videos</span>
                    </div>
                    
                    <div class="space-y-2">
                        <p class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Upload</p>
                        <div class="bg-[var(--bg-color)] border border-[var(--border-color)] p-2.5 rounded-lg flex items-center gap-2">
                            <input type="file" id="asset-upload" class="hidden">
                            <button onclick="document.getElementById('asset-upload').click()" class="bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--border-color)] text-[var(--text-color)] px-2 py-1 rounded-md text-[9px] font-bold transition-all">Choose</button>
                            <span class="text-[9px] text-[var(--text-dim)]">No file</span>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <p class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">URL</p>
                        <div class="flex gap-2">
                            <input type="text" class="flex-1 bg-[var(--bg-color)] border border-[var(--border-color)] p-2.5 rounded-lg outline-none focus:border-rose-500 text-[var(--text-color)] text-[10px]" placeholder="https://...">
                            <button class="bg-[var(--text-color)] text-[var(--text-inverse)] px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">ADD</button>
                        </div>
                    </div>
                </div>

                <!-- Generation Targets Section -->
                <div class="space-y-3">
                     <div class="flex justify-between items-center">
                        <h3 class="text-base font-black text-[var(--text-color)] uppercase tracking-tight">Targets</h3>
                        <span class="text-[8px] font-bold text-[var(--text-dim)] uppercase tracking-widest">Volume</span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Photos</label>
                            <input type="number" value="${state.marketingData.generationPhotos}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-[var(--text-color)]" onchange="state.marketingData.generationPhotos = this.value">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Videos</label>
                            <input type="number" value="${state.marketingData.generationVideos}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-[var(--text-color)]" onchange="state.marketingData.generationVideos = this.value">
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Posts</label>
                        <input type="number" value="${state.marketingData.generationPosts}" class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-[var(--text-color)]" onchange="state.marketingData.generationPosts = this.value">
                    </div>
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

  // Aspect Ratio selection
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

  document.getElementById('proceed-to-studio').onclick = async () => {
    const brief = document.getElementById('config-goal').value
    state.marketingData.goal = brief

    const btn = document.getElementById('proceed-to-studio')
    const originalText = btn.innerText
    btn.innerText = 'SAVING & GENERATING... ⏳'
    btn.disabled = true

    // The set of variations to be "generated"
    const variations = [
      { id: 1, img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400', title: 'Minimal Elegance' },
      { id: 2, img: 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?auto=format&fit=crop&q=80&w=400', title: 'Neon Kinetic' },
      { id: 3, img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400', title: 'Future Bold' },
      { id: 4, img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=400', title: 'Abstract Flow' },
      { id: 5, img: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&q=80&w=400', title: 'Dark Premium' }
    ]

    try {
      // 1. Save Campaign Data
      await apiFetch('/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief,
          preset: state.marketingData.stylePreset,
          ratio: state.marketingData.aspectRatio,
          timestamp: new Date().toISOString()
        })
      })

      // 2. Save Images to Backend Assets folder
      for (const v of variations) {
        await apiFetch('/assets/save-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: v.img,
            filename: `variation_${v.id}_${Date.now()}`
          })
        })
      }

      console.log('Campaign and assets saved successfully.')
      switchScreen('Studio')
    } catch (error) {
      console.error('Error saving campaign or assets:', error)
      showNotification('Failed to save data. Proceeding to Studio anyway.', 'error')
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

    // Sort assets to show latest first if possible, or just use as is
    const variations = assets.map(a => ({
      id: a.name,
      url: `http://localhost:5243${a.url}`, // Ensure absolute URL
      title: a.name,
      type: a.type
    }))

    contentContainer.innerHTML = `
      <div class="space-y-6">
          <div class="flex justify-between items-end">
              <div>
                  <h2 class="text-3xl font-black uppercase tracking-tighter">Creative AI Studio</h2>
                  <p class="text-gray-500 text-sm">AI-generated variations and local assets</p>
              </div>
              <button id="approval-btn" class="px-6 py-2.5 bg-cyan-600 text-white font-bold rounded-lg animate-pulse hover:animate-none hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all uppercase tracking-widest text-xs">
                  Approval
              </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${variations.map(v => `
                  <div class="group bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all flex flex-col">
                      <div class="aspect-video relative overflow-hidden bg-black flex items-center justify-center">
                          ${v.type === 'video' ? `
                              <video src="${v.url}" class="w-full h-full object-contain" controls></video>
                          ` : `
                              <img src="${v.url}" alt="${v.title}" class="w-full h-full object-cover group-hover:scale-105 transition-all duration-700">
                          `}
                          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 pointer-events-none">
                              <span class="text-[10px] font-bold text-cyan-400 uppercase truncate">${v.title}</span>
                          </div>
                      </div>
                      <div class="p-3 space-y-2 mt-auto">
                          <button class="studio-delete-btn w-full py-1.5 bg-rose-900/50 hover:bg-rose-800 text-rose-400 border border-rose-500/30 text-[10px] font-bold rounded-md transition-all">DELETE</button>
                          <button class="studio-approve-btn w-full py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-[10px] font-bold rounded-md transition-all">APPROVE</button>
                      </div>
                  </div>
              `).join('')}
              ${variations.length === 0 ? '<p class="col-span-full text-center text-gray-500 py-12">No assets found in backend/Assets folder.</p>' : ''}
          </div>
      </div>
    `

    // List to track which assets were approved in the current session
    let locallyApproved = []

    // Add click handlers for delete buttons
    document.querySelectorAll('.studio-delete-btn').forEach((btn, index) => {
      btn.onclick = async () => {
        const asset = variations[index];
        const card = btn.closest('.group');

        try {
          await apiFetch(`/assets/${asset.id}`, {
            method: 'DELETE'
          });
          card.classList.add('scale-95', 'opacity-0');
          setTimeout(() => {
            card.remove();
          }, 300);
        } catch (error) {
          console.error("Error deleting asset:", error);
          showNotification("Failed to delete asset.", "error");
        }
      }
    });

    // Add click handlers for the approval logic within each card
    document.querySelectorAll('.studio-approve-btn').forEach((btn, index) => {
      btn.onclick = () => {
        const asset = variations[index]
        const card = btn.closest('.group')
        const deleteBtn = card.querySelector('.studio-delete-btn')

        // Track the choice
        locallyApproved.push(asset)

        // Disable both buttons
        btn.disabled = true
        deleteBtn.disabled = true

        // Visual feedback for "Approved" state
        btn.innerText = 'APPROVED ✓'
        btn.classList.replace('text-cyan-400', 'text-gray-500')
        btn.classList.replace('border-cyan-500/30', 'border-gray-700')
        btn.classList.add('opacity-50', 'cursor-not-allowed')
        btn.classList.remove('hover:bg-cyan-500/10')

        deleteBtn.classList.add('opacity-30', 'cursor-not-allowed')
        deleteBtn.classList.remove('hover:bg-rose-800')
      }
    })

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

function renderMonitoringScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${[
      { label: 'Active Ads', val: '42', icon: '🟢', trend: '+12%' },
      { label: 'AI Killed', val: '184', icon: '🔴', trend: '-5%' },
      { label: 'Total Spend', val: '$12,482', icon: '💰', trend: '+8%' },
      { label: 'Efficiency %', val: '94.2%', icon: '⚡', trend: '+2%' }
    ].map(s => `
                <div class="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--border-color)] relative overflow-hidden group">
                    <div class="absolute -right-2 -top-2 text-4xl opacity-5 group-hover:opacity-10 transition-opacity">${s.icon === '💰' ? '💵' : '📈'}</div>
                    <p class="text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest mb-1">${s.label}</p>
                    <h3 class="text-2xl font-black text-[var(--text-color)]">${s.val}</h3>
                    <p class="text-[10px] font-bold ${s.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'} mt-1">${s.trend} ↑</p>
                </div>
            `).join('')}
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
                    <tbody class="divide-y divide-[var(--border-color)]">
                        ${[
      { name: 'S-Tier Lifestyle v2', roi: 92, spend: '$2,400', action: 'Scaling Up', status: 'Optimal' },
      { name: 'Product Reveal Alpha', roi: 84, spend: '$1,850', action: 'Monitoring', status: 'Stable' },
      { name: 'Growth Hack Beta', roi: 45, spend: '$940', action: 'Shutting Down', status: 'Critical' },
      { name: 'Retention Main 2024', roi: 78, spend: '$3,100', action: 'Budget Realloc', status: 'Normal' }
    ].map(r => `
                            <tr class="hover:bg-gray-800/30 transition-colors">
                                <td class="px-6 py-4 font-bold text-sm text-[var(--text-color)]">${r.name}</td>
                                <td class="px-6 py-4">
                                    <div class="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <div class="h-full ${r.roi > 80 ? 'bg-cyan-500' : r.roi > 60 ? 'bg-amber-500' : 'bg-rose-500'}" style="width: ${r.roi}%"></div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-sm font-mono text-gray-400">${r.spend}</td>
                                <td class="px-6 py-4">
                                    <span class="text-[10px] font-black px-2 py-1 rounded bg-gray-800/50 ${r.action === 'Scaling Up' ? 'text-cyan-400' : r.status === 'Critical' ? 'text-rose-500' : 'text-gray-500'} uppercase">${r.action}</span>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="w-2 h-2 inline-block rounded-full ${r.status === 'Optimal' ? 'bg-cyan-500' : r.status === 'Critical' ? 'bg-rose-500' : 'bg-gray-500'} mr-2"></span>
                                    <span class="text-xs font-bold text-[var(--text-dim)]">${r.status}</span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  `
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

    // Filter out super admin accounts from the selector
    const selectableUsers = users.filter(u => !u.isSuperAdmin)

    selector.innerHTML = '<option value="">— Select a user to manage permissions —</option>'
    selectableUsers.forEach(u => {
      const displayName = u.firstName || u.lastName
        ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
        : u.username
      const roleName = u.role?.name || 'No Role'
      // Super admin sees company name alongside user
      const companyTag = state.isSuperAdmin && u.company ? ` (${u.company.name})` : ''
      const option = document.createElement('option')
      option.value = u.id
      option.dataset.roleId = u.role?.id || ''
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

function renderBudgetMatrixScreen() {
  if (!checkCompanyContext()) return
  const bm = state.marketingData.budgetMatrix

  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        <!-- Budget Configuration Card -->
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 shadow-2xl space-y-6">
            <h2 class="text-xl font-black uppercase tracking-tight text-white mb-6">Budget Configuration</h2>
            
            <div class="grid grid-cols-2 gap-8">
                <div class="space-y-4">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                        <span class="text-indigo-500">†</span> Total Spend Target ($)
                    </label>
                    <div class="bg-[var(--bg-color)] p-6 rounded-2xl border border-[var(--border-color)] shadow-inner">
                        <input type="text" value="1000" class="bg-transparent w-full text-2xl font-black outline-none text-white">
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

            <button class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest">
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
                <!-- Reach Item -->
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

                <!-- Click Item -->
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

                <!-- Sales Item -->
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

            <button class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg transition-all text-xs uppercase tracking-widest">
                Apply Matrix
            </button>
        </div>
    </div>
  `

  // Slider Logic
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

  // Load fresh from server so data is always up-to-date across users
  try {
    const res = await apiFetch('/ppp/queue')
    const serverQueue = await res.json()
    if (Array.isArray(serverQueue) && serverQueue.length > 0) {
      state.marketingData.ppcQueue = serverQueue
    }
  } catch (e) {
    console.warn('Could not load ppc queue from server:', e.message)
  }

  const queue = state.marketingData.ppcQueue
  const selectedIds = state.marketingData.selectedAssets.map(a => a.id)

  contentContainer.innerHTML = `
    <div class="space-y-6 pb-24">
        <div class="flex justify-between items-center">
            <h2 class="text-3xl font-black uppercase italic tracking-tighter text-emerald-400">Approved <span class="text-white">Assets</span></h2>
            <div class="flex items-center gap-4">
                <span id="selected-count" class="text-indigo-400 font-bold text-[10px] uppercase tracking-widest">${state.marketingData.selectedAssets.length} Selected</span>
                <span class="bg-emerald-600/20 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-500/30 uppercase tracking-widest">${queue.length} Ready</span>
            </div>
        </div>
        
        <div id="approvals-list" class="space-y-4">
            ${queue.length === 0 ? `
              <div class="bg-[var(--card-bg)] border border-dashed border-[var(--border-color)] p-20 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                  <span class="text-5xl opacity-20">✅</span>
                  <p class="text-gray-500 font-bold">No approved assets available.<br><span class="text-xs font-medium opacity-50 uppercase tracking-tighter">Variations will appear here once authorized by the Business Admin.</span></p>
              </div>
            ` : queue.map((asset, i) => {
    const isSelected = selectedIds.includes(asset.id)
    return `
                    <div class="bg-[var(--card-bg)] p-5 rounded-2xl border ${isSelected ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-[var(--border-color)]'} flex items-center gap-6 group hover:border-emerald-500/30 transition-all">
                        <div class="w-24 h-24 bg-black rounded-xl overflow-hidden shadow-2xl flex-shrink-0 relative">
                            ${asset.type === 'video' ? `
                              <video src="${asset.url}" class="w-full h-full object-cover"></video>
                            ` : `
                              <img src="${asset.url}" class="w-full h-full object-cover">
                            `}
                            ${isSelected ? `<div class="absolute inset-0 bg-emerald-500/20 flex items-center justify-center text-2xl text-white">✓</div>` : ''}
                        </div>
                        <div class="flex-1">
                            <h4 class="text-lg font-black uppercase tracking-tight">${asset.title}</h4>
                            <p class="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Type: ${asset.type} • ID: ${String(asset.id).slice(0, 8)}...</p>
                            <p class="text-[10px] ${isSelected ? 'text-emerald-500 font-black' : 'text-emerald-500/70'} mt-1 uppercase font-bold italic">
                                ${isSelected ? 'QUEUED FOR DEPLOYMENT' : 'Authorized for final network dispatch.'}
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <button class="px-6 py-2.5 ${isSelected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} border rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all ppc-toggle-select" data-index="${i}">
                                ${isSelected ? 'DESELECT' : 'SELECT FOR POST'}
                            </button>
                        </div>
                    </div>
                `
  }).join('')}
        </div>

        <!-- Sticky Global POST Button -->
        <div class="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm px-6">
            <button id="ppc-post-btn" class="w-full py-5 bg-white text-black font-black rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:bg-emerald-500 hover:text-white transition-all scale-100 hover:scale-102 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-100 uppercase tracking-widest text-sm flex items-center justify-center gap-3" ${state.marketingData.selectedAssets.length === 0 ? 'disabled' : ''}>
                <span>GO TO DISPATCH HUB</span>
                <span class="text-lg">⚡</span>
            </button>
        </div>
    </div>
  `

  document.querySelectorAll('.ppc-toggle-select').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.index
      const asset = queue[idx]
      const existingIdx = state.marketingData.selectedAssets.findIndex(a => a.id === asset.id)

      if (existingIdx > -1) {
        state.marketingData.selectedAssets.splice(existingIdx, 1)
      } else {
        state.marketingData.selectedAssets.push({ ...asset })
      }

      renderApprovedAssetsScreen()
    }
  })

  document.getElementById('ppc-post-btn').onclick = () => {
    if (state.marketingData.selectedAssets.length > 0) {
      switchScreen('DeploySelection')
    }
  }
}

function renderDeploySelectionScreen() {
  const assets = state.marketingData.selectedAssets

  if (assets.length === 0) {
    contentContainer.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
          <div class="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/30">
              <span class="text-4xl">🎯</span>
          </div>
          <div class="text-center space-y-2">
              <h2 class="text-2xl font-black uppercase italic tracking-tighter">No Assets Selected</h2>
              <p class="text-gray-500 text-sm max-w-xs mx-auto">Please go to <span class="text-amber-500 font-bold">Ad Approvals</span> and select variations to configure their deployment platforms.</p>
          </div>
          <button id="go-to-approvals" class="px-8 py-3 bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-amber-500/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              Go to Ad Approvals
          </button>
      </div>
    `
    document.getElementById('go-to-approvals').onclick = () => switchScreen('Approvals')
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
        const config = state.marketingData.platformConfig.facebook
        modalContent.innerHTML = `
            <div class="flex flex-col space-y-1 mb-2">
                <h3 class="text-2xl font-black uppercase italic tracking-tighter text-white">Facebook Dispatch Config</h3>
                <p class="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Setup parameters for this specific deployment batch.</p>
            </div>
            
            <div class="max-h-[60vh] overflow-y-auto pr-2 space-y-6 custom-scrollbar pb-4">
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
            </div>

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
                <button id="fb-deploy-cancel" class="py-4 bg-[#1A1F29] hover:bg-[#2A2F3A] text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all">Cancel</button>
                <button id="fb-deploy-save" class="py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-950/20">Commit & Attach 💾</button>
            </div>
        `
        modal.classList.remove('hidden')

        document.getElementById('fb-deploy-cancel').onclick = () => {
          modal.classList.add('hidden')
        }

        document.getElementById('fb-deploy-save').onclick = () => {
          const getValue = (id) => document.getElementById(id)?.value || ''

          config.campaign_name = getValue('fb-deploy-camp-name')
          config.objective = getValue('fb-deploy-objective')
          config.daily_budget = getValue('fb-deploy-budget')
          config.schedule_start = getValue('fb-deploy-start')
          config.schedule_end = getValue('fb-deploy-end')
          config.page_id = getValue('fb-deploy-page-id').trim()

          selectedPlatforms.add('Facebook')
          btn.classList.add('border-[#1877F2]', 'bg-[#1877F2]/5')
          indicator.classList.add('bg-[#1877F2]', 'border-[#1877F2]')

          modal.classList.add('hidden')
          showNotification('Advanced Facebook parameters attached to batch.', 'success')
        }
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

async function renderCrossPlatformAnalyticsScreen() {
  if (!checkCompanyContext()) return

  contentContainer.innerHTML = `<div class="flex items-center justify-center h-64"><div class="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full"></div></div>`
  try {
    const res = await apiFetch('/analytics/platforms')
    const text = await res.text()
    let data = []
    try { data = JSON.parse(text) } catch(e) { console.error('Parse error:', text.substring(0, 200)); data = [] }
    contentContainer.innerHTML = `
      <div class="space-y-6">
        <h2 class="text-2xl font-black tracking-tight uppercase">Cross-Platform Analytics</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          ${data.map(p => `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl">
              <div class="text-lg font-bold mb-3">${{ facebook: '📘 Facebook', tiktok: '🎵 TikTok', youtube: '▶️ YouTube', google_ads: '🔍 Google' }[p.platform] || p.platform}</div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-400">Spend</span><span class="font-bold">$${p.totalSpend?.toFixed(2) || '0'}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Clicks</span><span>${p.totalClicks?.toLocaleString() || 0}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Impressions</span><span>${p.totalImpressions?.toLocaleString() || 0}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Avg CTR</span><span>${(p.avgCtr * 100)?.toFixed(2) || 0}%</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Avg ROAS</span><span>${p.avgRoas?.toFixed(2) || 0}x</span></div>
              </div>
            </div>
          `).join('') || '<div class="col-span-4 text-center text-gray-500 p-8">No analytics data yet. Deploy campaigns to see metrics.</div>'}
        </div>
      </div>
    `
  } catch (e) {
    contentContainer.innerHTML = `<div class="text-center text-red-400 p-8">Failed to load analytics: ${e.message}</div>`
  }
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
    const [overviewRes, campaignsRes] = await Promise.all([
      apiFetch('/analytics/overview').catch(() => null),
      apiFetch('/campaigns?status=').catch(() => null)
    ])
    const overview = overviewRes?.ok ? await overviewRes.json() : { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0, avgCtr: 0, avgRoas: 0, activeCampaigns: 0 }
    const campaigns = campaignsRes?.ok ? await campaignsRes.json() : []
    const roleName = state.user?.role || state.activeRole

    contentContainer.innerHTML = `
      <div class="space-y-8">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-3xl font-black tracking-tight uppercase">Dashboard</h2>
            <p class="text-gray-400 text-sm mt-1">${state.company?.name || 'Marketing'} Overview ${roleName !== 'Super Admin' ? '| ' + roleName : ''}</p>
          </div>
          ${['Expert', 'Admin'].includes(roleName) ? `<button onclick="switchScreen('Objective')" class="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer">+ New Campaign</button>` : ''}
        </div>

        <!-- KPI Cards -->
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

        <!-- Recent Campaigns -->
        <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
          <div class="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
            <h3 class="font-bold text-sm uppercase tracking-widest">Recent Campaigns</h3>
            <span class="text-[10px] text-gray-500">${campaigns.length} total</span>
          </div>
          <div class="divide-y divide-[var(--border-color)]">
            ${campaigns.slice(0, 8).map(c => `
              <div class="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full ${c.status === 'active' ? 'bg-emerald-400' : c.status === 'draft' ? 'bg-gray-400' : c.status === 'approved' ? 'bg-blue-400' : c.status === 'pending_review' ? 'bg-amber-400' : 'bg-gray-600'}"></div>
                  <div>
                    <div class="font-bold text-sm">${c.name || 'Untitled Campaign'}</div>
                    <div class="text-[10px] text-gray-500">${(c.platforms || []).join(', ') || 'No platforms'} | ${c.objective?.name || c.campaignType || '-'}</div>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <span class="px-2 py-1 rounded-full text-[9px] font-bold ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : c.status === 'draft' ? 'bg-gray-500/10 text-gray-400' : c.status === 'approved' ? 'bg-blue-500/10 text-blue-400' : c.status === 'pending_review' ? 'bg-amber-500/10 text-amber-400' : 'bg-gray-500/10 text-gray-400'} uppercase">${c.status}</span>
                  ${c.totalBudget ? `<span class="text-xs text-gray-400">$${c.totalBudget.toLocaleString()}</span>` : ''}
                </div>
              </div>
            `).join('') || '<div class="p-8 text-center text-gray-500">No campaigns yet. Create your first campaign!</div>'}
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
    const [campaignsRes, queueRes] = await Promise.all([
      apiFetch('/campaigns?status=pending_review'),
      apiFetch('/cmo/queue')
    ])
    const pendingCampaigns = campaignsRes.ok ? await campaignsRes.json() : []
    const queueItems = queueRes.ok ? await queueRes.json() : []

    contentContainer.innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black tracking-tight uppercase">Ad Approvals</h2>
          <div class="flex gap-2">
            <button class="approval-tab px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-bold cursor-pointer" data-tab="campaigns">Campaigns (${pendingCampaigns.length})</button>
            <button class="approval-tab px-4 py-2 bg-gray-500/10 border border-gray-500/30 text-gray-400 rounded-lg text-xs font-bold cursor-pointer" data-tab="assets">Assets (${queueItems.length})</button>
          </div>
        </div>

        <!-- Pending Campaigns -->
        <div id="approval-campaigns" class="space-y-4">
          ${pendingCampaigns.map(c => `
            <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <div class="p-5 flex items-center justify-between">
                <div>
                  <div class="font-bold text-lg">${c.name || 'Untitled'}</div>
                  <div class="text-xs text-gray-500 mt-1">${(c.platforms || []).join(', ')} | Budget: $${c.totalBudget || c.dailyBudget || 0} | ${c.objective?.name || '-'}</div>
                </div>
                <div class="flex gap-2">
                  <button class="approve-camp-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer" data-id="${c.id}">Approve</button>
                  <button class="reject-camp-btn px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer" data-id="${c.id}" data-name="${c.name}">Reject</button>
                </div>
              </div>
              ${c.brief ? `<div class="px-5 pb-4 text-sm text-gray-400 border-t border-[var(--border-color)] pt-3">${c.brief.substring(0, 200)}${c.brief.length > 200 ? '...' : ''}</div>` : ''}
            </div>
          `).join('') || '<div class="text-center text-gray-500 p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">No campaigns pending review</div>'}
        </div>

        <!-- Asset Queue (hidden by default, shown when assets tab clicked) -->
        <div id="approval-assets" class="hidden space-y-4">
          ${queueItems.length > 0 ? `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              ${queueItems.map(item => `
                <div class="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-hidden">
                  ${item.type === 'image' ? `<img src="${item.url}" class="w-full h-32 object-cover" alt="${item.title}">` : `<div class="w-full h-32 bg-gray-800 flex items-center justify-center text-2xl">▶️</div>`}
                  <div class="p-3">
                    <div class="text-xs font-bold truncate">${item.title || item.id}</div>
                    <div class="text-[10px] text-gray-500">${item.type} | ${item.status}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-center text-gray-500 p-8 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">No assets in queue</div>'}
        </div>
      </div>
    `

    // Tab switching
    document.querySelectorAll('.approval-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.approval-tab').forEach(t => { t.classList.remove('bg-amber-500/10', 'border-amber-500/30', 'text-amber-400'); t.classList.add('bg-gray-500/10', 'border-gray-500/30', 'text-gray-400') })
        tab.classList.remove('bg-gray-500/10', 'border-gray-500/30', 'text-gray-400'); tab.classList.add('bg-amber-500/10', 'border-amber-500/30', 'text-amber-400')
        document.getElementById('approval-campaigns').classList.toggle('hidden', tab.dataset.tab !== 'campaigns')
        document.getElementById('approval-assets').classList.toggle('hidden', tab.dataset.tab !== 'assets')
      }
    })

    // Approve/Reject handlers
    document.querySelectorAll('.approve-camp-btn').forEach(btn => {
      btn.onclick = async () => {
        const res = await apiFetch(`/campaigns/${btn.dataset.id}/approve`, { method: 'POST' })
        if (res.ok) { showNotification('Campaign approved!', 'success'); renderRedesignedApprovalsScreen() }
      }
    })
    document.querySelectorAll('.reject-camp-btn').forEach(btn => {
      btn.onclick = async () => {
        const reason = prompt(`Reason for rejecting "${btn.dataset.name}":`)
        if (!reason) return
        const res = await apiFetch(`/campaigns/${btn.dataset.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
        if (res.ok) { showNotification('Campaign rejected', 'success'); renderRedesignedApprovalsScreen() }
      }
    })
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
