// YouTube Ads Deployment Module
// Builds payloads for YouTube video campaigns

export function buildYouTubeAdPayload(config, targeting, videoAsset) {
  return {
    campaign: {
      name: config.campaign_name || 'YouTube Video Campaign',
      type: 'VIDEO',
      subType: config.ad_format || 'IN_STREAM_SKIPPABLE',
      // IN_STREAM_SKIPPABLE, IN_STREAM_NON_SKIPPABLE, DISCOVERY, SHORTS, BUMPER
      budget: {
        amount: config.daily_budget || 50,
        type: config.budget_type || 'DAILY' // DAILY or TOTAL
      },
      bidStrategy: config.bid_strategy || 'MAXIMIZE_CPV',
      // MAXIMIZE_CPV, TARGET_CPM, TARGET_CPA, MAXIMIZE_CONVERSIONS
      status: config.status || 'PAUSED',
      startDate: config.start_date,
      endDate: config.end_date
    },
    adGroup: {
      name: `${config.campaign_name || 'Campaign'} - Video Group`,
      cpvBid: config.cpv_bid || 0.10,
      cpmBid: config.cpm_bid || 10.00,
      targetingExpansion: config.targeting_expansion || false
    },
    targeting: {
      locations: targeting.countries || ['US'],
      languages: targeting.languages || ['en'],
      ageRanges: targeting.age_ranges || [],
      genders: targeting.genders || [],
      topics: config.topics || [],
      keywords: config.keywords || [],
      placements: config.placements || [],
      interests: config.interests || [],
      remarketing: config.remarketing_lists || []
    },
    ad: {
      videoId: videoAsset?.videoId || config.video_id || '',
      videoUrl: videoAsset?.url || '',
      headline: config.headline || '',
      description1: config.description1 || '',
      description2: config.description2 || '',
      displayUrl: config.display_url || '',
      finalUrl: config.landing_url || '',
      callToAction: config.cta || 'LEARN_MORE',
      // LEARN_MORE, SHOP_NOW, SIGN_UP, VISIT_SITE, WATCH_MORE, BOOK_NOW, DOWNLOAD
      companionBanner: config.companion_banner_url || null
    }
  }
}

export function getYouTubeAdFormats() {
  return [
    {
      id: 'IN_STREAM_SKIPPABLE',
      name: 'Skippable In-Stream',
      description: 'Plays before/during/after videos. Skippable after 5 seconds.',
      minLength: 12,
      maxLength: null,
      bidTypes: ['CPV', 'Target CPA', 'Maximize Conversions']
    },
    {
      id: 'IN_STREAM_NON_SKIPPABLE',
      name: 'Non-Skippable In-Stream',
      description: 'Plays before/during/after videos. Cannot be skipped.',
      minLength: 6,
      maxLength: 15,
      bidTypes: ['Target CPM']
    },
    {
      id: 'DISCOVERY',
      name: 'Video Discovery',
      description: 'Appears in search results and related videos.',
      minLength: null,
      maxLength: null,
      bidTypes: ['CPV']
    },
    {
      id: 'SHORTS',
      name: 'YouTube Shorts',
      description: 'Vertical video ads in Shorts feed.',
      minLength: null,
      maxLength: 60,
      bidTypes: ['Target CPA', 'Maximize Conversions']
    },
    {
      id: 'BUMPER',
      name: 'Bumper',
      description: 'Short, non-skippable ads up to 6 seconds.',
      minLength: null,
      maxLength: 6,
      bidTypes: ['Target CPM']
    }
  ]
}

export async function deployToYouTube(apiBase, config, targeting, videoAsset, headers) {
  const payload = buildYouTubeAdPayload(config, targeting, videoAsset)

  try {
    const response = await fetch(`${apiBase}/deploy/unified`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        campaignId: config.campaignId,
        platforms: ['youtube'],
        dryRun: config.dryRun || false
      })
    })

    if (!response.ok) throw new Error(`YouTube deploy failed: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('[YOUTUBE] Deploy error:', error)
    return { success: false, error: error.message, platform: 'youtube' }
  }
}
