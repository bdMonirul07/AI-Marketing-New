# Frontend Setup Guide

## Current Status
The frontend code is ready, but **Node.js and npm are not installed** on your system.

## Backend Status ✅
- ✅ Backend is running at: http://localhost:5286
- ✅ API Documentation is accessible at: http://localhost:5286/scalar/v1
- ✅ API endpoints are ready to use

## Frontend Requirements

### What You Need to Install: Node.js

The frontend is built with React and Vite, which require Node.js and npm (Node Package Manager).

### Installation Steps

#### Option 1: Install Node.js (Recommended)
1. **Download Node.js**
   - Visit: https://nodejs.org/
   - Download the **LTS (Long Term Support)** version
   - Recommended: v20.x or v22.x

2. **Run the Installer**
   - Double-click the downloaded `.msi` file
   - Follow the installation wizard
   - ✅ Make sure "Add to PATH" is checked
   - ✅ Install npm package manager (included by default)

3. **Verify Installation**
   Open a new PowerShell window and run:
   ```powershell
   node --version
   npm --version
   ```
   You should see version numbers for both.

#### Option 2: Install via Chocolatey (If you use it)
```powershell
choco install nodejs-lts
```

### After Node.js Installation

Once Node.js is installed, run these commands:

```bash
# Navigate to frontend directory
cd "c:\Marketing AI\ai-marketing\frontend"

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at: **http://localhost:5173**

## Frontend Technology Stack

- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.4
- **Routing**: React Router DOM 7.11.0
- **Styling**: Vanilla CSS (following the design system in spec.txt)

## Frontend Features (Already Implemented)

The frontend has pages for all 5 steps:
1. **Strategy Step** - Objective selection and content planning
2. **Targeting Step** - Audience demographics and budget
3. **Creative Step** - AI-powered image/video generation
4. **Plan Step** - Marketing plan and distribution
5. **Execute Step** - Launch and monitoring

## CORS Configuration

The backend is already configured to accept requests from the frontend:
- Frontend URL: `http://localhost:5173`
- All headers and methods allowed

## Next Steps

1. **Install Node.js** from https://nodejs.org/
2. **Open a new PowerShell window** (to refresh PATH)
3. **Run these commands**:
   ```bash
   cd "c:\Marketing AI\ai-marketing\frontend"
   npm install
   npm run dev
   ```
4. **Open your browser** to http://localhost:5173

## Troubleshooting

### "npm is not recognized"
- Node.js is not installed, or PATH is not updated
- Solution: Install Node.js and restart PowerShell

### Port 5173 already in use
- Another Vite app is running
- Solution: Stop the other app or use a different port:
  ```bash
  npm run dev -- --port 3000
  ```

### Backend connection errors
- Make sure the backend is running at http://localhost:5286
- Check CORS settings in `backend/Program.cs`

## File Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── StrategyStep.jsx
│   │   ├── TargetingStep.jsx
│   │   ├── CreativeStep.jsx
│   │   ├── PlanStep.jsx
│   │   └── ExecuteStep.jsx
│   ├── components/
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
```

## Environment Variables (Optional)

If the backend URL changes, create a `.env` file:
```
VITE_API_URL=http://localhost:5286
```

---

## Summary

✅ **Backend**: Running and ready
✅ **Frontend Code**: Complete and ready
⚠️ **Node.js**: Required but not installed

**Action Required**: Install Node.js to run the frontend.
