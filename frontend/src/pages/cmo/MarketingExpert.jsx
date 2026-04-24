import React from 'react';

const insights = [
    { title: 'Primary Narrative', detail: 'Position the product as the shortcut to time savings.' },
    { title: 'Proof Points', detail: 'Surface 3 customer stats in every asset.' },
    { title: 'CTA Priority', detail: 'Lead with "Book a live demo" for high intent.' }
];

const MarketingExpert = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Marketing Expert Page</div>
                    <h1>Marketing Expert</h1>
                    <p className="subtext">AI-guided strategy insights without exposing master prompt fields.</p>
                </div>
                <span className="cmo-pill accent">Expert Mode</span>
            </div>

            <div className="cmo-grid wide">
                {insights.map((item) => (
                    <div key={item.title} className="cmo-card">
                        <h3>{item.title}</h3>
                        <p className="cmo-subtext">{item.detail}</p>
                        <div className="cmo-divider-line"></div>
                        <div className="cmo-tags">
                            <span className="cmo-tag">Strategic</span>
                            <span className="cmo-tag">Executive Ready</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MarketingExpert;
