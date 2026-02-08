import './style.css'

const API_BASE = 'http://localhost:5243/api'

// --- State Management ---
const state = {
  activeRole: 'Expert',
  activeScreen: 'Objective',
  marketingData: {
    objective: null,
    targeting: [],
    goal: '',
    probeAnswers: Array(10).fill(''),
    strategyStep: 1, // 1: Research, 2: Probe Part 1, 3: Probe Part 2
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
    }
  }
}

// --- Role Definitions ---
const roles = {
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
      { id: 'Monitoring', label: 'AI Monitoring', icon: '📊' },
      { id: 'Budget', label: 'Budget Overview', icon: '💰' },
    ]
  },
  Admin: {
    displayName: 'Platform Admin',
    icon: 'A',
    themeColor: 'purple',
    screens: [
      { id: 'Config', label: 'Platform Config', icon: '⚙️' },
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
      { id: 'Notifications', label: 'Notifications', icon: '🔔' },
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
  navLinks.innerHTML = currentRole.screens.map(screen => `
    <button class="nav-btn w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${state.activeScreen === screen.id ? `bg-${currentRole.themeColor}-500/20 text-${currentRole.themeColor}-400 border border-${currentRole.themeColor}-500/30 font-bold` : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}" data-screen="${screen.id}">
      <span class="text-lg">${screen.icon}</span>
      <span class="text-sm">${screen.label}</span>
    </button>
  `).join('')

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
    // Admin Screens
    case 'Config':
      renderConfigScreen()
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
  const probeQuestions = [
    "What is the primary visual vibe you want to convey?",
    "Who is the main competitor we should differentiate from?",
    "What is the single most important call to action?",
    "Should we focus on product features or lifestyle benefits?",
    "Which emotion should the ad evoke primarily?",
    "What is the price point range for this campaign?",
    "Are there any specific color palettes to avoid?",
    "What is the ideal customer's primary frustration?",
    "How long do you want the initial test phase to run?",
    "What is the scale of the target audience (Local vs Global)?"
  ]

  const step = state.marketingData.strategyStep

  contentContainer.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
        <!-- Progress Steps -->
        <div class="flex items-center justify-center space-x-3 mb-6">
            <div class="flex items-center space-x-1.5 ${step >= 1 ? 'opacity-100' : 'opacity-30'}">
                <span class="w-5 h-5 rounded-full ${step >= 1 ? 'bg-rose-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">1</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-white">Baseline</span>
            </div>
            <div class="w-6 h-[1px] ${step > 1 ? 'bg-rose-500' : 'bg-gray-800'}"></div>
            <div class="flex items-center space-x-1.5 ${step >= 2 ? 'opacity-100' : 'opacity-30'}">
                <span class="w-5 h-5 rounded-full ${step >= 2 ? 'bg-cyan-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">2</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-white">Probe 1</span>
            </div>
            <div class="w-6 h-[1px] ${step > 2 ? 'bg-cyan-500' : 'bg-gray-800'}"></div>
            <div class="flex items-center space-x-1.5 ${step >= 3 ? 'opacity-100' : 'opacity-30'}">
                <span class="w-5 h-5 rounded-full ${step >= 3 ? 'bg-purple-500' : 'bg-gray-800'} text-[9px] flex items-center justify-center font-bold">3</span>
                <span class="text-[9px] font-black uppercase tracking-widest text-white">Final</span>
            </div>
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
                
                <button id="btn-strategy-1" class="w-full py-4 bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-400 hover:to-purple-500 text-white font-black rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 text-base uppercase tracking-widest">
                    ANALYZE STRATEGY <span class="text-lg">✨</span>
                </button>
            </div>
        </div>

        <!-- Section 2: Probe Part 1 (Q1-5) -->
        <div id="section-probe-1" class="${step === 2 ? 'block' : 'hidden'} space-y-6">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-cyan-400">Probe <span class="text-white">Part 1</span></h2>
                <p class="text-gray-500 text-xs font-medium italic">Visual & competitive benchmarks.</p>
            </div>

            <div class="bg-[#151921] border border-[#2A2F3A] rounded-[30px] p-8 shadow-2xl space-y-8">
                ${probeQuestions.slice(0, 5).map((q, i) => `
                    <div class="space-y-3">
                        <label class="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest">Parameter 0${i + 1}</label>
                        <h3 class="text-base font-bold text-gray-200">${q}</h3>
                        <input type="text" class="probe-hub-input w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-cyan-500/50 transition-all text-white text-sm" value="${state.marketingData.probeAnswers[i]}" data-idx="${i}">
                    </div>
                `).join('')}
                
                <button id="btn-strategy-2" class="w-full py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black rounded-xl hover:from-cyan-500 hover:to-indigo-500 shadow-xl uppercase tracking-widest flex items-center justify-center gap-2 text-base">
                    ANALYZE STRATEGY <span class="text-lg">🚀</span>
                </button>
            </div>
        </div>

        <!-- Section 3: Probe Part 2 (Q6-10) -->
        <div id="section-probe-2" class="${step === 3 ? 'block' : 'hidden'} space-y-6">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-purple-400">Final <span class="text-white">Diagnostics</span></h2>
                <p class="text-gray-500 text-xs font-medium italic">Price points & audience frustration.</p>
            </div>

            <div class="bg-[#151921] border border-[#2A2F3A] rounded-[30px] p-8 shadow-2xl space-y-8">
                ${probeQuestions.slice(5, 10).map((q, i) => `
                    <div class="space-y-3">
                        <label class="text-[9px] font-black text-purple-500/50 uppercase tracking-widest">Parameter 0${i + 6}</label>
                        <h3 class="text-base font-bold text-gray-200">${q}</h3>
                        <input type="text" class="probe-hub-input w-full bg-[#0B0E14] border border-[#2A2F3A] p-4 rounded-xl outline-none focus:border-purple-500/50 transition-all text-white text-sm" value="${state.marketingData.probeAnswers[i + 5]}" data-idx="${i + 5}">
                    </div>
                `).join('')}
                
                <button id="btn-strategy-3" class="w-full py-5 bg-white text-black font-black rounded-xl hover:bg-cyan-400 transition-all shadow-2xl uppercase tracking-widest flex items-center justify-center gap-2 text-base">
                    FINALIZE STEPS ⚡
                </button>
            </div>
        </div>
    </div>
  `

  // Event Handlers
  if (document.getElementById('hub-goal')) {
    document.getElementById('hub-goal').oninput = (e) => state.marketingData.goal = e.target.value
  }

  document.querySelectorAll('.probe-hub-input').forEach(input => {
    input.oninput = (e) => {
      state.marketingData.probeAnswers[parseInt(input.dataset.idx)] = e.target.value
    }
  })

  if (document.getElementById('btn-strategy-1')) {
    document.getElementById('btn-strategy-1').onclick = () => {
      state.marketingData.strategyStep = 2
      renderStrategyHub()
    }
  }

  if (document.getElementById('btn-strategy-2')) {
    document.getElementById('btn-strategy-2').onclick = () => {
      state.marketingData.strategyStep = 3
      renderStrategyHub()
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
  const pr = state.marketingData.probeAnswers

  const consolidatedBrief = `[BRAND] ${bg.brandLabel || 'Not Set'}
[TONE] ${bg.tone} | [LANG] ${bg.language}
[IDENTITY] ${bg.description || 'No description provided.'}

[AUDIENCE] ${tg.length} target segments prioritized.
${tg.map(t => `- ${t.country} (${t.ageMin}-${t.ageMax}, ${t.gender})`).join('\n')}

[STRATEGY INSIGHTS]
- Objective: ${state.marketingData.objective || 'Not Set'}
- Primary Goal: ${state.marketingData.goal || 'Not Set'}
${pr.filter(a => a.trim()).map((a, i) => `- Insight #${i + 1}: ${a}`).join('\n')}`

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

  document.getElementById('proceed-to-studio').onclick = () => {
    state.marketingData.goal = document.getElementById('config-goal').value
    switchScreen('Studio')
  }
}

function renderStudioScreen() {
  const variations = [
    { id: 1, img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400', title: 'Minimal Elegance' },
    { id: 2, img: 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?auto=format&fit=crop&q=80&w=400', title: 'Neon Kinetic' },
    { id: 3, img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400', title: 'Future Bold' },
    { id: 4, img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=400', title: 'Abstract Flow' },
    { id: 5, img: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&q=80&w=400', title: 'Dark Premium' }
  ]

  contentContainer.innerHTML = `
    <div class="space-y-6">
        <div class="flex justify-between items-end">
            <div>
                <h2 class="text-3xl font-black uppercase tracking-tighter">Creative AI Studio</h2>
                <p class="text-gray-500 text-sm">AI-generated variations tailored to your campaign strategy</p>
            </div>
            <button id="approval-btn" class="px-6 py-2.5 bg-cyan-600 text-white font-bold rounded-lg animate-pulse hover:animate-none hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all uppercase tracking-widest text-xs">
                Approval
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            ${variations.map(v => `
                <div class="group bg-[#151921] border border-[#2A2F3A] rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all">
                    <div class="aspect-square relative overflow-hidden">
                        <img src="${v.img}" alt="${v.title}" class="w-full h-full object-cover group-hover:scale-110 transition-all duration-700">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <span class="text-[10px] font-bold text-cyan-400 uppercase">${v.title}</span>
                        </div>
                    </div>
                    <div class="p-3 space-y-2">
                        <button class="w-full py-1.5 bg-gray-800 hover:bg-gray-700 text-[10px] font-bold rounded-md transition-all">EDIT ASSET</button>
                        <button class="w-full py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-[10px] font-bold rounded-md transition-all">APPROVE</button>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
  `

  document.getElementById('approval-btn').onclick = () => switchScreen('Monitoring')
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
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${['Facebook', 'Instagram', 'YouTube'].map(p => `
                <button class="platform-btn group bg-[#151921] border border-[#2A2F3A] p-6 rounded-2xl hover:border-purple-500 hover:bg-purple-500/5 transition-all flex flex-col items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        ${p === 'Facebook' ? 'f' : p === 'Instagram' ? '📸' : '▶️'}
                    </div>
                    <h3 class="font-bold text-lg">${p}</h3>
                </button>
            `).join('')}
        </div>
    </div>
    <div id="modal-overlay" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center hidden">
        <div class="bg-[#151921] w-full max-w-md p-8 rounded-3xl border border-[#2A2F3A] space-y-6">
            <h3 class="text-2xl font-bold" id="modal-title">Connect Platform</h3>
            <div class="space-y-4">
                <input type="text" placeholder="Account Name" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500">
                <input type="text" placeholder="User ID" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500">
                <input type="password" placeholder="Password" class="w-full bg-[#0B0E14] border border-[#2A2F3A] p-3 rounded-xl outline-none focus:border-purple-500">
            </div>
            <button id="modal-save" class="w-full py-3 bg-purple-600 rounded-xl font-bold">SAVE CREDENTIALS</button>
        </div>
    </div>
  `
  const modal = document.getElementById('modal-overlay')
  document.querySelectorAll('.platform-btn').forEach(btn => btn.onclick = () => {
    document.getElementById('modal-title').innerText = `Connect ${btn.querySelector('h3').innerText}`
    modal.classList.remove('hidden')
  })
  document.getElementById('modal-save').onclick = () => modal.classList.add('hidden')
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden') }
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
          alert('SUCCESS: Brand guidelines saved to server file.')
        } else {
          const err = await res.text()
          alert('ERROR: Could not save guidelines. ' + err)
        }
      })
      .catch(err => alert('NETWORK ERROR: ' + err.message))
  }
}

function renderAssetsScreen() {
  contentContainer.innerHTML = `
    <div class="space-y-8">
        <h2 class="text-3xl font-black uppercase italic">Assets Library</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            ${Array.from({ length: 12 }).map((_, i) => `
                <div class="bg-[#151921] border border-[#2A2F3A] rounded-2xl aspect-square overflow-hidden group">
                    <img src="https://picsum.photos/seed/${i + 300}/200/200" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all">
                </div>
            `).join('')}
        </div>
    </div>
  `
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
  contentContainer.innerHTML = `
    <div class="space-y-6">
        <h2 class="text-3xl font-black uppercase italic">Pending Sign-off</h2>
        ${[1, 2, 3].map(i => `
            <div class="bg-[#151921] p-5 rounded-2xl border border-[#2A2F3A] flex items-center gap-6">
                <div class="w-20 h-20 bg-gray-800 rounded-xl overflow-hidden">
                    <img src="https://picsum.photos/seed/${i + 300}/200/200" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <h4 class="text-lg font-bold">Variation CMO-${i}</h4>
                    <p class="text-[10px] text-gray-500">Awaiting approval for deployment.</p>
                </div>
                <button class="px-6 py-2 bg-amber-600 rounded-lg font-bold text-xs">APPROVE</button>
            </div>
        `).join('')}
    </div>
  `
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
  } catch (e) {
    console.warn('⚠ Backend storage service offline. Using local session memory only.')
  }

  switchRole('Expert')
}

initApp()
