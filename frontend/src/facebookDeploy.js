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
        special_ad_categories: [] // Required empty for standard ads
    };

    const startTime = config.schedule_start ? new Date(config.schedule_start) : new Date();
    // Ensure end time is at least 24 hours after start time if not provided
    const endTime = config.schedule_end ? new Date(config.schedule_end) : new Error();
    let finalEndTime = endTime instanceof Error ? new Date(startTime.getTime() + 24 * 60 * 60 * 1000) : endTime;
    
    // If start and end are on the same day (as seen in UI), force end to be 23:59:59 of that day
    if (startTime.toDateString() === finalEndTime.toDateString()) {
        finalEndTime = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(), 23, 59, 59);
    }

    const adSetPayload = {
        name: `${campaignPayload.name}_AdSet`,
        daily_budget: Math.floor(parseFloat(config.daily_budget) * 100) || 10000, // Budget in cents
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        start_time: startTime.toISOString().replace('.000Z', '+0600'),
        end_time: finalEndTime.toISOString().replace('.000Z', '+0600'),
        targeting: {
            geo_locations: {
                countries: ["BD"]
            }
        },
        status: "PAUSED"
    };

    const cleanPageId = (config.page_id || "792318557298112").trim();

    const adCreativePayload = {
        name: `Ad_Creative_${asset.id.slice(0, 8)}`,
        object_story_spec: {
            page_id: cleanPageId,
            link_data: {
                message: state.marketingData.goal?.slice(0, 100) || "Bangladesh University Computer Science Department Admission Open!",
                link: config.landing_url || "https://bu.edu.bd",
                name: config.campaign_name || "Admission Open",
                call_to_action: {
                    type: "LEARN_MORE",
                    value: { "link": config.landing_url || "https://bu.edu.bd" }
                }
            }
        }
    };

    // Only add image_hash if it's not a placeholder
    if (asset.facebook_image_hash && asset.facebook_image_hash !== "YOUR_ACTUAL_IMAGE_HASH") {
        adCreativePayload.object_story_spec.link_data.image_hash = asset.facebook_image_hash;
    }

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
