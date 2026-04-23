import React from 'react';

const notifications = [
    { title: 'TikTok spend spike detected', detail: 'Spend increased 18% over forecast.' },
    { title: 'Creative approval requested', detail: 'Eco Launch visuals awaiting review.' },
    { title: 'New market insight', detail: 'Gen Z CTR up 0.6% on Reels.' },
    { title: 'Budget threshold reached', detail: 'Facebook budget is 90% utilized.' }
];

const Notifications = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Notification Page</div>
                    <h1>Notifications Feed</h1>
                    <p className="subtext">Stay updated on critical events and performance shifts.</p>
                </div>
            </div>

            <div className="cmo-card">
                <h3>Latest Updates</h3>
                <div className="cmo-list">
                    {notifications.map((note) => (
                        <div key={note.title} className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">{note.title}</div>
                                <div className="cmo-subtext">{note.detail}</div>
                            </div>
                            <span className="cmo-pill">New</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
