# Area Selection Feature Guide

## Overview
The Targeting step includes a Google Maps integration that allows precise location targeting with radius-based area selection. This is part of the multi-target set system where you can create multiple targeting configurations.

## How It Works

### 1. Initial State
When you first open the Targeting step, you'll see a "Select from Maps" button under the "Specific Area (Optional)" section.

### 2. Opening the Map Selector
Click the "Select from Maps" button to open an interactive Google Maps modal with:
- Full interactive map
- Search bar to find locations
- Adjustable radius slider (500m - 100km)
- Current selection info displayed prominently

### 3. Selecting an Area
You can select an area in three ways:

**A. Click on the Map**
- Click anywhere on the map
- The circle moves to that location
- Address is automatically reverse-geocoded and displayed

**B. Use the Search Box**
- Type a location (city, address, landmark)
- Select from autocomplete suggestions
- Map centers on that location with the circle

**C. Drag the Circle**
- Drag the circle to move it
- Resize by dragging the edges
- Address updates automatically

### 4. Adjust the Radius
Use the slider at the bottom to adjust your target area:
- **500 meters** - Neighborhood/block level
- **1-10 km** - City district level
- **10-50 km** - Metropolitan area
- **50-100 km** - Regional coverage

The display intelligently shows:
- **< 1 km**: "500 meters", "750 meters"
- **≥ 1 km**: "1 km", "5 km", "100 km"

### 5. Selected Area Display

Once you confirm your selection, the targeting page shows a compact card under the button:

```
SELECTED AREA:
┌────────────────────────────────────────────────┐
│ 📍  Times Square, Manhattan, NY 10036, USA     │
│     [5km radius]                            ✕  │
└────────────────────────────────────────────────┘
```

**The display includes:**
- **"SELECTED AREA:" label** - Purple uppercase label
- **📍 Icon** - Visual indicator
- **Full Address** - Complete location name
- **Radius Badge** - Highlighted in purple
- **Coordinates** - Exact lat/lng (in compact view)
- **✕ Button** - Remove the selection with one click

### 6. Adding to Target List

After selecting your area:
1. Configure the rest of your audience (age, gender, interests)
2. Click "+ Add to List"
3. Your complete target set (including the map area) appears in the right panel
4. The area information is preserved in each target set card

### 7. Modifying Your Selection

- **Change Area**: Click "Change Area Selection" button
- **Clear Selection**: Click the "✕" button on the area card
- **Remove from List**: Delete the entire target set from the list
- The map modal remembers your previous selection when reopened

## Visual Design Features

### Selected Area Card
- **Gradient Background**: Blue-to-cyan gradient for visual appeal
- **Purple Border**: Matches the app's accent color (#7C3AED)
- **Slide-in Animation**: Smooth entrance when area is selected
- **Responsive Layout**: Adapts to different screen sizes

### In Map Modal
- **Highlighted Info Box**: Blue gradient background with purple border
- **Location Pin Emoji**: Subtle watermark in the corner
- **Monospace Coordinates**: Easy-to-read lat/lng format
- **Bold Address**: Area name stands out clearly

## Example Use Cases

### Neighborhood Targeting
```
Location: Brooklyn Heights, Brooklyn, NY
Radius: 750 meters
Use: Local coffee shop targeting nearby residents
```

### City-Wide Campaign
```
Location: Downtown Los Angeles, CA
Radius: 15 km
Use: City-wide event promotion
```

### Regional Coverage
```
Location: San Francisco Bay Area
Radius: 50 km
Use: Bay Area job listings or services
```

## Technical Details

### Data Structure
When an area is selected, it stores:
```javascript
{
  lat: 40.7580,                           // Latitude (decimal)
  lng: -73.9855,                          // Longitude (decimal)
  radius: 5,                              // Radius in kilometers
  address: "Times Square, Manhattan, ..." // Human-readable address
}
```

### Reverse Geocoding
- Automatically converts coordinates to addresses
- Uses Google Maps Geocoding API
- Updates in real-time as you move the circle
- Fetches detailed address on initial load

### Performance
- Map loads only when modal is opened (lazy loading)
- Reuses loaded Google Maps script on subsequent opens
- Efficient address updates with debouncing on drag events

## Tips

1. **Use Search for Precision**: Type the exact location name for best results
2. **Adjust Radius Last**: Select location first, then fine-tune the radius
3. **Check the Preview**: The address shown is exactly what will be saved
4. **Coordinates Help**: Use lat/lng for API integrations or verification
5. **Clear When Done**: Remove the selection if you want country-wide targeting instead

## Accessibility

- All buttons have proper labels and titles
- Keyboard navigable
- High contrast text on colored backgrounds
- Clear visual feedback on all interactions
