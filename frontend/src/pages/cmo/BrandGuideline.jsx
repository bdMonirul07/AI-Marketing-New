import React from 'react';

const BrandGuideline = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Brand Guideline Page</div>
                    <h1>Brand Guideline</h1>
                    <p className="subtext">Voice, visuals, and guardrails for every campaign touchpoint.</p>
                </div>
            </div>

            <div className="cmo-grid">
                <div className="cmo-card">
                    <h3>Brand Voice</h3>
                    <div className="cmo-tags">
                        <span className="cmo-tag">Confident</span>
                        <span className="cmo-tag">Warm</span>
                        <span className="cmo-tag">Insightful</span>
                        <span className="cmo-tag">Action-oriented</span>
                    </div>
                    <div className="cmo-divider-line"></div>
                    <p className="cmo-subtext">Keep messaging optimistic, founder-led, and rooted in customer wins.</p>
                </div>

                <div className="cmo-card">
                    <h3>Visual System</h3>
                    <div className="cmo-chip-row">
                        <span className="cmo-chip">Midnight Indigo</span>
                        <span className="cmo-chip">Electric Accent</span>
                        <span className="cmo-chip">Warm Neutrals</span>
                    </div>
                    <div className="cmo-divider-line"></div>
                    <p className="cmo-subtext">Use layered gradients, soft shadows, and premium lighting cues.</p>
                </div>

                <div className="cmo-card">
                    <h3>Do / Don't</h3>
                    <div className="cmo-list">
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Do</div>
                                <div className="cmo-subtext">Highlight customer outcomes and social proof.</div>
                            </div>
                            <span className="cmo-pill success">Required</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Don't</div>
                                <div className="cmo-subtext">Use generic stock imagery or aggressive sales copy.</div>
                            </div>
                            <span className="cmo-pill warning">Avoid</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandGuideline;
