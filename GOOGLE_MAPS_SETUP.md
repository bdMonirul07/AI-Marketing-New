# Google Maps API Setup

## Overview
The Targeting step features a powerful multi-target set system with Google Maps integration for precise location targeting with radius-based area selection.

## Key Features
1. **Multi-Target Sets**: Create and manage multiple targeting configurations
2. **Countries Dropdown**: All 200+ countries available
3. **Languages Dropdown**: 80+ major world languages
4. **Google Maps Area Selector**: Interactive map with:
   - Click to select location
   - Draggable circle for area selection
   - Adjustable radius (500 meters - 100 km)
   - Search box for location lookup
   - Reverse geocoding for address display
5. **Target Set Management**: Add, view, and remove multiple target/audience combinations

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Go to **Credentials** and create an API key
5. (Optional) Restrict the API key to your domain for security

### 2. Configure the API Key

Open `/Users/shafqat/git/aimarketing/frontend/src/components/MapSelector.jsx` and replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key:

```javascript
// Line 28-29
const script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY_HERE&libraries=places,drawing`;
```

### 3. Environment Variable Approach (Recommended)

For better security, use environment variables:

1. Create a `.env` file in the frontend directory:
```bash
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

2. Update MapSelector.jsx to use the environment variable:
```javascript
script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,drawing`;
```

3. Add `.env` to `.gitignore` to keep your API key secure

## How to Use

### Creating a Target Set

1. **Select Location & Language**:
   - Choose a country from the dropdown
   - Optionally click "Select from Maps" to choose a specific area
   - Select the target language

2. **Define Audience**:
   - Set age range (13-65+)
   - Choose gender (All, Male, Female)
   - Add interests/behaviors by typing and pressing Enter

3. **Add to List**:
   - Click "+ Add to List" button
   - Your target set appears on the right panel

4. **Repeat for Multiple Targets**:
   - Create as many target sets as needed
   - Each set can have different locations and audiences

5. **Continue**:
   - Once you've added at least one target set, click "Continue to Creative"

### Using Google Maps

1. Click "Select from Maps" button
2. Use the search box or click on the map to select a location
3. Adjust the radius using the slider (500m - 100km)
4. Drag the circle to move it or resize by dragging the edges
5. Click "✓ Done" to confirm your selection
6. The selected area appears under the button with full details

## Data Structure

When a map area is selected, it returns:
```javascript
{
  lat: 40.7128,           // Latitude
  lng: -74.0060,          // Longitude
  radius: 50,             // Radius in kilometers
  address: "New York, NY, USA"  // Human-readable address
}
```

## UI Layout

The Targeting page features a two-column layout:

**Left Column - Configuration Form**:
- Location & Language selection
- Google Maps area selector
- Audience definition (age, gender, interests)
- "+ Add to List" button

**Right Column - Target Sets List**:
- Shows all added target/audience combinations
- Each item displays:
  - Country and language
  - Map location (if selected)
  - Audience demographics
  - Interest tags
  - Delete button
- "Continue to Creative" button (enabled when list has items)

## Files Modified

- `frontend/src/data/countries.js` - 200+ countries list
- `frontend/src/data/languages.js` - 80+ languages list
- `frontend/src/components/MapSelector.jsx` - Map modal component with optimized layout
- `frontend/src/components/MapSelector.css` - Responsive map modal styles
- `frontend/src/pages/TargetingStep.jsx` - Multi-target set management system
- `frontend/src/pages/TargetingStep.css` - Two-column layout and list styles

## Notes

- The map defaults to New York City with a 5 km radius if no initial location is provided
- Radius can be adjusted from 500 meters to 100 km in 500 meter increments
- Radius displays as meters when < 1 km, and as km when >= 1 km
- The circle is draggable and editable for fine-tuning
- Address is automatically reverse-geocoded from the selected coordinates
- The map requires an active internet connection and valid API key to function

## Cost Considerations

Google Maps API has a free tier with $200 monthly credit:
- Maps JavaScript API: $7 per 1,000 loads
- Places API: $17 per 1,000 requests (Autocomplete)
- Geocoding API: $5 per 1,000 requests

Monitor your usage in the Google Cloud Console to stay within budget.
