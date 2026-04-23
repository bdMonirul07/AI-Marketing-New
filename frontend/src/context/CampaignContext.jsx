import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'campaignState';

const defaultState = {
    strategyData: null,
    targetingPlan: null,
    researchContext: null,
    assets: [],
    selectedAsset: null,
    creativeLibrary: {
        uploadedAssets: [],
        generatedAssets: [],
        requirements: { photos: 1, videos: 2, posts: 0 },
        providers: [],
        notes: ''
    },
    planData: null
};

const loadState = () => {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return defaultState;
        return { ...defaultState, ...JSON.parse(stored) };
    } catch (error) {
        return defaultState;
    }
};

const CampaignContext = createContext({
    ...defaultState,
    setStrategyData: () => {},
    setTargetingPlan: () => {},
    setResearchContext: () => {},
    setAssets: () => {},
    setSelectedAsset: () => {},
    setCreativeLibrary: () => {},
    setPlanData: () => {},
    resetCampaign: () => {}
});

export const CampaignProvider = ({ children }) => {
    const [state, setState] = useState(loadState);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            // Ignore storage errors (private mode, quota issues).
        }
    }, [state]);

    const updateState = (patch) => {
        setState((prev) => ({ ...prev, ...patch }));
    };

    const value = useMemo(() => ({
        ...state,
        setStrategyData: (strategyData) => updateState({ strategyData }),
        setTargetingPlan: (targetingPlan) => updateState({ targetingPlan }),
        setResearchContext: (researchContext) => updateState({ researchContext }),
        setAssets: (assets) => updateState({ assets }),
        setSelectedAsset: (selectedAsset) => updateState({ selectedAsset }),
        setCreativeLibrary: (creativeLibrary) => updateState({ creativeLibrary }),
        setPlanData: (planData) => updateState({ planData }),
        resetCampaign: () => updateState(defaultState)
    }), [state]);

    return (
        <CampaignContext.Provider value={value}>
            {children}
        </CampaignContext.Provider>
    );
};

export const useCampaign = () => useContext(CampaignContext);
