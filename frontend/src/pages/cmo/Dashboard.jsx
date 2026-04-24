import React from 'react';
import MagicButton from '../../components/MagicButton';
import {
    analytics,
    channels,
    comparative,
    criteria,
    microBudgets,
    microCampaigns,
    schedule
} from '../../data/cmoDashboardData';

const Dashboard = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Multi-Channel Control</div>
                    <h1>Micro-Campaign Configuration Desk</h1>
                    <p className="subtext">
                        Configure Facebook, YouTube, and TikTok micro-campaigns with unified budgets, schedules,
                        evaluation criteria, and cross-channel analytics. Each micro-campaign is capped at $100.
                    </p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>New Micro-Campaign</MagicButton>
                    <button className="btn-outline">Export Config</button>
                    <span className="cmo-pill success">3 Channels Synced</span>
                </div>
            </div>

            <div className="cmo-grid wide cmo-channel-grid">
                {channels.map((channel) => (
                    <div key={channel.name} className="cmo-card cmo-channel-card">
                        <div className="cmo-channel-header">
                            <div>
                                <div className="cmo-kicker">Channel</div>
                                <h3 className="cmo-channel-title">{channel.name}</h3>
                            </div>
                            <span className={`cmo-pill ${channel.statusClass}`}>{channel.status}</span>
                        </div>
                        <div className="cmo-channel-metrics">
                            <div className="cmo-metric">
                                <div className="cmo-metric-label">Micro-campaigns</div>
                                <div className="cmo-metric-value">{channel.microCampaigns}</div>
                            </div>
                            <div className="cmo-metric">
                                <div className="cmo-metric-label">Budget</div>
                                <div className="cmo-metric-value">{channel.budget}</div>
                            </div>
                            <div className="cmo-metric">
                                <div className="cmo-metric-label">Cadence</div>
                                <div className="cmo-metric-value">{channel.cadence}</div>
                            </div>
                            <div className="cmo-metric">
                                <div className="cmo-metric-label">Primary KPI</div>
                                <div className="cmo-metric-value">{channel.kpi}</div>
                            </div>
                        </div>
                        <div className="cmo-channel-footer">
                            <span className="cmo-muted">Tracking: {channel.tracking}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="cmo-card">
                <div className="cmo-card-header">
                    <div>
                        <h3>Post-Execution Comparative Analysis</h3>
                        <div className="cmo-subtext">Winner highlighted by highest ROAS.</div>
                    </div>
                    <span className="cmo-pill accent">After Execution</span>
                </div>
                <table className="cmo-table compare">
                    <thead>
                        <tr>
                            <th>Channel</th>
                            <th>Spend</th>
                            <th>Reach</th>
                            <th>CTR</th>
                            <th>CPA</th>
                            <th>ROAS</th>
                            <th>VTR</th>
                            <th>Signal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {comparative.map((row) => (
                            <tr key={row.channel} className={row.winner ? 'highlight' : ''}>
                                <td>{row.channel}</td>
                                <td>{row.spend}</td>
                                <td>{row.reach}</td>
                                <td>{row.ctr}</td>
                                <td>{row.cpa}</td>
                                <td>{row.roas}</td>
                                <td>{row.vtr}</td>
                                <td>
                                    {row.winner ? <span className="cmo-pill success">Best ROAS</span> : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="cmo-split">
                <div className="cmo-card">
                    <h3>Micro-Campaign Configuration</h3>
                    <table className="cmo-table compact">
                        <thead>
                            <tr>
                                <th>Micro-campaign</th>
                                <th>Parent campaign</th>
                                <th>Channel</th>
                                <th>Audience</th>
                                <th>Budget</th>
                                <th>Schedule</th>
                                <th>Eval KPI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {microCampaigns.map((row) => (
                                <tr key={row.name}>
                                    <td>{row.name}</td>
                                    <td>{row.campaign}</td>
                                    <td>{row.channel}</td>
                                    <td>{row.audience}</td>
                                    <td>{row.budget}</td>
                                    <td>{row.schedule}</td>
                                    <td>{row.kpi}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="cmo-card">
                    <h3>Micro-Budget Pools</h3>
                    <div className="cmo-budget-list">
                        {microBudgets.map((budget) => (
                            <div key={budget.name} className="cmo-budget-card">
                                <div className="cmo-budget-header">
                                    <div className="cmo-title">{budget.name}</div>
                                    <span className="cmo-pill">Total {budget.total}</span>
                                </div>
                                <div className="cmo-budget-meta">
                                    <span>Used {budget.used}</span>
                                    <span>{budget.note}</span>
                                </div>
                                <div className="cmo-progress" aria-hidden="true">
                                    <span className={`cmo-progress-fill ${budget.fill}`}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="cmo-split">
                <div className="cmo-card">
                    <h3>Schedule & Cadence</h3>
                    <div className="cmo-schedule-list">
                        {schedule.map((item) => (
                            <div key={item.title} className="cmo-schedule-row">
                                <div className="cmo-schedule-date">{item.window}</div>
                                <div className="cmo-schedule-meta">
                                    <div className="cmo-title">{item.title}</div>
                                    <div className="cmo-subtext">{item.channels}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="cmo-card">
                    <h3>Evaluation Criteria</h3>
                    <div className="cmo-list">
                        {criteria.map((item) => (
                            <div key={item.label} className="cmo-list-item">
                                <div className="cmo-list-meta">
                                    <div className="cmo-title">{item.label}</div>
                                    <div className="cmo-subtext">Target: {item.target}</div>
                                </div>
                                <span className="cmo-pill accent">{item.weight}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="cmo-card">
                <h3>Cross-Channel Analytics to Track</h3>
                <div className="cmo-analytics-grid">
                    {analytics.map((group) => (
                        <div key={group.title} className="cmo-analytics-block">
                            <div className="cmo-title">{group.title}</div>
                            <div className="cmo-tags">
                                {group.items.map((item) => (
                                    <span key={item} className="cmo-tag">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
