/**
 * Facebook Ad Deployment Handler
 * Handles: Ad Campaigns, Ad Set, and Ad Creative Parameters
 * Integrates with Backend Proxy for Secure API Execution
 */

export async function deployToFacebook(asset, apiBase, state, isPreview = false) {
    const config = state.marketingData.platformConfig.facebook;

    // Define Payload mapping for Facebook Graph API
    const campaignPayload = {
        name: config.campaign_name || `AI_FB_Camp_${asset.id.slice(0, 8)}`,
        objective: config.objective || "OUTCOME_TRAFFIC",
        status: "PAUSED",
        special_ad_categories: ["NONE"]
    };

    const adSetPayload = {
        name: `${campaignPayload.name}_AdSet`,
        daily_budget: Math.floor(parseFloat(config.daily_budget) * 100) || 10000, // Budget in cents
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        start_time: config.schedule_start ? new Date(config.schedule_start).toISOString().replace('.000Z', '+0600') : new Date().toISOString().replace('.000Z', '+0600'),
        end_time: config.schedule_end ? new Date(config.schedule_end).toISOString().replace('.000Z', '+0600') : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('.000Z', '+0600'),
        targeting: {
            geo_locations: {
                countries: ["BD"]
            }
        },
        status: "PAUSED"
    };

    const adCreativePayload = {
        name: `Ad_Creative_${asset.id.slice(0, 8)}`,
        object_story_spec: {
            page_id: config.page_id || "792318557298112",
            link_data: {
                message: state.marketingData.goal?.slice(0, 100) || "Bangladesh University Computer Science Department Admission Open!",
                link: config.landing_url || "https://bu.edu.bd",
                image_hash: "YOUR_ACTUAL_IMAGE_HASH", // The actual hash comes from uploading the image first
                call_to_action: {
                    type: "LEARN_MORE",
                    value: { "link": config.landing_url || "https://bu.edu.bd" }
                }
            }
        },
        status: "PAUSED"
    };

    console.log("🚀 Dispatching Facebook Deployment Payloads...", { campaignPayload, adSetPayload, adCreativePayload });

    if (isPreview) {
        return { campaignPayload, adSetPayload, adCreativePayload };
    }

    try {
        const response = await fetch(`${apiBase}/deploy/facebook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaign: campaignPayload,
                adSet: adSetPayload,
                creative: adCreativePayload,
                assetId: asset.id
            })
        });
        return await response.json();
    } catch (e) {
        console.error("Facebook deployment error:", e);
        throw e;
    }
}
