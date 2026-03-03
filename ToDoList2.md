# Strategy Hub Development Tasks

## Preparation & Configuration

- [ ] **Infrastructure: Gemini API Setup**
  - [x] Create `appsettings.json` placeholder for Gemini API Key.
  - [ ] Obtain a real Google Gemini API Key and update `backend/appsettings.json`.

## Research & Strategy Workflow (Gemini Integration)

- [ ] **Step 1: Capture User Input**
  - Implement logic to grab the text from the "GENERATION BRIEF" box when the "ANALYZE STRATEGY" button is clicked.

- [ ] **Step 2: Generate Level 1 Questions (Conceptual Insight)**
  - Send the brief to Gemini with a refined prompt to generate 5 **conceptual** follow-up questions.
  - Create a new UI screen to display these 5 questions.
  - **Add a textbox for each question to capture user answers.**

- [ ] **Step 3: Navigation & Interaction (Strategy Hub)**
  - Implement **Next** and **Previous** buttons for all 3 sections.
  
- [ ] **Step 4: Generate Level 2 Questions (Deep Diagnostics)**
  - Send original brief + Level 1 questions **and user answers** back to Gemini.
  - Prompt Gemini to generate 5 advanced/psychological questions.

- [ ] **Step 5: Display Level 2 Questions**
  - Show the final set of 5 questions with "Previous" button support.
  - **Add a textbox for each question to capture final user input.**

- [x] **Step 6: Finalize & Consolidate**
  - When the "FINALIZE STEPS" button is clicked, append all Level 1 and Level 2 questions and answers to the "Generation brief" box on the Creative Config screen.
  - Ensure all previous brief data (Brand, Tone, Audience, etc.) is preserved while adding the new diagnostic insights.

- [ ] **Step 7: UI/UX Polish**
  - Ensure smooth transitions and loading states (spinners/shimmer effects).

## Creative AI Studio Tasks

- [x] **Step 8: Asset Management**
  - Rename "EDIT ASSET" button to "DELETE".
  - Implement functionality to delete the asset card when the "DELETE" button is clicked.
  - **Add backend endpoint to delete the actual file from `backend/Assets/` and call it from the frontend.** [x]

## Debugging & Reliability

- [x] **Step 9: Improve Gemini reliability**
  - Add robust error handling to backend Gemini calls to prevent "stuck" UI on 429 or API errors.
  - Implement JSON response parsing fixes for more reliable data extraction.

## System Operations

- [x] **Step 10: Restart System**
  - Restart both the .NET Backend and the Vite Frontend to ensure all latest changes are active.

## Analysis Button Stalling Fix

- [x] **Step 11: Investigate "Analysing..." Stall**
  - [x] Analyze backend logs (Result: Found `RESOURCE_EXHAUSTED` 429 error).
  - [x] Update frontend `fetch` logic to check for `response.ok` before proceeding to Step 2.
  - [x] Add explicit error alerts that show the specific reason (e.g., "Quota Exceeded") to the user.
  - [x] Implement a **Smart Simulation Fallback**: If Gemini returns a 429 error, automatically switch to high-quality simulated questions so the user experience isn't broken.

## Permanent Asset Storage

- [x] **Step 12: Implement "Assets Library" Long-term Storage**
  - Create a new folder named `Assets Library` in the `backend` directory.
  - Implement a backend endpoint to copy an asset from `Assets` to `Assets Library`.
  - Update the "Approve" button logic on the "Pending Sign-off" screen to trigger this copy action, ensuring approved assets are permanently stored while keeping existing logic intact.

## Assets Library View Fix

- [x] **Step 13: Connect Admin "Assets Library" to physical storage**
  - Update Backend to serve files from `Assets Library` folder via `/library` path.
  - Implement `/api/assets-library` endpoint to list all permanent assets.
  - Update Frontend `renderAssetsScreen` to fetch from the backend and display real images/videos instead of placeholders.

## Assets Library Visual Fixes

- [x] **Step 14: Fix broken images in Assets Library**
  - Update `renderAssetsScreen` in `main.js` to use absolute URLs (prepend Backend URL) so assets load correctly from the other port.
  - Ensure filenames with spaces are handled or avoided during the copy process.

## CMO Dashboard Enhancements

- [ ] **Step 15: Add "POST" button to Approvals screen**
  - Add a large action button named "POST" next to the "Pending Sign-off" title on the CMO-Approvals screen.

## Ad Deployment & Platform Selection

- [x] **Step 16: Document & Transition "Approve" Logic**
  - Document the current backend actions (Asset Library Copy + TikTok Deployment) triggered by the CMO "Approve" button.
  - Update the "Approve" button click handler to transition to a new platform selection screen instead of immediate deployment.

- [x] **Step 17: Create Platform Selection Screen**
  - Design a new screen with 4 platform selection buttons: Facebook, YouTube, TikTok, and Instagram/LinkedIn.
  - Add a large "POST" button at the bottom to finalize the deployment to selected platforms.

## Platform Selection Refinements

- [x] **Step 18: Fix Sidebar Navigation for Platform Selection**
  - Ensure clicking "Platform Selection" in the sidebar correctly renders the screen.
  - If no asset is selected, show a "Please select an asset from Ad Approvals" placeholder instead of redirecting.

## Advanced Deployment Logic

- [x] **Step 19: Modularize TikTok Deployment**
  - Create a separate JS file to manage the TikTok specific payload and deployment logic.
  - Integrate this modular logic into the "Platform Selection" screen so that selecting TikTok executes the correct backend call.

## UI/UX Polish & Notifications

- [x] **Step 20: Replace Alerts with Custom Modal**
  - Create a premium, centered modal for success/error messages.
  - UI: Black background, white text, sleek border.
  - Update `main.js` to use this custom modal instead of the default browser alerts.

## Gemini Resilience & Reliability

- [x] **Step 21: Fix Gemini 429 (Rate Limit) Errors**
  - Implement a retry mechanism with exponential backoff on the backend.
  - Optimize frontend to avoid redundant API calls.
  
- [x] **Step 22: Silent "Smart Fallback" UI**
  - Update the fallback logic to be silent and seamless. Show a subtle "Optimizing Logic..." indicator instead of a disruptive error modal when shifting to fallback questions.

- [x] **Step 23: Global Notification Standardization**
  - Audit the entire codebase (frontend/backend) to ensure EVERY user-facing message (success, error, warning) uses the new premium custom modal.
  - Remove all remaining `alert()` calls.

## Performance & Optimization

- [x] **Step 24: Fix Gemini Latency & Backend Architecture**
  - Current backend retry logic is too aggressive for Gemini's free-tier reset (50s delay), leading to perceived "slowness".
  - Refactor backend to use a singleton `HttpClient` and a more robust AI service layer.
  - Implement caching for common briefs/prompts to eliminate API calls for repetitive inputs.

- [x] **Step 25: Implement "Premium Wait" UI for AI Calls**
  - Re-design the loading state to show "AI Reasoning" steps (e.g., "Analyzing Brand DNA...", "Consulting Market Trends...") to make the wait feel premium and purposeful.
  - Ensure standardizing of async states across Strategy Hub, Creative Config, and Creative Studio.

## CMO Workflow & Persistence

- [x] **Step 26: CMO Pending State & Queue Persistence**
  - Assets in the CMO dashboard must remain in the "Pending Sign-off" state indefinitely until a final action (Approve or Reject) is taken.
  - Implement a backend endpoint (`/api/cmo/queue`) to save and load the `cmoQueue` so data isn't lost on page refresh.
  - Add logic to the "Reject" button in the CMO dashboard to allow removal of assets from the pending list.
  - Ensure the "Approvals" badge count updates dynamically based on the persistent queue state.
## CMO Bulk Selection & Deployment

- [x] **Step 27: Refactor Approve Button to Selection Toggle**
  - Update `renderApprovalsScreen` so the "APPROVE" button toggles a "selected" state for the asset instead of transitioning immediately.
  - Implement visual feedback (e.g., border change or checkmark) for selected assets.

- [x] **Step 28: Add Global "POST" Button**
  - Add a large, premium "POST" button at the bottom of the "Ad Approvals" screen.
  - The button should only be enabled when at least one asset is selected.

- [x] **Step 29: Bulk Transition to Platform Selection**
  - Update the "POST" button click handler to transition to the "Platform Selection" screen.
  - Modify `state` to support multiple `selectedAssets` and update the Platform Selection UI to handle bulk deployment.

## Platform Configuration Enhancements

- [x] **Step 30: Add TikTok to Social Ecosystem Page**
  - Update the "Platform Config" screen (renderConfigScreen) to include TikTok along with Facebook, Instagram, and YouTube.
  - Design a premium card for TikTok with its icon and "Connector Active" status.

## TikTok API Refactoring (Dual-Layer Deployment)

- [x] **Step 31: Implement Ad Group + Creative Orchestration**
  - Refactor `tiktokDeploy.js` to send both Ad Group and Ad Creative data in a single request.
  - Map dynamic data: `budget` from Matrix, `ad_text` from AI Brief, and `display_name` from Brand Guidelines.
  - Update Backend `Program.cs` with new C# records (`TikTokDeployRequest`, `TikTokCreativeRequest`) and enhance simulation logs.

- [x] **Step 37: Full Dispatch Parameter Synchronization**
  - Ensure `tiktokDeploy.js` reads `campaign_id`, `daily_budget`, `schedule`, and `bid` directly from the `TikTok Dispatch Config` state.
  - Implement a mapping for the `objective` to `billing_event` and `optimization_goal` (e.g., Reach -> CPM/REACH, Click -> CPC/CLICK, Sell -> OCPM/CONVERSIONS).
  - Update any remaining static parameters to be derived from the application state.

- [x] **Step 38: Advanced TikTok Parameterization (Placement, Pacing, CTA, etc.)**
  - Add UI controls to TikTok Dispatch Modal for: Placement (TikTok/Pangle), Budget Mode (Daily/Lifetime), Pacing (Smooth/Accelerated), Bid Type, and Status.
  - Include input fields for Custom Ad Name and Call To Action selection.
  - Map these new state variables in `tiktokDeploy.js` to ensure the final payload is fully dynamic.

- [x] **Step 39: Implement TikTok Payload Preview on Dispatch**
  - Update `deployToTikTok` to support a "Preview Mode" or simply return the generated payload.
  - Modify the `final-post-btn` handler in `renderDeploySelectionScreen` to show a dedicated "Payload Inspection" modal if TikTok is selected.
  - Ensure all dynamic parameters (budget, targeting, schedule, credentials) are visible in the preview.

- [ ] **Step 40: Comprehensive TikTok Optimization & Global Mapping**
  - Expand `countryMap` in `tiktokDeploy.js` to support all countries from the Marketing Suite.
  - Refactor `promotion_type`, `billing_event`, and `optimization_goal` to be explicitly selectable if needed, or refine the auto-mapping for all campaign objectives (Reach, Click, Video Views, etc.).
  - Implement a dynamic `ad_text` override in the Dispatch Modal for manual fine-tuning.
  - Ensure `pacing_mode` and `schedule_type` are correctly mapped to the TikTok API constants from the UI state.

- [x] **Step 32: Implement TikTok Config Modal in Social Ecosystem**
  - Update `renderConfigScreen` to support platform-specific modal fields.
  - Add fields for TikTok: `advertiser_id`, `access_token`, `pixel_id`, and `identity_id`.
  - Ensure these values are saved to the global state and persisted if possible.

## Dynamic Targeting & User Input Integration

- [x] **Step 33: Link Targeting UI and Payload Config**
  - Map `geo_locations` and `languages` directly from `state.marketingData.targeting` and `brandGuidelines`.
  - Expand the TikTok modal to include campaign-level inputs: `campaign_id` (dropdown), `daily_budget`, `schedule` (start/end), and `target_bid`.
  - Refactor `tiktokDeploy.js` to use these user-entered values from state.

- [x] **Step 34: Integrate TikTok Modal in Platform Selection Screen**
  - Add a "Modal Overlay" for configuration to `renderDeploySelectionScreen`.
  - Trigger the TikTok configuration modal (similar to the one in Config Screen) when the TikTok button is clicked.
  - Ensure any changes made in this screen update the same `platformConfig` state.

- [x] **Step 35: Decouple Credentials and Campaign Params**
  - Remove Campaign Parameters and Targeting Preview from the TikTok modal in `renderConfigScreen` (Social Ecosystem).
  - Ensure ONLY Business Credentials (Advertiser ID, Token, Pixel ID, Identity ID) remain in the Config Screen modal.
  - Deployment-specific params (Budget, Bid, Dates, Campaign ID) will stay in the `renderDeploySelectionScreen` modal.

- [x] **Step 36: Granular Targeting Bridge**
  - Map specific `ageMin/Max`, `gender`, and `country` from `state.marketingData.targeting` to TikTok API constants (e.g., `AGE_18_24`, `GENDER_MALE`).
  - Pass the first available targeting set from the Marketing Suite to the `deployToTikTok` function.

## PPC Specialist Workflow & Asset Management

- [ ] **Step 41: Implement "Approved Assets" for PPC Specialist**
  - Create a new screen `ApprovedAssets` exclusively for the **PPC Specialist** role.
  - Update the **CMO Dashboard** "Approve" logic: When an asset is approved, it should now be added to the PPC Specialist's "Approved Assets" queue.
  - Design the `ApprovedAssets` screen to display these items, allowing the PPC Specialist to manage/deploy them.

- [x] **Step 42: Refine PPC Specialist Navigation & Screens**
  - Remove "Campaign Objective" and "Target Audience" tabs/screens from the PPC Specialist role.
  - Reorder the sidebar navigation for PPC Specialist to:
    1. Approved Assets
    2. Platform Selection
    3. AI Monitoring
    4. Budget Overview

- [x] **Step 43: Remove Platform Selection from CMO Dashboard**
  - Remove the "Platform Selection" screen/tab from the `CMO` role definition in `main.js`.
  - Since deployment is now handled by the PPC Specialist, the CMO no longer needs access to this hub.

- [x] **Step 44: Add AI Monitoring and Budget Overview to CMO Dashboard**
  - Update the `CMO` role definition in `main.js` to include the following screens:
    1. `Monitoring` (AI Monitoring)
    2. `Budget` (Budget Overview)
  - This provides the CMO with comprehensive visibility into performance and expenditures.

- [x] **Step 45: Reorder Role Identities**
  - Reorder the roles in `main.js` and `index.html` to follow this sequence:
    1. Platform Admin
    2. CMO Dashboard
    3. PPC Specialist
    4. Marketing Expert

- [x] **Step 46: Remove Monitoring/Budget from Marketing Expert**
  - Remove the "AI Monitoring" and "Budget Overview" screens from the `Expert` role definition in `main.js`.
  - The Marketing Expert now focuses purely on creative strategy and asset generation.

- [x] **Step 47: Implement "Role Management" for Platform Admin**
  - Add a new screen/tab `RoleManagement` to the `Admin` role in `main.js`.
  - Design and implement the `renderRoleManagementScreen` function to allow the admin to manage user roles and permissions.

- [x] **Step 48: Integrate Granular Targeting into TikTok Dispatch**
  - Update `state.marketingData.platformConfig.tiktok` to include: `country`, `language`, `area`, `ageMin`, `ageMax`, and `gender`.
  - Add UI controls for these parameters in the TikTok Dispatch Configuration modal.
  - Map these parameters in `tiktokDeploy.js` to the corresponding TikTok API fields (`location_ids`, `languages`, `age_groups`, `gender`).

- [x] **Step 49: Integrate Landing URL into TikTok Dispatch**
  - Add `landing_url` to `state.marketingData.platformConfig.tiktok`.
  - Add URL input field to the TikTok Dispatch Config modal.
  - Link `landing_url` in `tiktokDeploy.js` to the ad creative payload.

- [x] **Step 50: Enhance Date Picker Visibility**
  - Styled the `input[type="date"]` with `filter: invert(1)` for the calendar indicator.
  - Added `color-scheme: dark` to ensure browser-native pickers match the dark theme.
  - Refined input borders for higher contrast.

- [x] **Step 51: Implement Company Profile Screen**
  - Added `companyProfile` data structure to the application state.
  - Integrated "Company Profile" tab into the Platform Admin sidebar.
  - Designed the Corporate Identity UI with Primary Information, Strategic Narrative, and Social Ecosystem sections.
  - Implemented persistence logic to save company data to the state.

- [x] **Step 52: Install and Configure PostgreSQL Database**
  - [x] Initial check for PostgreSQL (Not found)
  - [x] Downloading and Installing PostgreSQL 16 via winget
  - [x] Initialize the database named **MarketingAI**.
  - [x] Configure user **Monirul007** with password **Orion123@**.
  - [x] Create necessary tables for campaigns, users, and brand guidelines within the **MarketingAI** database.
  - [x] Update the C# backend to use PostgreSQL instead of JSON-based storage.
  - [x] Perform data migration from existing JSON files to the new database.
