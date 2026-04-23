import React from 'react';

const platforms = [
    { name: 'Meta Business', status: 'Connected', owner: 'Growth Ops' },
    { name: 'Google Ads', status: 'Connected', owner: 'Performance Team' },
    { name: 'TikTok Ads', status: 'Needs Auth', owner: 'Social Team' },
    { name: 'YouTube Studio', status: 'Connected', owner: 'Brand Team' }
];

const PlatformAdmin = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Platform Admin Page</div>
                    <h1>Platform Administration</h1>
                    <p className="subtext">Manage connected ad accounts and publishing permissions.</p>
                </div>
            </div>

            <div className="cmo-grid wide">
                {platforms.map((platform) => (
                    <div key={platform.name} className="cmo-card">
                        <h3>{platform.name}</h3>
                        <div className="cmo-subtext">Owner: {platform.owner}</div>
                        <div className="cmo-divider-line"></div>
                        <div className="cmo-inline">
                            <span className={`cmo-pill ${platform.status === 'Connected' ? 'success' : 'warning'}`}>
                                {platform.status}
                            </span>
                            <button className="btn-outline">
                                {platform.status === 'Connected' ? 'Manage Access' : 'Connect'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlatformAdmin;
