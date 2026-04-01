# Task: User-Level Permission Management in Role Management Screen

## Feature Summary
Add a user selector dropdown/combobox to the Role Management screen. When a user is selected, display a screen-permission matrix (same style as current role matrix) for that specific user. Admin sees only their company's users; Super Admin sees all users with company names. Permissions are saved per-user independently of their role.

---

## Architecture Decision
Currently, permissions are **role-based** only (`RoleScreen` table: role → screens).
This feature adds **user-level permission overrides** via a new `UserScreen` table (user → screens).
These are direct per-user screen grants, separate from the role's permissions.

---

## Task List

### BACKEND

#### Task B-1: Add `UserScreen` model in `backend/Models.cs`
- Add a new class `UserScreen` with fields: `UserId` (int), `ScreenId` (int), `CompanyId` (int?), `GrantedBy` (int?), `GrantedAt` (DateTime)
- Add composite key configuration `[UserId, ScreenId]`
- Add navigation properties to `User`, `Screen`, `Company`

#### Task B-2: Register `UserScreen` in `AppDbContext`
- Add `public DbSet<UserScreen> UserScreens { get; set; }` to `AppDbContext`
- Configure composite primary key in `OnModelCreating` (same pattern as `RoleScreen`)

#### Task B-3: Add `GET /api/rbac/user-permissions/{userId}` endpoint in `Program.cs`
- Returns list of screen IDs granted to that specific user
- Guard: non-super-admin can only query users from their own company

#### Task B-4: Add `POST /api/rbac/user-permissions` endpoint in `Program.cs`
- Accepts `{ userId: int, screenIds: int[] }`
- Replaces all existing `UserScreen` rows for that user, then inserts new ones
- Guard: non-super-admin cannot save permissions for users outside their company
- Guard: non-super-admin cannot grant super-admin-only screens (`GlobalDashboard`, `CompanyManagement`, `SystemConfig`, `AuditLog`)

#### Task B-5: Update `GET /api/rbac/users` to exclude Super Admin users for non-super-admin callers
- Already filters by companyId; also exclude users where `IsSuperAdmin = true` when caller is not super admin
- Return `companyName` in the response for super admin view (already included via `Company` navigation property)

---

### FRONTEND

#### Task F-1: Add "User Permissions" section UI to `renderRoleManagementScreen()` in `main.js`
- Add a new section below (or as a tab alongside) the existing role creation + role matrix
- Section header: "User Permission Overrides" with a user icon
- Contains a `<select>` combobox (`id="user-permission-selector"`) with placeholder "Select a user..."
- Below the combobox: a container `id="user-perms-container"` (hidden until user selected)

#### Task F-2: Add `loadUsersForSelector()` function in `main.js`
- Calls `GET /api/rbac/users`
- For **admin**: renders options as `Username — Role Name` (company-filtered by backend)
- For **super admin**: renders options as `Username (Company Name) — Role Name`
- Excludes super admin users from the list (filter `u.isSuperAdmin === true`)
- Populates the `#user-permission-selector` dropdown

#### Task F-3: Add `loadUserPermissionsMatrix(userId)` function in `main.js`
- Called when user selects an option in the combobox (`onchange`)
- Fetches `GET /api/rbac/screens` (already filters super-admin screens for non-super-admins)
- Fetches `GET /api/rbac/user-permissions/{userId}`
- Renders the same card+grid style as the role matrix inside `#user-perms-container`
- Shows checked screens based on current user permissions
- Uses `data-user` attribute on checkboxes (instead of `data-role`) to distinguish from role checkboxes
- Shows a "Save User Permissions ✅" button

#### Task F-4: Wire up Save button for user permissions
- On click: collect all checked `input[data-user="{userId}"]` screen IDs
- POST to `/api/rbac/user-permissions` with `{ userId, screenIds }`
- Show success/error notification

#### Task F-5: Call `loadUsersForSelector()` at the end of `renderRoleManagementScreen()`
- Ensures dropdown is populated whenever the screen is opened

---

## File Changes Summary

| File | Change |
|---|---|
| `backend/Models.cs` | Add `UserScreen` class (Task B-1) |
| `backend/AppDbContext.cs` | Add `DbSet<UserScreen>` + composite key config (Task B-2) |
| `backend/Program.cs` | Add GET + POST `/api/rbac/user-permissions` endpoints (B-3, B-4, B-5) |
| `frontend/src/main.js` | Update `renderRoleManagementScreen`, add `loadUsersForSelector`, add `loadUserPermissionsMatrix` (F-1 to F-5) |

---

## Notes
- No DB migration files needed — the app uses EF Core `EnsureCreated` / auto-migration on startup (verify before implementing B-2)
- The new `UserScreen` table will be created automatically on next app start
- Super admin users (`IsSuperAdmin = true`) should never appear in the user selector
- The existing role-based matrix is **not changed**, only a new section is added below it
