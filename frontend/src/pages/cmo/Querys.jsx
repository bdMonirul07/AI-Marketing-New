import React from 'react';

const queries = [
    { title: 'New creative variant request', from: 'Retail Team', status: 'Open' },
    { title: 'Budget shift proposal', from: 'Performance Ops', status: 'Review' },
    { title: 'Localization needs', from: 'EMEA Marketing', status: 'Queued' }
];

const Querys = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Querys Page</div>
                    <h1>Incoming Queries</h1>
                    <p className="subtext">Requests and questions routed to the CMO desk.</p>
                </div>
            </div>

            <div className="cmo-card">
                <h3>Open Requests</h3>
                <div className="cmo-list">
                    {queries.map((query) => (
                        <div key={query.title} className="cmo-list-item">
                            <div className="cmo-list-meta">
                                <div className="cmo-title">{query.title}</div>
                                <div className="cmo-subtext">From {query.from}</div>
                            </div>
                            <span className="cmo-pill accent">{query.status}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Querys;
