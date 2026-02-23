/**
 * TikTok Ad Deployment Handler
 * Handles: Ad Group and Ad Creative Parameters
 * Integrates with Backend Proxy for Secure API Execution
 */

export async function deployToTikTok(asset, apiBase, state, isPreview = false) {
    const config = state.marketingData.platformConfig.tiktok;

    // Helper: Map targeting to TikTok Format
    const primaryTarget = state.marketingData.targeting[0] || { country: "United States", ageMin: 18, ageMax: 65, gender: "All" };

    const countryMap = { "United States": "US", "United Kingdom": "GB", "Germany": "DE", "Bangladesh": "BD" };
    const ttCountry = countryMap[primaryTarget.country] || "US";

    const getAgeGroups = (min, max) => {
        const groups = [];
        if (min <= 17 || max <= 17) groups.push("AGE_13_17");
        if ((min <= 24 && max >= 18)) groups.push("AGE_18_24");
        if ((min <= 34 && max >= 25)) groups.push("AGE_25_34");
        if ((min <= 44 && max >= 35)) groups.push("AGE_35_44");
        if ((min <= 54 && max >= 45)) groups.push("AGE_45_54");
        if (max >= 55) groups.push("AGE_55_100");
        return groups.length ? groups : ["AGE_18_24", "AGE_25_34"];
    }

    const ttGender = primaryTarget.gender === 'Male' ? ["GENDER_MALE"] : primaryTarget.gender === 'Female' ? ["GENDER_FEMALE"] : ["GENDER_MALE", "GENDER_FEMALE"];

    // Determine active objective parameters based on marketingData.objective
    const objectiveMapping = {
        "LEAD_GENERATION": { promo: "LEAD_GENERATION", billing: "OCPM", goal: "LEAD" },
        "SALES": { promo: "SALES", billing: "OCPM", goal: "PURCHASE" }, // Assuming PURCHASE for sales
        "APP_INSTALL": { promo: "APP_INSTALL", billing: "OCPM", goal: "INSTALL_APP" },
        "REACH": { promo: "REACH", billing: "OCPM", goal: "REACH" },
        // Add more mappings as needed
    };
    const activeObjective = objectiveMapping[state.marketingData.objective] || objectiveMapping["LEAD_GENERATION"];


    // 1. Ad Group Parameters (Targeting & Budget - Mapping from State)
    const adGroupPayload = {
        advertiser_id: config.advertiser_id || "7600977012697776144",
        campaign_id: config.campaign_id || "NEW_CAMPAIGN",
        adgroup_name: config.custom_ad_name ? `${config.custom_ad_name}_GRP` : `AI_Orch_${asset.id.slice(0, 8)}`,
        promotion_type: activeObjective.promo,
        placement_type: config.placement === 'PLACEMENT_ALL' ? 'PLACEMENT_TYPE_AUTOMATIC' : 'PLACEMENT_TYPE_NORMAL',
        placement: config.placement === 'PLACEMENT_ALL' ? [] : [config.placement],

        // Budget & Schedule (User Input or defaults)
        budget_mode: config.budget_mode || "BUDGET_MODE_DAILY",
        budget: parseFloat(config.daily_budget) || state.marketingData.budgetMatrix?.totalSpend || 400,
        schedule_type: "SCHEDULE_START_END",
        schedule_start_time: config.schedule_start ? `${config.schedule_start} 00:00:00` : new Date().toISOString().slice(0, 19).replace('T', ' '),
        schedule_end_time: config.schedule_end ? `${config.schedule_end} 23:59:59` : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),

        // Optimization (Mapped from Goal)
        billing_event: activeObjective.billing,
        optimization_goal: activeObjective.goal,
        pacing: config.pacing || "PACING_MODE_SMOOTH",
        bid_type: config.bid_type || "BID_TYPE_COST_CAP",
        bid: parseFloat(config.bid) || 120,

        // Targeting (Sync with Marketing Suite Targeting UI)
        targeting: {
            geo_locations: {
                countries: [ttCountry]
            },
            age_groups: getAgeGroups(parseInt(primaryTarget.ageMin), parseInt(primaryTarget.ageMax)),
            genders: ttGender,
            languages: [state.marketingData.brandGuidelines.language?.toLowerCase().slice(0, 2) || "en"],
            ad_tag_v2: config.interests ? config.interests.split(',').map(i => i.trim()).filter(i => i) : []
        },
        pixel_id: config.pixel_id || null,
        status: config.status || "ENABLE"
    };

    // 2. Ad Creative Parameters (Video & Text)
    const adCreativePayload = {
        ad_name: config.custom_ad_name || `Ad_Creative_${asset.id.slice(0, 5)}`,
        display_name: state.marketingData.brandGuidelines.brandLabel || "Brand Name",
        video_id: asset.id, // Using asset ID as video identifier for backend to resolve
        ad_text: state.marketingData.goal?.slice(0, 100) || "Discover our amazing brand!", // AI-derived goal
        identity_id: config.identity_id || null,
        call_to_action: config.cta || (state.marketingData.objective === 'Sell' ? 'SHOP_NOW' : 'LEARN_MORE')
    };

    console.log("🚀 Dispatching TikTok Deployment Payloads...", { adGroupPayload, adCreativePayload });

    if (isPreview) {
        return { adGroupPayload, adCreativePayload };
    }

    // Backend handles both AdGroup and Ad (Creative) creation logic
    const response = await fetch(`${apiBase}/deploy/tiktok-adgroup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-TikTok-Token': config.access_token // Pass token if provided in UI
        },
        body: JSON.stringify({
            group: adGroupPayload,
            creative: adCreativePayload
        })
    });

    return response;
}
