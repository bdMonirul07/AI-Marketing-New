import React from 'react';
import { Link } from 'react-router-dom';
import MagicButton from '../../components/MagicButton';

const ExecuteLaunch = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Execute & Launch Page</div>
                    <h1>Execute and Launch</h1>
                    <p className="subtext">Finalize the checklist, export assets, and publish.</p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>Launch Campaign</MagicButton>
                    <Link to="/execute" className="btn-outline">Open Execution Workspace</Link>
                </div>
            </div>

            <div className="cmo-grid wide">
                <div className="cmo-card">
                    <h3>Launch Checklist</h3>
                    <div className="cmo-list">
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Assets Finalized</div>
                                <div className="cmo-subtext">4 images, 2 videos approved.</div>
                            </div>
                            <span className="cmo-pill success">Ready</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Tracking + Pixels</div>
                                <div className="cmo-subtext">Meta + Google tags verified.</div>
                            </div>
                            <span className="cmo-pill success">Ready</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Budget Allocation</div>
                                <div className="cmo-subtext">Approved and synced to platforms.</div>
                            </div>
                            <span className="cmo-pill success">Ready</span>
                        </div>
                    </div>
                </div>

                <div className="cmo-card">
                    <h3>Export Pack</h3>
                    <p className="cmo-subtext">Download a zip with creatives, copy, and plan docs.</p>
                    <div className="cmo-divider-line"></div>
                    <div className="cmo-actions">
                        <button className="btn-primary">Download Pack</button>
                        <button className="btn-outline">Send to Team</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExecuteLaunch;
