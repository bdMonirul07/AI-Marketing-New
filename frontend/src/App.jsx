import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CampaignProvider } from './context/CampaignContext';
import Layout from './components/Layout';
import StrategyStep from './pages/StrategyStep';
import TargetingStep from './pages/TargetingStep';
import AiResearchStep from './pages/AiResearchStep';
import CreativeStep from './pages/CreativeStep';
import PlanStep from './pages/PlanStep';
import ExecuteStep from './pages/ExecuteStep';

import StyleGuide from './pages/StyleGuide';
import CmoLayout from './components/CmoLayout';
import CmoDashboard from './pages/cmo/Dashboard';
import CmoBudget from './pages/cmo/Budget';
import CmoApprovals from './pages/cmo/Approvals';
import CmoNotifications from './pages/cmo/Notifications';
import CmoPlatformAdmin from './pages/cmo/PlatformAdmin';
import CmoCalendar from './pages/cmo/Calendar';
import CmoBrandGuideline from './pages/cmo/BrandGuideline';
import CmoCreativeAssets from './pages/cmo/CreativeAssets';
import CmoMarketingExpert from './pages/cmo/MarketingExpert';
import CmoTargeting from './pages/cmo/Targeting';
import CmoResearch from './pages/cmo/Research';
import CmoQuerys from './pages/cmo/Querys';
import CmoCreativeStudio from './pages/cmo/CreativeStudio';
import CmoExecuteLaunch from './pages/cmo/ExecuteLaunch';
import CmoChat from './pages/cmo/Chat';

function App() {
  return (
    <CampaignProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<StrategyStep />} />
            <Route path="targeting" element={<TargetingStep />} />
            <Route path="research" element={<AiResearchStep />} />
            <Route path="creative" element={<CreativeStep />} />
            <Route path="plan" element={<PlanStep />} />
            <Route path="execute" element={<ExecuteStep />} />
            <Route path="style-guide" element={<StyleGuide />} />
          </Route>
          <Route path="/cmo" element={<CmoLayout />}>
            <Route index element={<CmoDashboard />} />
            <Route path="budget" element={<CmoBudget />} />
            <Route path="approvals" element={<CmoApprovals />} />
            <Route path="notifications" element={<CmoNotifications />} />
            <Route path="platform-admin" element={<CmoPlatformAdmin />} />
            <Route path="calendar" element={<CmoCalendar />} />
            <Route path="brand-guideline" element={<CmoBrandGuideline />} />
            <Route path="creative-assets" element={<CmoCreativeAssets />} />
            <Route path="marketing-expert" element={<CmoMarketingExpert />} />
            <Route path="targeting" element={<CmoTargeting />} />
            <Route path="research" element={<CmoResearch />} />
            <Route path="querys" element={<CmoQuerys />} />
            <Route path="creative-studio" element={<CmoCreativeStudio />} />
            <Route path="execute-launch" element={<CmoExecuteLaunch />} />
            <Route path="chat" element={<CmoChat />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CampaignProvider>
  );
}

export default App;
