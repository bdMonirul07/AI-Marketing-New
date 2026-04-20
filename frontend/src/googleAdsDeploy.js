// Google Ads Deployment Module
// Builds payloads for Google Ads campaigns (Search, Display, Shopping, Performance Max)

export function buildGoogleAdsCampaignPayload(config, targeting, assets) {
  return {
    campaign: {
      name: config.campaign_name || 'Google Ads Campaign',
      type: config.campaign_type || 'SEARCH', // SEARCH, DISPLAY, SHOPPING, PERFORMANCE_MAX
      budget: {
        amount: config.daily_budget || 100,
        type: 'DAILY'
      },
      bidStrategy: config.bid_strategy || 'MAXIMIZE_CLICKS',
      status: config.status || 'PAUSED',
      startDate: config.start_date,
      endDate: config.end_date,
      networkSettings: {
        targetGoogleSearch: config.campaign_type === 'SEARCH',
        targetSearchNetwork: config.campaign_type === 'SEARCH',
        targetContentNetwork: config.campaign_type === 'DISPLAY',
        targetPartnerSearchNetwork: false
      }
    },
    adGroup: {
      name: `${config.campaign_name || 'Campaign'} - Ad Group 1`,
      cpcBid: config.cpc_bid || 2.00,
      type: config.campaign_type === 'SEARCH' ? 'SEARCH_STANDARD' : 'DISPLAY_STANDARD'
    },
    targeting: {
      locations: targeting.countries || ['US'],
      languages: targeting.languages || ['en'],
      ageRanges: targeting.age_ranges || [],
      genders: targeting.genders || [],
      keywords: config.keywords || [],
      topics: config.topics || [],
      placements: config.placements || []
    },
    ads: {
      type: config.campaign_type === 'SEARCH' ? 'RESPONSIVE_SEARCH_AD' : 'RESPONSIVE_DISPLAY_AD',
      headlines: config.headlines || ['Your Headline Here'],
      descriptions: config.descriptions || ['Your Description Here'],
      finalUrl: config.landing_url || '',
      displayUrl: config.display_url || '',
      // For Display
      images: assets.filter(a => a.type === 'image').map(a => a.url),
      videos: assets.filter(a => a.type === 'video').map(a => a.url),
      businessName: config.business_name || '',
      longHeadline: config.long_headline || ''
    }
  }
}

export function buildGoogleAdsKeywordPayload(keywords) {
  return keywords.map(kw => ({
    text: kw.text,
    matchType: kw.matchType || 'BROAD', // BROAD, PHRASE, EXACT
    cpcBid: kw.bid || null
  }))
}

export async function deployToGoogleAds(apiBase, config, targeting, assets, headers) {
  const payload = buildGoogleAdsCampaignPayload(config, targeting, assets)

  try {
    const response = await fetch(`${apiBase}/deploy/unified`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        campaignId: config.campaignId,
        platforms: ['google_ads'],
        dryRun: config.dryRun || false
      })
    })

    if (!response.ok) throw new Error(`Google Ads deploy failed: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('[GOOGLE ADS] Deploy error:', error)
    return { success: false, error: error.message, platform: 'google_ads' }
  }
}
