import React from 'react';
import { Link } from 'react-router-dom';
import MagicButton from '../../components/MagicButton';

const segments = [
    { name: 'North America - Tech Leaders', detail: 'Ages 28-45 - Interest: SaaS, Ops, Growth', size: 'Large' },
    { name: 'UK - Retail Innovators', detail: 'Ages 30-50 - Interest: Retail, CX, AI', size: 'Medium' },
    { name: 'EU - Emerging Brands', detail: 'Ages 24-40 - Interest: DTC, Marketing', size: 'Small' }
];

const Targeting = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Targeting Page</div>
                    <h1>Audience Targeting Overview</h1>
                    <p className="subtext">Validate target sets before activating campaigns.</p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>Generate New Segment</MagicButton>
                    <Link to="/targeting" className="btn-outline">Open Targeting Builder</Link>
                </div>
            </div>

            <div className="cmo-card">
                <h3>Active Target Sets</h3>
                <div className="cmo-list">
                    {segments.map((segment) => (
                        <div key={segment.name} className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">{segment.name}</div>
                                <div className="cmo-subtext">{segment.detail}</div>
                            </div>
                            <span className={`cmo-pill ${segment.size === 'Large' ? 'success' : segment.size === 'Medium' ? 'accent' : 'warning'}`}>
                                {segment.size}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Targeting;
