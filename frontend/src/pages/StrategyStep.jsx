import React, { useState } from 'react';
import LogicCard from '../components/LogicCard';
import MagicButton from '../components/MagicButton';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import './StrategyStep.css';

const OBJECTIVES = ['Reach', 'Click', 'Sell'];

const StrategyStep = () => {
    const navigate = useNavigate();
    const { strategyData, setStrategyData } = useCampaign();
    const [objective, setObjective] = useState('');

    React.useEffect(() => {
        if (strategyData?.objective) {
            setObjective(strategyData.objective);
        }
    }, [strategyData]);

    const canContinue = Boolean(objective);

    const startAnalysis = () => {
        const strategyData = { objective };
        setStrategyData(strategyData);
        navigate('/targeting');
    };

    return (
        <div className="strategy-step fade-in">
            <div className="strategy-header">
                <div>
                    <div className="strategy-kicker">Step 1 - Strategy</div>
                    <h1>Strategy</h1>
                    <p className="subtext">
                        Choose the primary outcome that will guide targeting and channel recommendations.
                    </p>
                </div>
                <div className="strategy-actions">
                    <MagicButton onClick={startAnalysis} disabled={!canContinue}>
                        Save Objective & Continue
                    </MagicButton>
                    {!canContinue && (
                        <span className="strategy-hint">Select an objective to continue.</span>
                    )}
                </div>
            </div>

            <div className="strategy-grid">
                <section className="strategy-section">
                    <div className="section-header">
                        <h2>1.1 Objective Selection</h2>
                        <span className="section-meta">Required</span>
                    </div>
                    <div className="grid-cards">
                        {OBJECTIVES.map((opt) => (
                            <LogicCard
                                key={opt}
                                title={opt}
                                selected={objective === opt}
                                onClick={() => {
                                    setObjective(opt);
                                    setStrategyData({ objective: opt });
                                }}
                            >
                                <p>Optimize for {opt.toLowerCase()} outcomes.</p>
                            </LogicCard>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default StrategyStep;
