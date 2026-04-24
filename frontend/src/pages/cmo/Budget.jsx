import React from 'react';
import MagicButton from '../../components/MagicButton';

const allocations = [
    { channel: 'Instagram', amount: '$18,000', share: '35%' },
    { channel: 'Facebook', amount: '$12,000', share: '23%' },
    { channel: 'Google Search', amount: '$10,500', share: '20%' },
    { channel: 'TikTok', amount: '$7,000', share: '14%' },
    { channel: 'YouTube', amount: '$4,500', share: '8%' }
];

const Budget = () => {
    return (
        <div className="cmo-page">
            <div className="cmo-hero">
                <div>
                    <div className="cmo-kicker">Budget Page</div>
                    <h1>Quarterly Budget Control</h1>
                    <p className="subtext">Track allocation, burn pace, and channel efficiency.</p>
                </div>
                <div className="cmo-actions">
                    <MagicButton>Request Budget Review</MagicButton>
                    <span className="cmo-pill success">On Track</span>
                </div>
            </div>

            <div className="cmo-grid">
                <div className="cmo-card">
                    <h3>Total Budget</h3>
                    <div className="cmo-title cmo-stat-value">$66,000</div>
                    <div className="cmo-subtext">Approved for Q1 growth initiatives</div>
                    <div className="cmo-divider-line"></div>
                    <div className="cmo-inline">
                        <span className="cmo-pill">Spent 48%</span>
                        <span className="cmo-subtext">$31,820 used</span>
                    </div>
                </div>

                <div className="cmo-card">
                    <h3>Burn Pace</h3>
                    <div className="cmo-subtext">Projected finish in 9.4 weeks</div>
                    <div className="cmo-progress" aria-hidden="true">
                        <span className="cmo-progress-fill fill-48"></span>
                    </div>
                    <div className="cmo-divider-line"></div>
                    <div className="cmo-subtext">Recommendation: Shift 5% to top CTR channels.</div>
                </div>

                <div className="cmo-card">
                    <h3>Reserve Pool</h3>
                    <div className="cmo-title cmo-stat-value">$8,500</div>
                    <div className="cmo-subtext">Held for experimental bursts and creator deals.</div>
                </div>
            </div>

            <div className="cmo-card">
                <h3>Channel Allocation</h3>
                <table className="cmo-table">
                    <thead>
                        <tr>
                            <th>Channel</th>
                            <th>Allocation</th>
                            <th>Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allocations.map((row) => (
                            <tr key={row.channel}>
                                <td>{row.channel}</td>
                                <td>{row.amount}</td>
                                <td>{row.share}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Budget;
