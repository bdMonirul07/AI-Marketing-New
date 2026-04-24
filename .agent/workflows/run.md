---
description: Run the Aimarketing application stack (Backend + Frontend)
---

To run the application, there are two primary methods depending on your preference.

### Option 1: VS Code "Run" Menu (Recommended)

1. Open the **Run and Debug** view in VS Code (Cmd+Shift+D).
2. Select **"Run Full Stack"** from the dropdown menu.
3. Click the **Play** button (Green arrow).
   - This will start the .NET backend.
   - It will also start the React frontend (Vite).
   - It will launch a Chrome instance attached to the frontend.

### Option 2: Command Line (Workflow)

// turbo-all
1. Start the Backend:
   ```bash
   cd backend && dotnet run --urls "http://localhost:5286"
   ```

2. Start the Frontend (in a new terminal):
   ```bash
   cd frontend && npm run dev
   ```

Note: The frontend will likely start on `http://localhost:5173` and the backend on `http://localhost:5286`.
