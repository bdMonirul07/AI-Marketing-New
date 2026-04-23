import React from 'react';
import MagicButton from '../../components/MagicButton';

const approvals = [
    { name: 'Holiday Video Cut', owner: 'Creative Team', status: 'Awaiting', due: 'Today 4:00 PM' },
    { name: 'SaaS Retargeting Copy', owner: 'Growth Ops', status: 'Review', due: 'Tomorrow 10:00 AM' },
    { name: 'Product Launch Landing', owner: 'Web Team', status: 'Legal Check', due: 'Friday' }
];

const Approvals = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Approval Page</div>
                    <h1>Approvals & Sign-Offs</h1>
                    <p className="subtext">Review high-priority assets, copy, and budgets.</p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>Approve Priority Set</MagicButton>
                    <span className="cmo-pill warning">3 Items Due</span>
                </div>
            </div>

            <div className="cmo-card">
                <h3>Approval Queue</h3>
                <div className="cmo-list">
                    {approvals.map((item) => (
                        <div key={item.name} className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">{item.name}</div>
                                <div className="cmo-subtext">{item.owner} - Due {item.due}</div>
                            </div>
                            <div className="cmo-actions">
                                <span className="cmo-pill accent">{item.status}</span>
                                <button className="btn-outline">Request Changes</button>
                                <button className="btn-primary">Approve</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Approvals;
