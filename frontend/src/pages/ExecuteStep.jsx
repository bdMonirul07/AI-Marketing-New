import React, { useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import MagicButton from '../components/MagicButton';
import { mockProviders, mockResults } from '../data/mockCampaignData';
import './ExecuteStep.css';

const ExecuteStep = () => {
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchStatus, setLaunchStatus] = useState('idle'); // idle, process, complete
    const [providerStatus, setProviderStatus] = useState(
        mockProviders.reduce((acc, provider) => {
            acc[provider] = 'waiting';
            return acc;
        }, {})
    );

    const [campaignData, setCampaignData] = useState(null);
    const { selectedAsset } = useCampaign();

    const connectProvider = async (provider) => {
        setProviderStatus(prev => ({ ...prev, [provider]: 'connecting' }));
        await new Promise(r => setTimeout(r, 800));
        setProviderStatus(prev => ({ ...prev, [provider]: 'connected' }));
    };

    const handleLaunch = async () => {
        setIsLaunching(true);
        setLaunchStatus('process');

        for (const provider of mockProviders) {
            if (providerStatus[provider] === 'connected') {
                setProviderStatus(prev => ({ ...prev, [provider]: 'uploading' }));
                await new Promise(r => setTimeout(r, 1000));
                setProviderStatus(prev => ({ ...prev, [provider]: 'success' }));
            } else {
                setProviderStatus(prev => ({ ...prev, [provider]: 'waiting' }));
            }
        }

        setLaunchStatus('complete');
        setIsLaunching(false);

        setCampaignData({
            ...mockResults,
            creative: selectedAsset?.prompt?.substring(0, 60) || 'Primary launch creative'
        });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'waiting': return '⏳';
            case 'connecting': return '🔄';
            case 'connected': return '🔗';
            case 'uploading': return '⬆️';
            case 'success': return '✅';
            default: return '•';
        }
    };

    if (launchStatus === 'complete' && campaignData) {
        return (
            <div className="execute-step fade-in">
                <div className="dashboard-view">
                    <div className="success-banner">
                        <h2>🚀 Campaign Live!</h2>
                        <p>Your campaign has been successfully distributed to all connected channels.</p>
                    </div>

                    <div className="metrics-grid">
                        <div className="metric-card">
                            <span className="label">Spend</span>
                            <span className="value">{campaignData.spend}</span>
                        </div>
                        <div className="metric-card">
                            <span className="label">Reach</span>
                            <span className="value">{campaignData.reach}</span>
                        </div>
                        <div className="metric-card">
                            <span className="label">CTR</span>
                            <span className="value">{campaignData.ctr}</span>
                        </div>
                        <div className="metric-card">
                            <span className="label">Conversions</span>
                            <span className="value accent">{campaignData.conversions}</span>
                        </div>
                    </div>

                    <div className="live-providers-list">
                        <h3>Active Channels</h3>
                        <div className="channel-rows">
                            {Object.entries(providerStatus).map(([name, status]) => (
                                <div key={name} className={`channel-row ${status === 'success' ? 'success' : ''}`}>
                                    <span className="icon">{status === 'success' ? '✅' : '⏳'}</span>
                                    <span className="name">{name}</span>
                                    <span className="status">{status === 'success' ? 'Active - Delivering' : 'Not connected'}</span>
                                    <button className="view-btn">{status === 'success' ? 'View Ad' : 'Connect'}</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="recommendation-box">
                        <strong>💡 AI Recommendation:</strong>
                        {` Top performer: ${campaignData.topChannel}. Consider shifting 10% of budget to ${campaignData.topChannel}.`}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="execute-step fade-in">
            <div className="mb-4">
                <h1>Execute</h1>
                <p className="subtext">Finalize connections and launch your campaign across dummy providers.</p>
            </div>

            <div className="execution-container">
                <div className="launch-checklist card">
                    <h3>Final Checklist</h3>
                    <ul className="checklist">
                        <li><span className="check">✔</span> <strong>Strategy:</strong> Objective aligned and approved</li>
                        <li><span className="check">✔</span> <strong>Creative:</strong> Asset package locked</li>
                        <li><span className="check">✔</span> <strong>Targeting:</strong> Platforms and audiences selected</li>
                        <li><span className="check">✔</span> <strong>Budget:</strong> Schedule and spend validated</li>
                    </ul>
                </div>

                <div className="providers-card card">
                    <h3>Dummy Providers</h3>
                    <div className="providers-list">
                        {Object.entries(providerStatus).map(([name, status]) => (
                            <div key={name} className={`provider-item ${status}`}>
                                <div className="provider-info">
                                    <span className="status-icon">{getStatusIcon(status)}</span>
                                    <span className="provider-name">{name}</span>
                                </div>
                                <div className="provider-state">
                                    {status === 'waiting' ? (
                                        <button
                                            className="connect-btn"
                                            onClick={() => connectProvider(name)}
                                        >
                                            Connect Account
                                        </button>
                                    ) : (
                                        <>
                                            {status === 'connecting' && 'Connecting...'}
                                            {status === 'connected' && 'Connected'}
                                            {status === 'uploading' && 'Publishing Assets...'}
                                            {status === 'success' && 'Published'}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="launch-action">
                    <p className="disclaimer">
                        By clicking launch, you will publish to the connected dummy providers.
                    </p>
                    <MagicButton
                        onClick={handleLaunch}
                        loading={isLaunching}
                        disabled={isLaunching}
                    >
                        Launch Campaign
                    </MagicButton>
                </div>
            </div>
        </div>
    );
};

export default ExecuteStep;
