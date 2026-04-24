import React from 'react';

const assets = [
    { label: 'Hero Visual - Q1', type: 'Image' },
    { label: 'Product Reel', type: 'Video' },
    { label: 'Carousel Variant', type: 'Image' },
    { label: 'Founder Story', type: 'Video' },
    { label: 'Lead Gen Static', type: 'Image' },
    { label: 'UGC Spotlight', type: 'Video' }
];

const CreativeAssets = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Creative Assets Page</div>
                    <h1>Creative Library</h1>
                    <p className="subtext">Manage approved visuals, videos, and brand-ready templates.</p>
                </div>
                <span className="cmo-pill">24 Assets</span>
            </div>

            <div className="cmo-card">
                <h3>Latest Assets</h3>
                <div className="cmo-asset-grid">
                    {assets.map((asset) => (
                        <div key={asset.label} className="cmo-asset">
                            <div className="cmo-asset-title">{asset.label}</div>
                            <div className="cmo-subtext">{asset.type}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CreativeAssets;
