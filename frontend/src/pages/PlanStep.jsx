import React, { useEffect } from 'react';
import MagicButton from '../components/MagicButton';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import './PlanStep.css';

const DUMMY_PLAN = {
    version: 2,
    channels: [
        {
            name: 'Facebook',
            status: 'Connected',
            statusClass: 'success',
            microCampaigns: '4 active',
            budget: '$185',
            cadence: 'Mon/Wed bursts',
            kpi: 'CPL $18',
            tracking: 'Pixel + CAPI'
        },
        {
            name: 'YouTube',
            status: 'Connected',
            statusClass: 'success',
            microCampaigns: '3 active',
            budget: '$100',
            cadence: 'Thu-Sun flight',
            kpi: 'View rate 28%',
            tracking: 'GA4 + Brand Lift'
        },
        {
            name: 'TikTok',
            status: 'Attention',
            statusClass: 'warning',
            microCampaigns: '2 active',
            budget: '$85',
            cadence: 'Daily micro-bursts',
            kpi: 'VTR 22%',
            tracking: 'Pixel pending'
        }
    ],
    microCampaigns: [
        {
            name: 'Prospect Warmup',
            campaign: 'Q1 Pipeline Build',
            channel: 'Facebook',
            audience: 'Lookalike 1-3%',
            budget: '$90',
            schedule: 'Jan 29 - Feb 4, 2026',
            kpi: 'CPL <= $22'
        },
        {
            name: 'Founder Story Cut',
            campaign: 'Q1 Pipeline Build',
            channel: 'YouTube',
            audience: 'Intent + Topics',
            budget: '$100',
            schedule: 'Feb 2 - Feb 9, 2026',
            kpi: 'View rate >= 25%'
        },
        {
            name: 'Creator Remix Test',
            campaign: 'Creator Sprint',
            channel: 'TikTok',
            audience: 'Interest: SaaS',
            budget: '$85',
            schedule: 'Feb 5 - Feb 10, 2026',
            kpi: 'VTR >= 20%'
        },
        {
            name: 'Retargeting Nurture',
            campaign: 'Pipeline Convert',
            channel: 'Facebook',
            audience: 'Site visitors 30d',
            budget: '$95',
            schedule: 'Feb 7 - Feb 14, 2026',
            kpi: 'CTR >= 1.8%'
        }
    ],
    microBudgets: [
        {
            name: 'Awareness Sprints',
            total: '$140',
            used: '$60',
            fill: 'fill-45',
            note: 'TikTok + YouTube bursts'
        },
        {
            name: 'Conversion Experiments',
            total: '$140',
            used: '$80',
            fill: 'fill-58',
            note: 'Landing page + CTA tests'
        },
        {
            name: 'Retargeting Pool',
            total: '$100',
            used: '$50',
            fill: 'fill-75',
            note: 'High-intent nurtures'
        }
    ],
    schedule: [
        {
            window: 'Jan 29 - Feb 2, 2026',
            title: 'Micro-burst 1: Awareness lift',
            channels: 'TikTok + YouTube'
        },
        {
            window: 'Feb 3 - Feb 6, 2026',
            title: 'Micro-burst 2: Product proof',
            channels: 'Facebook + YouTube'
        },
        {
            window: 'Feb 7 - Feb 14, 2026',
            title: 'Micro-burst 3: Retargeting push',
            channels: 'Facebook + TikTok'
        }
    ],
    criteria: [
        {
            label: 'Qualified lead rate',
            target: '>= 6%',
            weight: '40%'
        },
        {
            label: 'Cost per qualified lead',
            target: '<= $35',
            weight: '30%'
        },
        {
            label: 'Creative hold rate',
            target: '>= 2.4s',
            weight: '15%'
        },
        {
            label: 'Cross-channel frequency',
            target: '<= 5.0',
            weight: '15%'
        }
    ],
    analytics: [
        {
            title: 'Reach & Awareness',
            items: ['Impressions', 'Unique reach', 'CPM', 'Video thruplay']
        },
        {
            title: 'Engagement',
            items: ['CTR', 'Hook rate', 'Shares', 'Saves']
        },
        {
            title: 'Conversion Quality',
            items: ['CPL', 'ROAS', 'On-site CVR', 'Demo starts']
        },
        {
            title: 'Cross-channel',
            items: ['Frequency', 'Attribution window', 'View-through conv', 'Incremental lift']
        }
    ]
};

const PlanStep = () => {
    const navigate = useNavigate();
    const { planData, setPlanData } = useCampaign();

    useEffect(() => {
        if (!planData || planData.version !== DUMMY_PLAN.version) {
            setPlanData(DUMMY_PLAN);
        }
    }, [planData, setPlanData]);

    const activePlan = planData || DUMMY_PLAN;

    const handleExecute = () => {
        navigate('/execute');
    };

    const handleRegenerate = () => {
        setPlanData({ ...DUMMY_PLAN, generatedAt: Date.now() });
    };

    return (
        <div className="plan-step fade-in">
            <div className="plan-hero">
                <div>
                    <div className="plan-kicker">Step 5 - Plan</div>
                    <h1>Micro-Campaign Planning</h1>
                    <p className="subtext">
                        Configure multi-channel micro-campaigns, budget pools, schedules, evaluation criteria,
                        and analytics tracking before launch. Total micro-campaign spend is capped at $400.
                        Post-execution, the system reallocates budget by channel performance.
                    </p>
                </div>
                <div className="plan-actions">
                    <button className="btn-outline" type="button" onClick={handleRegenerate}>
                        Regenerate Plan
                    </button>
                    <MagicButton onClick={handleExecute}>
                        Initialize Launch
                    </MagicButton>
                </div>
            </div>

            <div className="plan-channel-grid">
                {activePlan.channels.map((channel) => (
                    <div key={channel.name} className="plan-card plan-channel-card">
                        <div className="plan-card-header">
                            <div>
                                <div className="plan-card-kicker">Channel</div>
                                <h3>{channel.name}</h3>
                            </div>
                            <span className={`plan-pill ${channel.statusClass}`}>{channel.status}</span>
                        </div>
                        <div className="plan-channel-metrics">
                            <div>
                                <div className="plan-meta-label">Micro-campaigns</div>
                                <div className="plan-meta-value">{channel.microCampaigns}</div>
                            </div>
                            <div>
                                <div className="plan-meta-label">Budget</div>
                                <div className="plan-meta-value">{channel.budget}</div>
                            </div>
                            <div>
                                <div className="plan-meta-label">Cadence</div>
                                <div className="plan-meta-value">{channel.cadence}</div>
                            </div>
                            <div>
                                <div className="plan-meta-label">Primary KPI</div>
                                <div className="plan-meta-value">{channel.kpi}</div>
                            </div>
                        </div>
                        <div className="plan-card-footnote">Tracking: {channel.tracking}</div>
                    </div>
                ))}
            </div>

            <div className="plan-split">
                <div className="plan-card">
                    <div className="plan-card-header">
                        <h3>Micro-Campaign Configuration</h3>
                        <span className="plan-card-kicker">Across channels</span>
                    </div>
                    <table className="plan-table">
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
                            {activePlan.microCampaigns.map((row) => (
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

                <div className="plan-card">
                    <div className="plan-card-header">
                        <h3>Micro-Budget Pools</h3>
                        <span className="plan-card-kicker">Guardrails</span>
                    </div>
                    <div className="plan-budget-list">
                        {activePlan.microBudgets.map((budget) => (
                            <div key={budget.name} className="plan-budget-card">
                                <div className="plan-budget-header">
                                    <div className="plan-budget-title">{budget.name}</div>
                                    <span className="plan-pill">Total {budget.total}</span>
                                </div>
                                <div className="plan-budget-meta">
                                    <span>Used {budget.used}</span>
                                    <span>{budget.note}</span>
                                </div>
                                <div className="plan-progress" aria-hidden="true">
                                    <span className={`plan-progress-fill ${budget.fill}`}></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="plan-split">
                <div className="plan-card">
                    <div className="plan-card-header">
                        <h3>Schedule & Cadence</h3>
                        <span className="plan-card-kicker">Timeline</span>
                    </div>
                    <div className="plan-schedule-list">
                        {activePlan.schedule.map((item) => (
                            <div key={item.title} className="plan-schedule-row">
                                <div className="plan-schedule-date">{item.window}</div>
                                <div>
                                    <div className="plan-budget-title">{item.title}</div>
                                    <div className="plan-card-footnote">{item.channels}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="plan-card">
                    <div className="plan-card-header">
                        <h3>Evaluation Criteria</h3>
                        <span className="plan-card-kicker">Scorecard</span>
                    </div>
                    <div className="plan-criteria-list">
                        {activePlan.criteria.map((item) => (
                            <div key={item.label} className="plan-criteria-item">
                                <div>
                                    <div className="plan-budget-title">{item.label}</div>
                                    <div className="plan-card-footnote">Target: {item.target}</div>
                                </div>
                                <span className="plan-pill accent">{item.weight}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="plan-card">
                <div className="plan-card-header">
                    <h3>Analytics to Track</h3>
                    <span className="plan-card-kicker">Cross-channel</span>
                </div>
                <div className="plan-analytics-grid">
                    {activePlan.analytics.map((group) => (
                        <div key={group.title} className="plan-analytics-block">
                            <div className="plan-budget-title">{group.title}</div>
                            <div className="plan-tag-row">
                                {group.items.map((item) => (
                                    <span key={item} className="plan-tag">{item}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PlanStep;
