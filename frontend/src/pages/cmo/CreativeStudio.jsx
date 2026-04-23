import React from 'react';
import { Link } from 'react-router-dom';
import MagicButton from '../../components/MagicButton';

const CreativeStudio = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Creative Studio Page</div>
                    <h1>Creative Studio Review</h1>
                    <p className="subtext">Validate assets, request approvals, and send final packs.</p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>Request Approval</MagicButton>
                    <Link to="/creative" className="btn-outline">Open Creative Studio</Link>
                </div>
            </div>

            <div className="cmo-split">
                <div className="cmo-card">
                    <h3>Selected Asset Set</h3>
                    <div className="cmo-asset-grid">
                        <div className="cmo-asset">Hero Visual - v3</div>
                        <div className="cmo-asset">Reels Cut - 9:16</div>
                        <div className="cmo-asset">Carousel - 4 frames</div>
                        <div className="cmo-asset">YouTube Bumper</div>
                    </div>
                </div>

                <div className="cmo-card">
                    <h3>Approval Notes</h3>
                    <div className="cmo-list">
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Brand Kit Applied</div>
                                <div className="cmo-subtext">Colors, type, and logo verified.</div>
                            </div>
                            <span className="cmo-pill success">Complete</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Legal Review</div>
                                <div className="cmo-subtext">Awaiting disclaimer confirmation.</div>
                            </div>
                            <span className="cmo-pill warning">Pending</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Platform Specs</div>
                                <div className="cmo-subtext">Aspect ratios aligned to placements.</div>
                            </div>
                            <span className="cmo-pill success">Ready</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreativeStudio;
