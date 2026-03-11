
// --- Role Management (Admin) ---
async function renderRoleManagementScreen() {
    contentContainer.innerHTML = `
        <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div class="text-center space-y-2">
                <h2 class="text-3xl font-black uppercase tracking-tighter text-purple-400">Role & <span class="text-white">Permission Hub</span></h2>
                <p class="text-gray-500 text-sm font-medium italic">Define architectural roles and map screen-level access protocols.</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <!-- Role Creation Form -->
                <div class="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[30px] shadow-2xl space-y-6">
                    <h3 class="text-lg font-black uppercase tracking-widest text-white border-b border-white/5 pb-3 flex items-center gap-2">
                        <span class="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                        New Role
                    </h3>
                    
                    <form id="role-creation-form" class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Role Identifier</label>
                            <input type="text" id="role-name-input" required class="w-full bg-[var(--bg-color)] border border-[var(--border-color)] p-3 rounded-xl outline-none focus:border-purple-500 text-white text-sm" placeholder="e.g. Compliance Officer">
                        </div>
                        <button type="submit" id="btn-create-role" class="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-all shadow-xl uppercase tracking-widest text-[9px]">
                           Initialize Role 💾
                        </button>
                    </form>
                </div>

                <!-- Existing Roles Matrix -->
                <div class="lg:col-span-3 space-y-6" id="roles-matrix-container">
                    <!-- Loaded dynamically -->
                    <div class="flex items-center justify-center py-24 bg-white/5 rounded-[30px] border border-dashed border-white/10">
                        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                    </div>
                </div>
            </div>
        </div>
    `

    loadRolesMatrix()

    // Form handler
    document.getElementById('role-creation-form').onsubmit = async (e) => {
        e.preventDefault()
        const name = document.getElementById('role-name-input').value
        const btn = document.getElementById('btn-create-role')
        btn.disabled = true

        try {
            const res = await fetch(`${API_BASE}/rbac/roles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            })
            if (res.ok) {
                showNotification(`ROLE CREATED: Architectural identity '${name}' is now active.`, "success")
                document.getElementById('role-creation-form').reset()
                loadRolesMatrix()
            } else {
                const err = await res.json()
                showNotification(err.message || "Failed to create role", "error")
            }
        } catch (e) {
            showNotification("Protocol Error: Could not reach backend server.", "error")
        } finally {
            btn.disabled = false
        }
    }
}

async function loadRolesMatrix() {
    const container = document.getElementById('roles-matrix-container')

    try {
        const [rolesRes, screensRes] = await Promise.all([
            fetch(`${API_BASE}/rbac/roles`),
            fetch(`${API_BASE}/rbac/screens`)
        ])

        const roles = await rolesRes.json()
        const screens = await screensRes.json()

        container.innerHTML = roles.map(role => {
            const isSystemRole = ['Admin', 'CMO', 'PPC', 'Expert'].includes(role.name)

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
                                <p class="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ID: RL-${role.id.toString().padStart(4, '0')}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="save-perms-btn px-4 py-2 bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all" data-id="${role.id}">Save Sync ✅</button>
                            ${!isSystemRole ? `<button class="delete-role-btn px-4 py-2 bg-rose-900/30 text-rose-500 border border-rose-500/20 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all" data-id="${role.id}" data-name="${role.name}">Delete 🗑️</button>` : ''}
                        </div>
                    </div>

                    <!-- Screen Perms Grid -->
                    <div class="p-6">
                        <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Authorized Ecosystem Fragments</p>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="perms-grid-${role.id}">
                            ${screens.map(screen => `
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

        // Fill initial checkbox values
        for (const role of roles) {
            const res = await fetch(`${API_BASE}/rbac/role-permissions/${role.id}`)
            if (res.ok) {
                const grantedScreenIds = await res.json()
                const checkboxes = document.querySelectorAll(`input[data-role="${role.id}"]`)
                checkboxes.forEach(cb => {
                    if (grantedScreenIds.includes(parseInt(cb.value))) cb.checked = true
                })
            }
        }

        // Add Handlers
        document.querySelectorAll('.save-perms-btn').forEach(btn => {
            btn.onclick = async () => {
                const roleId = parseInt(btn.dataset.id)
                const checked = Array.from(document.querySelectorAll(`input[data-role="${roleId}"]:checked`)).map(cb => parseInt(cb.value))

                btn.disabled = true
                btn.innerText = "SYNCING..."

                try {
                    const res = await fetch(`${API_BASE}/rbac/role-permissions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roleId, screenIds: checked })
                    })
                    if (res.ok) {
                        showNotification("SYNC SUCCESS: Interface permissions updated globally.", "success")
                    }
                } catch (e) {
                    showNotification("Sync Protocol Failure.", "error")
                } finally {
                    btn.disabled = false
                    btn.innerText = "Save Sync ✅"
                }
            }
        })

        document.querySelectorAll('.delete-role-btn').forEach(btn => {
            btn.onclick = async () => {
                const roleId = btn.dataset.id
                const name = btn.dataset.name
                if (!confirm(`Confirm total decommissioning of the '${name}' identity protocol?`)) return

                try {
                    const res = await fetch(`${API_BASE}/rbac/roles/${roleId}`, { method: 'DELETE' })
                    if (res.ok) {
                        showNotification(`DECOMMISSIONED: '${name}' role and its logic are deleted.`, "success")
                        loadRolesMatrix()
                    } else {
                        const err = await res.json()
                        showNotification(err.message || "Failed to delete role", "error")
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
