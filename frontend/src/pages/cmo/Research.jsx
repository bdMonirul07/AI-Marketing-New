import React from 'react';
import { Link } from 'react-router-dom';
import MagicButton from '../../components/MagicButton';

const Research = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Campaign Research & Strategy</div>
                    <h1>Research Briefing</h1>
                    <p className="subtext">Capture the 10 core questions and align on the campaign brief.</p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>Generate New Question Set</MagicButton>
                    <Link to="/research" className="btn-outline">Open Research Workspace</Link>
                </div>
            </div>

            <div className="cmo-split">
                <div className="cmo-card">
                    <h3>Latest Research Summary</h3>
                    <div className="cmo-list">
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Objective Alignment</div>
                                <div className="cmo-subtext">Drive qualified demo requests while raising awareness.</div>
                            </div>
                            <span className="cmo-pill">Set 1</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Emotional Anchor</div>
                                <div className="cmo-subtext">Confidence, mastery, and time saved.</div>
                            </div>
                            <span className="cmo-pill">Set 1</span>
                        </div>
                        <div className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">Conversion Path</div>
                                <div className="cmo-subtext">Ad -> Live demo -> Onboarding sprint.</div>
                            </div>
                            <span className="cmo-pill">Set 2</span>
                        </div>
                    </div>
                </div>

                <div className="cmo-card">
                    <h3>Brief Integrity</h3>
                    <p className="cmo-subtext">All strategic inputs validated and ready for targeting.</p>
                    <div className="cmo-divider-line"></div>
                    <div className="cmo-chip-row">
                        <span className="cmo-chip">Objective: Sell</span>
                        <span className="cmo-chip">Tone: Confident</span>
                        <span className="cmo-chip">CTA: Book Demo</span>
                    </div>
                    <div className="cmo-divider-line"></div>
                    <div className="cmo-highlight">Next step: finalize targeting and budget.</div>
                </div>
            </div>
        </div>
    );
};

export default Research;
