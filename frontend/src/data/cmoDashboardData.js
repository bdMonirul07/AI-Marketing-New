export const channels = [
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
];

export const microCampaigns = [
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
];

export const microBudgets = [
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
];

export const schedule = [
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
];

export const criteria = [
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
];

export const analytics = [
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
];

export const comparative = [
    {
        channel: 'YouTube',
        spend: '$98',
        reach: '42K',
        ctr: '2.9%',
        cpa: '$9.40',
        roas: '3.6x',
        vtr: '31%',
        winner: true
    },
    {
        channel: 'Facebook',
        spend: '$92',
        reach: '36K',
        ctr: '2.4%',
        cpa: '$10.80',
        roas: '2.9x',
        vtr: '21%',
        winner: false
    },
    {
        channel: 'TikTok',
        spend: '$85',
        reach: '48K',
        ctr: '1.9%',
        cpa: '$12.10',
        roas: '2.1x',
        vtr: '34%',
        winner: false
    }
];
