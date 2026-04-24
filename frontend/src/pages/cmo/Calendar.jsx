import React from 'react';

const schedule = [
    { date: 'Mon', title: 'Brand Sprint Review', detail: 'Finalize Q2 messaging' },
    { date: 'Tue', title: 'Creative Approval', detail: 'Summer Launch assets' },
    { date: 'Thu', title: 'Performance Sync', detail: 'Paid media check-in' },
    { date: 'Fri', title: 'Campaign Launch', detail: 'Retail collaboration push' }
];

const Calendar = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Calendar Page</div>
                    <h1>Marketing Calendar</h1>
                    <p className="subtext">Upcoming milestones across strategy, creative, and launch.</p>
                </div>
                <span className="cmo-pill success">This Week</span>
            </div>

            <div className="cmo-card">
                <h3>Weekly Milestones</h3>
                <div className="cmo-list">
                    {schedule.map((item) => (
                        <div key={item.title} className="cmo-list-item">
                            <div className="cmo-inline">
                                <span className="cmo-pill accent">{item.date}</span>
                                <div className="cmo-list-meta">
                                    <div className="cmo-title">{item.title}</div>
                                    <div className="cmo-subtext">{item.detail}</div>
                                </div>
                            </div>
                            <button className="btn-outline">View Details</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Calendar;
