import './style.css'
import { deployToTikTok } from './tiktokDeploy.js'

const API_BASE = 'http://localhost:5243/api'

// --- State Management ---
const state = {
  activeRole: 'Expert',
  activeScreen: 'Objective',
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
  Admin: {
    displayName: 'Platform Admin',
    icon: 'A',
    themeColor: 'purple',
    screens: [
      { id: 'Config', label: 'Platform Config', icon: '⚙️' },
      { id: 'CompanyProfile', label: 'Company Profile', icon: '🏢' },
      { id: 'RoleManagement', label: 'Role Management', icon: '👤' },
      { id: 'Calendar', label: 'Global Calendar', icon: '📅' },
      { id: 'Guideline', label: 'Brand Guideline', icon: '📜' },
      { id: 'Assets', label: 'Creative Assets', icon: '🖼️' },
    ]
  },
  CMO: {
    displayName: 'CMO Dashboard',
    icon: 'C',
    themeColor: 'amber',
    screens: [
      { id: 'BudgetMatrix', label: 'Budget & Matrix', icon: '📈' },
      { id: 'Approvals', label: 'Ad Approvals', icon: '✅' },
      { id: 'Monitoring', label: 'AI Monitoring', icon: '📊' },
      { id: 'Budget', label: 'Budget Overview', icon: '💰' },
      { id: 'Notifications', label: 'Notifications', icon: '🔔' },
    ]
  },
  PPC: {
    displayName: 'PPC Specialist',
    icon: 'P',
    themeColor: 'emerald',
    screens: [
      { id: 'ApprovedAssets', label: 'Approved Assets', icon: '✅' },
      { id: 'DeploySelection', label: 'Platform Selection', icon: '🎯' },
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

// --- Utils ---
function toggleDropdown() {
  roleDropdown.classList.toggle('hidden')
}

function switchRole(roleId) {
  state.activeRole = roleId
  state.activeScreen = roles[roleId].screens[0].id
  roleDropdown.classList.add('hidden')
  updateUI()
}

function switchScreen(screenId) {
  state.activeScreen = screenId
  updateUI()
}

function showNotification(message, type = 'success') {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-in fade-in duration-300'
  overlay.id = 'notification-overlay'

  overlay.innerHTML = `
    <div class="bg-[#0B0F15] border border-white/10 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full mx-6 text-center space-y-6 animate-in zoom-in-95 duration-300">
        <div class="w-16 h-16 ${type === 'success' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'} rounded-full flex items-center justify-center mx-auto border-2 text-2xl">
            ${type === 'success' ? '✓' : '⚠'}
        </div>
        <div class="space-y-2">
            <h3 class="text-white font-black uppercase tracking-tighter text-xl">${type === 'success' ? 'Success' : 'Attention'}</h3>
            <p class="text-gray-400 text-sm font-medium leading-relaxed">${message}</p>
        </div>
        <button id="close-notification" class="w-full py-3 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-gray-200 transition-all cursor-pointer">
            Dismiss
        </button>
    </div>
  `

  document.body.appendChild(overlay)

  document.getElementById('close-notification').onclick = () => {
    overlay.classList.add('opacity-0', 'scale-95')
    overlay.style.transition = 'all 0.3s ease'
    setTimeout(() => overlay.remove(), 300)
  }
}

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
    await fetch(`${API_BASE}/cmo/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.marketingData.cmoQueue)
    })
    console.log('✓ CMO Queue synced to server.')
  } catch (e) {
    console.warn('⚠ Could not sync CMO Queue to server.')
  }
}

async function savePpcQueue() {
  try {
    await fetch(`${API_BASE}/ppc/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.marketingData.ppcQueue)
    })
    console.log('✓ PPC Queue synced to server.')
  } catch (e) {
    console.warn('⚠ Could not sync PPC Queue to server.')
  }
}

// --- UI Rendering ---
function updateUI() {
  const currentRole = roles[state.activeRole]
  const currentScreen = currentRole.screens.find(s => s.id === state.activeScreen) || currentRole.screens[0]

  // Update Header & Sidebar
  activeRoleDisplay.innerText = currentRole.displayName
  activeRoleIcon.innerText = currentRole.icon
  activeRoleIcon.className = `w-8 h-8 rounded-full bg-${currentRole.themeColor}-900/50 flex items-center justify-center text-${currentRole.themeColor}-400 font-bold border border-${currentRole.themeColor}-500/30`
  userInitial.innerText = currentRole.icon
  userName.innerText = `${currentRole.displayName.split(' ')[1]} User`

  pageTitleName.innerText = currentScreen.id

  // Update Nav Links
  navLinks.innerHTML = currentRole.screens.map(screen => {
    const isApprovals = screen.id === 'Approvals'
    const queueCount = state.marketingData.cmoQueue.length

    return `
      <button class="nav-btn w-full flex items-center justify-between p-3 rounded-xl transition-all ${state.activeScreen === screen.id ? `bg-${currentRole.themeColor}-500/20 text-${currentRole.themeColor}-400 border border-${currentRole.themeColor}-500/30 font-bold` : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}" data-screen="${screen.id}">
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
      renderApprovalsScreen()
      break
    case 'Notifications':
      renderNotificationsScreen()
      break
    case 'DeploySelection':
      renderDeploySelectionScreen()
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
          <button class="objective-card group bg-[#151921] border-2 ${state.marketingData.objective === goal ? 'border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'border-[#2A2F3A]'} p-6 rounded-2xl transition-all hover:scale-102 hover:border-cyan-400 text-center" data-goal="${goal}">
            <div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-800 flex items-center justify-center group-hover:bg-cyan-900/30 transition-colors">
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
      <div class="lg:col-span-2 bg-[#151921] p-6 rounded-2xl border border-[#2A2F3A] space-y-5">
        <h3 class="text-lg font-bold flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm">+</span>
          New Target Set
        </h3>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Country</label>
            <select id="t-country" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-2.5 rounded-lg focus:border-cyan-500 outline-none text-sm">
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Germany</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Language</label>
            <select id="t-language" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-2.5 rounded-lg focus:border-cyan-500 outline-none text-sm">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
        </div>

        <div class="space-y-3">
             <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Specific Area (Optional)</label>
             <button class="w-full h-24 bg-[#0B0E14] border-2 border-dashed border-[#2A2F3A] rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all text-sm">
                <span class="text-xl mb-1">🗺️</span>
                <span>Select from Maps</span>
             </button>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Age Range</label>
            <div class="flex items-center space-x-2">
              <input type="number" id="t-age-min" value="18" class="w-1/2 bg-[#0B0E14] border border-[#2A2F3A] p-2.5 rounded-lg outline-none text-sm">
              <span class="text-xs text-gray-500">to</span>
              <input type="number" id="t-age-max" value="65" class="w-1/2 bg-[#0B0E14] border border-[#2A2F3A] p-2.5 rounded-lg outline-none text-sm">
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gender</label>
            <div class="flex bg-[#0B0E14] p-1 rounded-lg border border-[#2A2F3A]">
              ${['All', 'Male', 'Female'].map(g => `<button class="gender-btn flex-1 py-1.5 rounded-md text-xs font-bold ${g === 'All' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:text-white'} transition-all" data-gender="${g}">${g}</button>`).join('')}
            </div>
          </div>
        </div>

        <button id="add-target-set" class="w-full py-3 bg-transparent border-2 border-dashed border-cyan-500/30 text-cyan-400 font-bold rounded-xl hover:bg-cyan-500/10 transition-all text-xs">
          + ADD TO LIST
        </button>
      </div>

      <div class="bg-[#151921] p-6 rounded-2xl border border-[#2A2F3A] flex flex-col">
        <h3 class="text-lg font-bold mb-4 flex items-center justify-between">
          Your Target Sets
          <span class="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400" id="target-count">${state.marketingData.targeting.length}</span>
        </h3>
        
        <div id="target-list" class="flex-1 space-y-3 overflow-y-auto max-h-[300px] mb-4">
          ${state.marketingData.targeting.length === 0 ? '<p class="text-gray-500 italic text-center py-6 text-xs">No target sets added yet.</p>' : state.marketingData.targeting.map((t, idx) => `
            <div class="p-3 bg-[#0B0E14] border border-[#2A2F3A] rounded-xl relative group">
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
                <span class="text-[9px] font-black uppercase tracking-widest text-white">Baseline</span>
            </button>
            <div class="w-6 h-[1px] ${step > 1 ? 'bg-rose-500' : 'bg-gray-800'}"></div>
            <button class="flex items-center space-x-1.5 transition-all hover:opacity-80 ${step >= 2 ? 'opacity-100' : 'opacity-30'} ${state.marketingData.level1Questions.length === 0 ? 'pointer-events-none' : ''}" onclick="state.marketingData.strategyStep = 2; renderStrategyHub()">
                <span class="w-5 h-5 rounded-full ${step >= 2 ? 'bg-cyan-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">2</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-white">Probe 1</span>
            </button>
            <div class="w-6 h-[1px] ${step > 2 ? 'bg-cyan-500' : 'bg-gray-800'}"></div>
            <button class="flex items-center space-x-1.5 transition-all hover:opacity-80 ${step >= 3 ? 'opacity-100' : 'opacity-30'} ${state.marketingData.level2Questions.length === 0 ? 'pointer-events-none' : ''}" onclick="state.marketingData.strategyStep = 3; renderStrategyHub()">
                <span class="w-5 h-5 rounded-full ${step >= 3 ? 'bg-purple-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">3</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-white">Final</span>
            </button>
        </div>

        <!-- Section 1: Research & Strategy -->
        <div id="section-research" class="${step === 1 ? 'block' : 'hidden'} space-y-6 text-center">
            <h2 class="text-3xl font-black uppercase tracking-tighter">Research & Strategy</h2>
            <p class="text-gray-500 text-sm font-medium">AI-driven diagnostic framework</p>
            
            <div class="bg-[#151921] p-8 rounded-[30px] border border-[#2A2F3A] space-y-6 text-left shadow-2xl">
                <div class="space-y-3">
                    <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Generation brief</label>
                    <textarea id="hub-goal" class="w-full h-32 bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-2xl outline-none focus:border-rose-500 transition-all text-white placeholder:text-gray-800 text-sm" placeholder="e.g. I want to increase brand awareness...">${state.marketingData.goal}</textarea>
                </div>
                
                <button id="btn-strategy-1" class="w-full py-4 bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-black rounded-xl transition-all shadow-xl flex flex-col items-center justify-center gap-1 text-base uppercase tracking-widest disabled:opacity-50" ${isLoading ? 'disabled' : ''}>
                    ${isLoading ? `<span class="text-[10px] opacity-70 animate-pulse">${state.strategyLoadingMessage}</span>` : 'ANALYZE STRATEGY <span class="text-lg">✨</span>'}
                </button>
            </div>
        </div>

        <!-- Section 2: Probe Part 1 (Level 1 Qs) -->
        <div id="section-probe-1" class="${step === 2 ? 'block' : 'hidden'} space-y-6">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-cyan-400">Probe <span class="text-white">Part 1</span></h2>
                <p class="text-gray-500 text-xs font-medium italic">Conceptual diagnostics based on your brief.</p>
            </div>

            <div class="bg-[#151921] border border-[#2A2F3A] rounded-[30px] p-8 shadow-2xl space-y-8">
                <div class="space-y-6">
                    ${state.marketingData.level1Questions.map((q, i) => `
                        <div class="space-y-2">
                            <label class="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest mb-1 block">Question 0${i + 1}</label>
                            <p class="text-sm font-bold text-gray-200 mb-2">${q}</p>
                            <input type="text" value="${state.marketingData.level1Answers[i]}" class="probe-l1-input w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-cyan-500 text-white text-sm" data-index="${i}" placeholder="Enter your response...">
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
                <h2 class="text-3xl font-black uppercase tracking-tighter text-purple-400">Final <span class="text-white">Diagnostics</span></h2>
                <p class="text-gray-500 text-xs font-medium italic">Advanced psychological campaign pillars.</p>
            </div>

            <div class="bg-[#151921] border border-[#2A2F3A] rounded-[30px] p-8 shadow-2xl space-y-8">
                <div class="space-y-6">
                    ${state.marketingData.level2Questions.map((q, i) => `
                        <div class="space-y-2">
                            <label class="text-[9px] font-black text-purple-500/50 uppercase tracking-widest mb-1 block">Deep Dive 0${i + 1}</label>
                            <p class="text-sm font-bold text-gray-200 mb-2">${q}</p>
                            <input type="text" value="${state.marketingData.level2Answers[i]}" class="probe-l2-input w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-white text-sm" data-index="${i}" placeholder="Enter final thoughts...">
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
            <h2 class="text-2xl font-black tracking-tight uppercase">Campaign Creative Hub</h2>
            <p class="text-gray-500 text-xs font-medium">AI orchestration & content config.</p>
        </div>

        <div class="bg-[#151921] border border-[#2A2F3A] rounded-2xl p-6 shadow-2xl space-y-6">
            <div class="space-y-2">
                <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Generation brief</label>
                <textarea id="config-goal" class="w-full h-48 bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-rose-500 transition-all text-gray-400 font-medium leading-relaxed font-mono text-[10px]" placeholder="AI brief...">${consolidatedBrief}</textarea>
                <div class="flex justify-start">
                    <button class="px-5 py-2 bg-rose-600/20 text-rose-500 border border-rose-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Analyze Strategy 🚀</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-gray-800/50">
                <!-- Style Preset -->
                <div class="space-y-3">
                    <h3 class="text-base font-black text-white uppercase tracking-tight">Style Preset</h3>
                    <div class="relative">
                        <select id="style-preset" class="w-full bg-white text-black p-3 rounded-xl outline-none appearance-none font-bold text-sm shadow-xl">
                            <option ${state.marketingData.stylePreset === 'Cinematic' ? 'selected' : ''}>Cinematic</option>
                            <option ${state.marketingData.stylePreset === 'Minimalism' ? 'selected' : ''}>Minimalism</option>
                            <option ${state.marketingData.stylePreset === 'Cyberpunk' ? 'selected' : ''}>Cyberpunk</option>
                            <option ${state.marketingData.stylePreset === 'Vintage' ? 'selected' : ''}>Vintage</option>
                        </select>
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-black text-sm">▼</div>
                    </div>
                </div>

                <!-- Aspect Ratio -->
                <div class="space-y-3">
                    <h3 class="text-base font-black text-white uppercase tracking-tight">Aspect Ratio</h3>
                    <div class="flex gap-2">
                        ${['1:1', '16:9', '9:16'].map(ratio => `
                            <button class="aspect-ratio-btn flex-1 py-3 rounded-lg font-black text-xs transition-all ${state.marketingData.aspectRatio === ratio ? 'bg-[#0B0E14] text-white ring-2 ring-white' : 'bg-white text-black shadow-lg hover:bg-gray-100'}" data-ratio="${ratio}">
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
                        <h3 class="text-base font-black text-white uppercase tracking-tight">Assets</h3>
                        <span class="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Photos, videos</span>
                    </div>
                    
                    <div class="space-y-2">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Upload</p>
                        <div class="bg-[#0B0E14] border border-[#2A2F3A] p-2.5 rounded-lg flex items-center gap-2">
                            <input type="file" id="asset-upload" class="hidden">
                            <button onclick="document.getElementById('asset-upload').click()" class="bg-gray-800 hover:bg-gray-700 text-white px-2 py-1 rounded-md text-[9px] font-bold transition-all">Choose</button>
                            <span class="text-[9px] text-gray-500">No file</span>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">URL</p>
                        <div class="flex gap-2">
                            <input type="text" class="flex-1 bg-[#0B0E14] border border-[#2A2F3A] p-2.5 rounded-lg outline-none focus:border-rose-500 text-white text-[10px]" placeholder="https://...">
                            <button class="bg-white text-black px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">ADD</button>
                        </div>
                    </div>
                </div>

                <!-- Generation Targets Section -->
                <div class="space-y-3">
                     <div class="flex justify-between items-center">
                        <h3 class="text-base font-black text-white uppercase tracking-tight">Targets</h3>
                        <span class="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Volume</span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Photos</label>
                            <input type="number" value="${state.marketingData.generationPhotos}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-white" onchange="state.marketingData.generationPhotos = this.value">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Videos</label>
                            <input type="number" value="${state.marketingData.generationVideos}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-white" onchange="state.marketingData.generationVideos = this.value">
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Posts</label>
                        <input type="number" value="${state.marketingData.generationPosts}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-2 rounded-lg outline-none focus:border-cyan-500 text-lg font-black text-white" onchange="state.marketingData.generationPosts = this.value">
                    </div>
                </div>
            </div>

            <div class="pt-6">
                <button id="proceed-to-studio" class="w-full py-4 bg-white text-black font-black rounded-xl shadow-xl hover:bg-cyan-400 transition-all text-base uppercase tracking-widest">
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
      await fetch(`${API_BASE}/campaigns`, {
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
        await fetch(`${API_BASE}/assets/save-url`, {
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
    const response = await fetch(`${API_BASE}/assets`)
    if (!response.ok) throw new Error('Failed to fetch assets')
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
                  <div class="group bg-[#151921] border border-[#2A2F3A] rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all flex flex-col">
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
          const res = await fetch(`${API_BASE}/assets/${asset.id}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            card.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
              card.remove();
            }, 300);
          } else {
            showNotification("Failed to delete asset from server.", "error");
          }
        } catch (error) {
          console.error("Error deleting asset:", error);
          showNotification("Network error while deleting asset.", "error");
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
      showNotification(`SUCCESS: ${locallyApproved.length} asset(s) dispatched to CMO for final review.`)
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
                <div class="bg-[#151921] p-5 rounded-2xl border border-[#2A2F3A] relative overflow-hidden group">
                    <div class="absolute -right-2 -top-2 text-4xl opacity-5 group-hover:opacity-10 transition-opacity">${s.icon === '💰' ? '💵' : '📈'}</div>
                    <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">${s.label}</p>
                    <h3 class="text-2xl font-black">${s.val}</h3>
                    <p class="text-[10px] font-bold ${s.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'} mt-1">${s.trend} ↑</p>
                </div>
            `).join('')}
        </div>

        <div class="bg-[#151921] border border-[#2A2F3A] rounded-2xl overflow-hidden">
            <div class="p-4 border-b border-[#2A2F3A] flex justify-between items-center">
                <h3 class="font-bold uppercase tracking-widest text-xs">Performance Matrix</h3>
                <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                    <span class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Live</span>
                </div>
            </div>
            <div class="p-0 overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="bg-[#0B0E14]/50 text-[10px] text-gray-500 uppercase font-black">
                        <tr>
                            <th class="px-6 py-4">Campaign Name</th>
                            <th class="px-6 py-4">ROI Index</th>
                            <th class="px-6 py-4">Spend</th>
                            <th class="px-6 py-4">Auto Actions</th>
                            <th class="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-800">
                        ${[
      { name: 'S-Tier Lifestyle v2', roi: 92, spend: '$2,400', action: 'Scaling Up', status: 'Optimal' },
      { name: 'Product Reveal Alpha', roi: 84, spend: '$1,850', action: 'Monitoring', status: 'Stable' },
      { name: 'Growth Hack Beta', roi: 45, spend: '$940', action: 'Shutting Down', status: 'Critical' },
      { name: 'Retention Main 2024', roi: 78, spend: '$3,100', action: 'Budget Realloc', status: 'Normal' }
    ].map(r => `
                            <tr class="hover:bg-gray-800/30 transition-colors">
                                <td class="px-6 py-4 font-bold text-sm text-gray-300">${r.name}</td>
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
                                    <span class="text-xs font-bold text-gray-400">${r.status}</span>
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
                <button class="platform-btn group bg-[#151921] border border-[#2A2F3A] p-6 rounded-2xl hover:border-purple-500 hover:bg-purple-500/5 transition-all flex flex-col items-center gap-3" data-platform="${p}">
                    <div class="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        ${p === 'Facebook' ? 'f' : p === 'Instagram' ? '📸' : p === 'YouTube' ? '▶️' : '🎵'}
                    </div>
                    <h3 class="font-bold text-lg">${p}</h3>
                </button>
            `).join('')}
        </div>
    </div>
    <div id="modal-overlay" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center hidden">
        <div id="modal-content" class="bg-[#151921] w-full max-w-md p-8 rounded-3xl border border-[#2A2F3A] space-y-6">
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
                <input type="text" id="tt-adv-id" value="${config.advertiser_id}" placeholder="760097..." class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Access Token</label>
                <input type="password" id="tt-token" value="${config.access_token}" placeholder="act_..." class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Pixel ID</label>
                <input type="text" id="tt-pixel" value="${config.pixel_id}" placeholder="PXL_..." class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
            </div>
            <div class="space-y-1">
                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Identity ID</label>
                <input type="text" id="tt-identity" value="${config.identity_id}" placeholder="ID_..." class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white shadow-inner">
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
            <input type="text" placeholder="Account Name" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none text-sm">
            <input type="password" placeholder="Key" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none text-sm">
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
                <div class="bg-[#151921] border border-[#2A2F3A] p-8 rounded-3xl space-y-6">
                    <h4 class="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] border-b border-purple-500/20 pb-2">Primary Information</h4>
                    
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Company Name</label>
                            <input type="text" id="cp-name" value="${profile.name}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Industry / Niche</label>
                            <input type="text" id="cp-industry" value="${profile.industry}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Official Website</label>
                            <input type="text" id="cp-website" value="${profile.website}" placeholder="https://..." class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">HQ Location</label>
                            <input type="text" id="cp-location" value="${profile.location}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Employee Count</label>
                            <select id="cp-employees" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                                <option value="1-10" ${profile.employeeCount === '1-10' ? 'selected' : ''}>1-10 (Startup)</option>
                                <option value="11-50" ${profile.employeeCount === '11-50' ? 'selected' : ''}>11-50 (SME)</option>
                                <option value="51-200" ${profile.employeeCount === '51-200' ? 'selected' : ''}>51-200 (Growth)</option>
                                <option value="200+" ${profile.employeeCount === '200+' ? 'selected' : ''}>200+ (Enterprise)</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Founding Year</label>
                            <input type="number" id="cp-founding" value="${profile.foundingYear}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500 text-sm font-bold text-white transition-all">
                        </div>
                    </div>
                </div>

                <!-- Strategic Narrative Card -->
                <div class="bg-[#151921] border border-[#2A2F3A] p-8 rounded-3xl space-y-6">
                    <h4 class="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] border-b border-emerald-500/20 pb-2">Strategic Narrative</h4>
                    
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">About the Company</label>
                        <textarea id="cp-about" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-medium text-gray-300 min-h-[120px] transition-all" placeholder="Describe your company's core values...">${profile.about}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Mission Statement</label>
                            <textarea id="cp-mission" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-medium text-gray-300 min-h-[80px] transition-all">${profile.mission}</textarea>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Vision Statement</label>
                            <textarea id="cp-vision" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-medium text-gray-300 min-h-[80px] transition-all">${profile.vision}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Social & Presence -->
            <div class="space-y-6">
                <div class="bg-[#151921] border border-[#2A2F3A] p-8 rounded-3xl space-y-6 sticky top-8">
                    <h4 class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] border-b border-cyan-500/20 pb-2">Social Ecosystem</h4>
                    
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#1877F2]/20 rounded flex items-center justify-center text-[#1877F2]">f</span>
                                Facebook Page
                            </label>
                            <input type="text" id="cp-fb" value="${profile.socialLinks.facebook}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-[#1877F2] text-xs font-bold text-white transition-all">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#E4405F]/20 rounded flex items-center justify-center text-[#E4405F]">i</span>
                                Instagram Handle
                            </label>
                            <input type="text" id="cp-ig" value="${profile.socialLinks.instagram}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-[#E4405F] text-xs font-bold text-white transition-all">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#0A66C2]/20 rounded flex items-center justify-center text-[#0A66C2]">in</span>
                                LinkedIn Profile
                            </label>
                            <input type="text" id="cp-li" value="${profile.socialLinks.linkedin}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-[#0A66C2] text-xs font-bold text-white transition-all">
                        </div>

                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase flex items-center gap-2">
                                <span class="w-4 h-4 bg-[#1DA1F2]/20 rounded flex items-center justify-center text-[#1DA1F2]">t</span>
                                Twitter / X
                            </label>
                            <input type="text" id="cp-tw" value="${profile.socialLinks.twitter}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-[#1DA1F2] text-xs font-bold text-white transition-all">
                        </div>
                    </div>

                    <!-- Profile Completeness Mockup -->
                    <div class="pt-6 border-t border-[#2A2F3A] space-y-3">
                        <div class="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                            <span class="text-gray-500">Profile Completeness</span>
                            <span class="text-purple-500">75%</span>
                        </div>
                        <div class="h-1.5 w-full bg-[#0B0E14] rounded-full overflow-hidden">
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

function renderRoleManagementScreen() {
  const roleStats = Object.keys(roles).map(id => ({
    id,
    ...roles[id],
    userCount: Math.floor(Math.random() * 5) + 1 // Simulated for UI
  }))

  contentContainer.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <div class="flex justify-between items-center">
            <div>
                <h2 class="text-3xl font-black uppercase italic tracking-tighter">Identity <span class="text-purple-500">Access Control</span></h2>
                <p class="text-gray-500 text-xs uppercase tracking-widest font-bold mt-1">Manage platform roles and permission tokens</p>
            </div>
            <button class="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center gap-2">
                <span>ADD NEW SEAT</span>
                <span class="text-lg">+</span>
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${roleStats.map(role => `
                <div class="bg-[#151921] border border-[#2A2F3A] p-6 rounded-3xl hover:border-purple-500/30 transition-all group relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
                    
                    <div class="flex items-start justify-between relative z-10">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-${role.themeColor}-900/30 border border-${role.themeColor}-500/30 flex items-center justify-center text-${role.themeColor}-400 font-black text-xl shadow-inner">
                                ${role.icon}
                            </div>
                            <div>
                                <h4 class="text-lg font-black uppercase tracking-tight">${role.displayName}</h4>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span class="text-[10px] text-gray-400 font-black uppercase tracking-widest">${role.userCount} Active Users</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-all">⚙️</button>
                            <button class="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-rose-500 transition-all">🔒</button>
                        </div>
                    </div>

                    <div class="mt-6 space-y-3 relative z-10">
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Enabled Modules</p>
                        <div class="flex flex-wrap gap-2">
                            ${role.screens.map(screen => `
                                <span class="px-3 py-1 bg-[#0B0E14] border border-[#1F2430] rounded-full text-[9px] font-black text-gray-400 uppercase tracking-tighter flex items-center gap-1.5">
                                    <span>${screen.icon}</span>
                                    <span>${screen.label}</span>
                                </span>
                            `).join('')}
                        </div>
                    </div>

                    <div class="mt-8 pt-6 border-t border-[#1F2430] flex justify-between items-center relative z-10">
                        <div class="flex -space-x-2">
                            ${Array(role.userCount).fill(0).map((_, i) => `
                                <div class="w-8 h-8 rounded-full border-2 border-[#151921] bg-gray-800 flex items-center justify-center text-[10px] font-black uppercase overflow-hidden">
                                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${role.id}${i}" class="w-full h-full object-cover">
                                </div>
                            `).join('')}
                        </div>
                        <button class="text-[10px] font-black text-purple-400 hover:text-purple-300 uppercase tracking-widest transition-all">Manage Permissions →</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- System Logs / Security Preview -->
        <div class="bg-[#151921] border border-dashed border-[#2A2F3A] p-8 rounded-3xl">
            <h3 class="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <span class="text-purple-500">🛡️</span> Security Access Logs
            </h3>
            <div class="space-y-4">
                ${[1, 2, 3].map(i => `
                    <div class="flex items-center justify-between py-3 border-b border-[#1F2430] last:border-0 border-dashed">
                        <div class="flex items-center gap-4">
                            <div class="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs">✓</div>
                            <div>
                                <p class="text-[11px] font-bold text-gray-200">Role Elevation Authorized: <span class="text-purple-400">${['PPC Specialist', 'CMO Dashboard', 'Marketing Expert'][i - 1]}</span></p>
                                <p class="text-[9px] text-gray-500 uppercase tracking-widest">User ID: system_auth_882${i} • 24 Feb 2026, 11:55 AM</p>
                            </div>
                        </div>
                        <span class="text-[9px] font-black text-gray-600 tracking-tighter">IP: 192.168.1.10${i}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
  `
}

function renderCalendarScreen() {
  contentContainer.innerHTML = `
    <div class="h-full flex flex-col space-y-6">
        <h2 class="text-3xl font-black uppercase italic">Operations Calendar</h2>
        <div class="flex-1 grid grid-cols-7 gap-px bg-[#2A2F3A] border border-[#2A2F3A] rounded-3xl overflow-hidden">
            ${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => `<div class="bg-[#151921] p-4 text-center text-[10px] font-black text-gray-500">${d}</div>`).join('')}
            ${Array.from({ length: 35 }).map((_, i) => `<div class="bg-[#0B0E14] p-4 min-h-[100px] hover:bg-white/5 transition-colors relative"><span class="text-xs font-bold text-gray-700">${(i % 31) + 1}</span></div>`).join('')}
        </div>
    </div>
  `
}

function renderGuidelineScreen() {
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
            <button class="bg-[#12161D] hover:bg-[#1A1F29] border border-[#2A2F3A] px-5 py-2 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-2 transition-all shadow-xl">
                 <span class="text-base opacity-70">⏱</span> LOAD TEMPLATE
            </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column: Primary Config -->
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-[#151921] border border-[#2A2F3A] p-6 rounded-2xl shadow-2xl space-y-6">
                    
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Brand Label</label>
                        <input id="bg-label" type="text" value="${state.marketingData.brandGuidelines.brandLabel}" class="w-full bg-[#0B0E14] border border-indigo-500/30 p-4 rounded-xl outline-none focus:border-indigo-500 transition-all font-bold text-base shadow-inner text-white" placeholder="...">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Tone</label>
                            <div class="relative">
                                <select id="bg-tone" class="w-full bg-[#12161D] text-white border border-[#2A2F3A] p-3 rounded-xl outline-none appearance-none font-bold focus:border-indigo-500 text-sm">
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
                                <select id="bg-lang" class="w-full bg-[#12161D] text-white border border-[#2A2F3A] p-3 rounded-xl outline-none appearance-none font-bold focus:border-indigo-500 text-sm">
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
                        <textarea id="bg-desc" class="w-full h-32 bg-[#12161D] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-indigo-500 transition-all text-white font-medium leading-relaxed shadow-sm text-sm" placeholder="Core essence...">${state.marketingData.brandGuidelines.description}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-3">
                            <h4 class="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">≋ WHITELIST</h4>
                            <textarea id="bg-white" class="w-full h-24 bg-[#0B0E14] border-dashed border-2 border-emerald-500/20 p-3 rounded-xl outline-none focus:border-emerald-500/50 transition-all text-[10px] font-medium italic text-gray-400" placeholder="Prioritize...">${state.marketingData.brandGuidelines.whitelist}</textarea>
                        </div>
                        <div class="space-y-3">
                            <h4 class="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">⦸ BLACKLIST</h4>
                            <textarea id="bg-black" class="w-full h-24 bg-[#0B0E14] border-dashed border-2 border-rose-500/20 p-3 rounded-xl outline-none focus:border-rose-500/50 transition-all text-[10px] font-medium italic text-gray-400" placeholder="Forbidden...">${state.marketingData.brandGuidelines.blacklist}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Visual DNA -->
            <div class="space-y-6">
                <!-- Typography Card -->
                <div class="bg-[#151921] p-6 rounded-2xl border border-[#2A2F3A] shadow-2xl space-y-4">
                    <h3 class="text-base font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <span class="text-indigo-600 text-lg font-serif italic font-black">T</span> TYPOGRAPHY
                    </h3>
                    
                    <div class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Heading Font</label>
                            <div class="p-3 bg-[#0B0E14] border border-[#2A2F3A] rounded-xl text-gray-300 text-xs font-bold shadow-sm">Montserrat Bold</div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Heading Size</label>
                            <div class="p-3 bg-[#0B0E14] border border-[#2A2F3A] rounded-xl text-gray-300 text-xs font-bold shadow-sm">32px</div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Body Font</label>
                            <div class="p-3 bg-[#0B0E14] border border-[#2A2F3A] rounded-xl text-gray-300 text-xs font-bold shadow-sm">Roboto Regular</div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase">Body Size</label>
                            <div class="p-3 bg-[#0B0E14] border border-[#2A2F3A] rounded-xl text-gray-300 text-xs font-bold shadow-sm">16px</div>
                        </div>
                    </div>
                </div>

                <!-- Palette Card -->
                <div class="bg-[#151921] p-6 rounded-2xl border border-[#2A2F3A] shadow-2xl space-y-4">
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
                     <button class="flex-1 py-3 bg-transparent border-2 border-[#2A2F3A] rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 transition-all">Discard</button>
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
  contentContainer.innerHTML = `
    <div class="space-y-8">
        <h2 class="text-3xl font-black uppercase italic tracking-tighter">Assets Library</h2>
        <div id="library-grid" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div class="col-span-full py-20 text-center animate-pulse text-gray-500 uppercase font-black text-xs tracking-widest">Indexing Library Content...</div>
        </div>
    </div>
  `

  try {
    const res = await fetch(`${API_BASE}/assets-library`)
    const assets = await res.json()
    const grid = document.getElementById('library-grid')

    grid.innerHTML = assets.map(v => {
      const fullUrl = `http://localhost:5243${v.url}`;
      return `
            <div class="bg-[#151921] border border-[#2A2F3A] rounded-2xl aspect-square overflow-hidden group hover:border-purple-500/50 transition-all duration-300 relative">
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
  const bm = state.marketingData.budgetMatrix

  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        <!-- Budget Configuration Card -->
        <div class="bg-[#151921] border border-[#2A2F3A] rounded-3xl p-8 shadow-2xl space-y-6">
            <h2 class="text-xl font-black uppercase tracking-tight text-white mb-6">Budget Configuration</h2>
            
            <div class="grid grid-cols-2 gap-8">
                <div class="space-y-4">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                        <span class="text-indigo-500">†</span> Total Spend Target ($)
                    </label>
                    <div class="bg-[#0B0E14] p-6 rounded-3xl border border-[#2A2F3A] shadow-inner">
                        <input type="text" value="1000" class="bg-transparent w-full text-2xl font-black outline-none text-white">
                    </div>
                </div>
                <div class="space-y-4">
                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Test Cost Per Creative ($)</label>
                    <div class="bg-[#0B0E14] p-4 rounded-xl border border-[#2A2F3A] shadow-inner">
                        <input type="text" value="50" class="bg-transparent w-full text-xl font-black outline-none text-white">
                    </div>
                </div>
            </div>

            <div class="space-y-5">
                <div class="flex justify-between items-center">
                    <label class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Reallocation (%)</label>
                    <span id="reallocation-val" class="px-3 py-1 bg-indigo-600 rounded-lg text-[10px] font-black text-white">${bm.reallocation}%</span>
                </div>
                <div class="relative pt-1">
                    <input type="range" id="reallocation-slider" value="${bm.reallocation}" class="w-full h-1 bg-[#0B0E14] rounded-lg appearance-none cursor-pointer accent-indigo-500">
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
        <div class="bg-[#151921] border border-[#2A2F3A] rounded-3xl p-8 shadow-2xl space-y-8">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-black uppercase tracking-tight text-white">Expectation Matrix</h2>
                <div class="bg-[#0B0E14] border border-[#2A2F3A] px-4 py-2 rounded-xl text-right">
                    <p class="text-[8px] font-black text-gray-500 uppercase">Weight</p>
                    <p id="total-weight" class="text-lg font-black text-white">${bm.reach + bm.click + bm.sales}%</p>
                </div>
            </div>

            <div class="space-y-8">
                <!-- Reach Item -->
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-xl bg-[#0B0E14] border border-[#2A2F3A] flex items-center justify-center text-gray-400 text-xs">👁</div>
                            <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Reach</span>
                        </div>
                        <span id="reach-val" class="text-base font-black text-white">${bm.reach}%</span>
                    </div>
                    <input type="range" id="reach-slider" value="${bm.reach}" class="w-full h-1 bg-[#0B0E14] rounded-lg appearance-none cursor-pointer accent-cyan-500">
                </div>

                <!-- Click Item -->
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-xl bg-[#0B0E14] border border-[#2A2F3A] flex items-center justify-center text-gray-400 text-xs">🖱</div>
                            <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Click</span>
                        </div>
                        <span id="click-val" class="text-base font-black text-white">${bm.click}%</span>
                    </div>
                    <input type="range" id="click-slider" value="${bm.click}" class="w-full h-1 bg-[#0B0E14] rounded-lg appearance-none cursor-pointer accent-purple-500">
                </div>

                <!-- Sales Item -->
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-xl bg-[#0B0E14] border border-[#2A2F3A] flex items-center justify-center text-gray-400 text-xs">🛍</div>
                            <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sales</span>
                        </div>
                        <span id="sales-val" class="text-base font-black text-white">${bm.sales}%</span>
                    </div>
                    <input type="range" id="sales-slider" value="${bm.sales}" class="w-full h-1 bg-[#0B0E14] rounded-lg appearance-none cursor-pointer accent-green-500">
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
              <div class="bg-[#151921] border border-dashed border-[#2A2F3A] p-20 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                  <span class="text-5xl opacity-20">📥</span>
                  <p class="text-gray-500 font-bold">No assets pending approval.<br><span class="text-xs font-medium opacity-50 uppercase tracking-tighter">New variations will appear here once approved by the Marketing Expert.</span></p>
              </div>
            ` : queue.map((asset, i) => {
    const isSelected = selectedIds.includes(asset.id)
    return `
                    <div class="bg-[#151921] p-5 rounded-2xl border ${isSelected ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-[#2A2F3A]'} flex items-center gap-6 group hover:border-amber-500/30 transition-all">
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
                            <p class="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Type: ${asset.type} • ID: ${asset.id.slice(0, 8)}...</p>
                            <p class="text-[10px] ${isSelected ? 'text-amber-500 font-black' : 'text-amber-500/70'} mt-1 uppercase font-bold italic">
                                ${isSelected ? 'READY FOR DEPLOYMENT SIGN-OFF' : 'Awaiting final CMO deployment sign-off.'}
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

function renderApprovedAssetsScreen() {
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
              <div class="bg-[#151921] border border-dashed border-[#2A2F3A] p-20 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                  <span class="text-5xl opacity-20">✅</span>
                  <p class="text-gray-500 font-bold">No approved assets available.<br><span class="text-xs font-medium opacity-50 uppercase tracking-tighter">Variations will appear here once authorized by the CMO.</span></p>
              </div>
            ` : queue.map((asset, i) => {
    const isSelected = selectedIds.includes(asset.id)
    return `
                    <div class="bg-[#151921] p-5 rounded-2xl border ${isSelected ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-[#2A2F3A]'} flex items-center gap-6 group hover:border-emerald-500/30 transition-all">
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
                            <p class="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Type: ${asset.type} • ID: ${asset.id.slice(0, 8)}...</p>
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
          <button id="go-to-approvals" class="px-8 py-3 bg-[#151921] border border-[#2A2F3A] hover:border-amber-500/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
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

        <div class="bg-[#151921] border border-[#2A2F3A] p-8 rounded-3xl shadow-2xl">
            <h3 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Execution Channels</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                ${['Facebook', 'YouTube', 'TikTok', 'Instagram'].map(platform => `
                    <button class="platform-select-btn group relative p-6 bg-[#0B0E14] border border-[#2A2F3A] rounded-2xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left space-y-4 overflow-hidden cursor-pointer" data-platform="${platform}">
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
                        <div class="select-indicator absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-[#2A2F3A] group-hover:border-amber-500/50 transition-all shadow-inner"></div>
                    </button>
                `).join('')}
            </div>
        </div>

        <div class="flex justify-between items-center bg-[#151921] border border-[#2A2F3A] p-6 rounded-3xl">
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
        <div id="deploy-modal-content" class="bg-[#151921] w-full max-w-lg p-8 rounded-3xl border border-[#2A2F3A] shadow-[0_30px_60px_rgba(0,0,0,0.6)] space-y-6">
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
                        <select id="tt-deploy-camp-id" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-cyan-500 text-xs font-bold text-white">
                            <option value="">-- CREATE NEW CAMPAIGN --</option>
                            <option value="CAMP_782394" ${config.campaign_id === 'CAMP_782394' ? 'selected' : ''}>Spring Launch 2026</option>
                            <option value="CAMP_991023" ${config.campaign_id === 'CAMP_991023' ? 'selected' : ''}>Lead Gen Global</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Budget Mode</label>
                            <select id="tt-deploy-budget-mode" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-cyan-500 text-xs font-bold text-white">
                                <option value="BUDGET_MODE_DAILY" ${config.budget_mode === 'BUDGET_MODE_DAILY' ? 'selected' : ''}>Daily</option>
                                <option value="BUDGET_MODE_TOTAL" ${config.budget_mode === 'BUDGET_MODE_TOTAL' ? 'selected' : ''}>Lifetime</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Daily/Total Budget ($)</label>
                            <input type="number" id="tt-deploy-budget" value="${config.daily_budget}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-cyan-500 text-sm font-black text-white">
                        </div>
                    </div>
                </div>

                <!-- Group 2: Ad Group Controls -->
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-purple-400 uppercase tracking-widest border-b border-purple-500/20 pb-1">Ad Group Controls</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Placement</label>
                            <select id="tt-deploy-placement" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                                <option value="PLACEMENT_TIKTOK" ${config.placement === 'PLACEMENT_TIKTOK' ? 'selected' : ''}>TikTok Only</option>
                                <option value="PLACEMENT_PANGLE" ${config.placement === 'PLACEMENT_PANGLE' ? 'selected' : ''}>Pangle Network</option>
                                <option value="PLACEMENT_ALL" ${config.placement === 'PLACEMENT_ALL' ? 'selected' : ''}>Automatic</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Pacing Mode</label>
                            <select id="tt-deploy-pacing" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                                <option value="PACING_MODE_SMOOTH" ${config.pacing === 'PACING_MODE_SMOOTH' ? 'selected' : ''}>Standard (Smooth)</option>
                                <option value="PACING_MODE_FAST" ${config.pacing === 'PACING_MODE_FAST' ? 'selected' : ''}>Accelerated</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Bid Type</label>
                            <select id="tt-deploy-bid-type" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                                <option value="BID_TYPE_COST_CAP" ${config.bid_type === 'BID_TYPE_COST_CAP' ? 'selected' : ''}>Cost Cap</option>
                                <option value="BID_TYPE_LOWEST_COST" ${config.bid_type === 'BID_TYPE_LOWEST_COST' ? 'selected' : ''}>Lowest Cost</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Target Bid ($)</label>
                            <input type="number" id="tt-deploy-bid" value="${config.bid}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-sm font-black text-white">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Start Date</label>
                            <input type="date" id="tt-deploy-start" value="${config.schedule_start}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">End Date</label>
                            <input type="date" id="tt-deploy-end" value="${config.schedule_end}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500 text-[11px] font-bold text-white">
                        </div>
                    </div>
                </div>

                <!-- Group 3: Creative Defaults -->
                <div class="space-y-4">
                    <h4 class="text-[10px] font-bold text-amber-400 uppercase tracking-widest border-b border-amber-500/20 pb-1">Creative Defaults</h4>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Custom Ad Name (Optional)</label>
                        <input type="text" id="tt-deploy-ad-name" value="${config.custom_ad_name}" placeholder="AI_Campaign_Batch_1" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Call To Action</label>
                            <select id="tt-deploy-cta" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-amber-500 text-[11px] font-bold text-white">
                                <option value="LEARN_MORE" ${config.cta === 'LEARN_MORE' ? 'selected' : ''}>Learn More</option>
                                <option value="SHOP_NOW" ${config.cta === 'SHOP_NOW' ? 'selected' : ''}>Shop Now</option>
                                <option value="SIGN_UP" ${config.cta === 'SIGN_UP' ? 'selected' : ''}>Sign Up</option>
                                <option value="BOOK_NOW" ${config.cta === 'BOOK_NOW' ? 'selected' : ''}>Book Now</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Ad Status</label>
                            <select id="tt-deploy-status" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-amber-500 text-[11px] font-bold text-white">
                                <option value="ENABLE" ${config.status === 'ENABLE' ? 'selected' : ''}>Active (Enable)</option>
                                <option value="DISABLE" ${config.status === 'DISABLE' ? 'selected' : ''}>Paused (Disable)</option>
                            </select>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Target Interests (Tags/Keywords)</label>
                        <input type="text" id="tt-deploy-interests" value="${config.interests}" placeholder="Fashion, Technology, Gaming..." class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Landing URL</label>
                        <div class="flex gap-2">
                            <input type="text" id="tt-deploy-url" value="${config.landing_url}" placeholder="https://..." class="flex-1 bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-white">
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
                            <select id="tt-deploy-country" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-emerald-500 text-[11px] font-bold text-white">
                                <option value="US" ${config.country === 'US' ? 'selected' : ''}>United States</option>
                                <option value="GB" ${config.country === 'GB' ? 'selected' : ''}>United Kingdom</option>
                                <option value="BD" ${config.country === 'BD' ? 'selected' : ''}>Bangladesh</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Language</label>
                            <select id="tt-deploy-language" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-emerald-500 text-[11px] font-bold text-white">
                                <option value="en" ${config.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${config.language === 'es' ? 'selected' : ''}>Spanish</option>
                                <option value="fr" ${config.language === 'fr' ? 'selected' : ''}>French</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <label class="text-[8px] font-black text-gray-500 uppercase">Specific Area (Optional)</label>
                        <div class="w-full bg-[#0B0E14] border border-dashed border-[#2A2F3A] p-4 rounded-xl flex flex-col items-center justify-center space-y-2 group hover:border-emerald-500/50 transition-all cursor-pointer">
                            <span class="text-xl">🗺️</span>
                            <span id="map-select-label" class="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-emerald-400">Select from Maps</span>
                            <input type="hidden" id="tt-deploy-area" value="${config.area}">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Age Range</label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="tt-deploy-age-min" value="${config.ageMin}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-emerald-500 text-sm font-black text-white text-center">
                                <span class="text-gray-600 text-[10px] font-bold">to</span>
                                <input type="number" id="tt-deploy-age-max" value="${config.ageMax}" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-emerald-500 text-sm font-black text-white text-center">
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[8px] font-black text-gray-500 uppercase">Gender</label>
                            <select id="tt-deploy-gender" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-emerald-500 text-[11px] font-bold text-white">
                                <option value="GENDER_ANY" ${config.gender === 'GENDER_ANY' ? 'selected' : ''}>All</option>
                                <option value="GENDER_MALE" ${config.gender === 'GENDER_MALE' ? 'selected' : ''}>Male</option>
                                <option value="GENDER_FEMALE" ${config.gender === 'GENDER_FEMALE' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-[#2A2F3A]">
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

    // 1. TikTok Payload Inspection (Step 39 Requirement)
    if (selectedPlatforms.has('TikTok')) {
      const sampleAsset = assets[0]
      const previewPayload = await deployToTikTok(sampleAsset, API_BASE, state, true)

      modalContent.innerHTML = `
        <div class="flex flex-col space-y-1 mb-4">
            <h3 class="text-2xl font-black uppercase italic tracking-tighter text-amber-500">Payload Inspection 🔍</h3>
            <p class="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Verify the TikTok API data structure before final dispatch.</p>
        </div>

        <div class="bg-black/60 rounded-2xl p-4 border border-white/5 overflow-hidden">
            <div class="flex items-center justify-between mb-2">
                <span class="text-[9px] font-black text-gray-500 uppercase">JSON Manifest (${sampleAsset.id.slice(0, 8)})</span>
                <span class="text-[8px] px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded uppercase font-bold border border-amber-500/20">Preview Mode</span>
            </div>
            <pre class="text-[10px] text-cyan-400 font-mono h-[40vh] overflow-y-auto custom-scrollbar leading-relaxed">
${JSON.stringify(previewPayload, null, 2)}
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
            await fetch(`${API_BASE}/assets/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: asset.id })
            })
          } catch (err) {
            console.warn(`Library archive failed for ${asset.id}, continuing...`)
          }

          // 2. Deploy to TikTok if selected
          if (selectedPlatforms.has('TikTok')) {
            try {
              await deployToTikTok(asset, API_BASE, state)
            } catch (err) {
              console.error(`TikTok deployment failed for ${asset.id}`)
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

function renderNotificationsScreen() {
  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-4">
        <h2 class="text-2xl font-black uppercase italic">Alert Center</h2>
        <div class="p-4 bg-[#151921] rounded-xl border-l-4 border-rose-500 text-sm">
            <p class="font-bold">Budget limit exceeded for Active Campaign</p>
        </div>
        <div class="p-4 bg-[#151921] rounded-xl border-l-4 border-cyan-500 text-sm">
            <p class="font-bold">New Creative assets generated by AI</p>
        </div>
    </div>
  `
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
  try {
    const res = await fetch(`${API_BASE}/guidelines`)
    if (res.ok) {
      const data = await res.json()
      // Deep merge or replacement
      state.marketingData.brandGuidelines = {
        ...state.marketingData.brandGuidelines,
        ...data
      }
      console.log('✓ Guidelines loaded from server storage.')
    } else {
      console.log('ℹ No existing guidelines file found on server. Starting fresh.')
    }

    // Load CMO Queue
    const cmoRes = await fetch(`${API_BASE}/cmo/queue`)
    if (cmoRes.ok) {
      const cmoData = await cmoRes.json()
      state.marketingData.cmoQueue = cmoData || []
      console.log(`✓ Loaded ${state.marketingData.cmoQueue.length} pending items for CMO.`)
    }

    // Load PPC Queue
    const ppcRes = await fetch(`${API_BASE}/ppc/queue`)
    if (ppcRes.ok) {
      const ppcData = await ppcRes.json()
      state.marketingData.ppcQueue = ppcData || []
      console.log(`✓ Loaded ${state.marketingData.ppcQueue.length} approved items for PPC.`)
    }
  } catch (e) {
    console.warn('⚠ Backend storage service offline. Using local session memory only.')
  }

  switchRole('Expert')
}

initApp()
