# Targeting Feature Guide

## Overview
The Targeting step allows you to create multiple target audience sets, each with specific location, language, and demographic configurations. This enables precise, multi-segment campaign targeting.

## Two-Column Interface

### Left: Configuration Form
Create new target sets by configuring:
- **Location & Language**: Country, optional map area, language
- **Audience Definition**: Age range, gender, interests

### Right: Target Sets List
View and manage all your configured target sets with full details.

## Creating Target Sets

### 1. Location & Language Configuration

**Country Selection**:
- Dropdown with 200+ countries
- Search by typing country name
- Required field

**Map Area Selection (Optional)**:
- Click "Select from Maps" to open interactive map
- Choose specific city, neighborhood, or region
- Set radius from 500 meters to 100 kilometers
- Selected area shows with full address and coordinates

**Language**:
- 80+ languages available
- Matches your target audience's language

### 2. Audience Definition

**Age Range**:
- Set minimum age (13-65)
- Set maximum age (13-65+)
- Adjustable with number inputs
- Display shows: "Age Range: 18 - 45+"

**Gender**:
- Segmented control with 3 options
- All (default)
- Male
- Female

**Interests/Behaviors**:
- Type interest and press Enter to add
- Multiple interests supported
- Each appears as a tag with remove button (×)
- Examples: "Technology", "Fitness", "Travel"

### 3. Add to List

Once you've configured location, language, and audience:
1. Click "+ Add to List" button
2. Your configuration appears as a card in the right panel
3. Form fields reset for next entry
4. Continue adding as many target sets as needed

## Managing Target Sets

### Target Set Display

Each target set card shows:

```
┌──────────────────────────────────────┐
│ United States • English         🗑️   │ ← Header
├──────────────────────────────────────┤
│ 📍 Brooklyn, NY (2km radius)         │ ← Location (if set)
│ 👥 Female, 25-40                     │ ← Demographics
│ [Fashion] [Shopping] [Design]        │ ← Interests
└──────────────────────────────────────┘
```

**Header**:
- Shows country and language
- Delete button (🗑️) to remove this set

**Location** (if map area selected):
- Pin icon (📍)
- Full address
- Radius in parentheses

**Demographics**:
- People icon (👥)
- Gender, age range

**Interests**:
- Mini tags for each interest
- Compact display

### Removing Target Sets

- Click the 🗑️ icon on any target set card
- Confirmation is immediate (no undo)
- Can add it back by reconfiguring

## Google Maps Integration

### Opening the Map

Click "Select from Maps" button to open the map modal.

**Modal Components**:
- Search box at top for location lookup
- Interactive Google Map (260-320px height, responsive)
- Radius slider with live preview
- Selected area information box
- Cancel and ✓ Done buttons

### Selecting a Location

**Method 1: Search**
1. Type location in search box
2. Select from autocomplete suggestions
3. Map centers on location

**Method 2: Click on Map**
1. Click anywhere on the map
2. Purple circle appears at that point
3. Address auto-generates via reverse geocoding

**Method 3: Drag Circle**
1. Click and drag the circle to move it
2. Address updates automatically
3. Drag circle edges to resize

### Adjusting Radius

**Slider Controls**:
- Min: 0.5 km (500 meters)
- Max: 100 km
- Step: 0.5 km increments
- Purple gradient thumb
- Live preview on map

**Display Format**:
- < 1 km: Shows in meters ("500 meters", "750 meters")
- ≥ 1 km: Shows in kilometers ("1 km", "50 km")

**Use Cases**:
- 500m - 1km: Neighborhood/block level
- 1-10 km: City district or town
- 10-50 km: Metropolitan area
- 50-100 km: Regional coverage

### Confirming Selection

1. Verify the address in the "Selected Area" box
2. Check radius is correct
3. Click "✓ Done" button
4. Returns to Targeting page
5. Selected area appears under the button

### Changing Selection

- Click "Change Area Selection" button
- Map reopens with previous selection
- Make changes
- Click "✓ Done" to save
- Or click ✕ on the area card to remove entirely

## Complete Workflow Example

### Scenario: Multi-City Fashion Campaign

**Target Set 1: New York Fashion Enthusiasts**
- Country: United States
- Map Area: Manhattan, NY (5km radius)
- Language: English
- Age: 25-40
- Gender: Female
- Interests: Fashion, Shopping, Design

**Target Set 2: Los Angeles Fashion Lovers**
- Country: United States
- Map Area: Beverly Hills, CA (10km radius)
- Language: English
- Age: 22-35
- Gender: All
- Interests: Fashion, Celebrities, Luxury

**Target Set 3: French Market**
- Country: France
- Map Area: Paris (15km radius)
- Language: French
- Age: 20-45
- Gender: Female
- Interests: Mode, Shopping, Art

**Result**: Three distinct target sets, each optimized for specific demographics and locations.

## Validation & Constraints

### Required Fields
- At least one target set must be added
- Each set requires:
  - Country
  - Language
  - Age range (both min and max)
  - Gender selection

### Optional Fields
- Map area (can target entire country)
- Interests (can be empty)

### Continue Button
- Disabled (grayed out) when no target sets exist
- Enabled when at least one set is added
- Saves all target sets and proceeds to Creative step

## Best Practices

### Location Targeting
1. **Broad Campaigns**: Skip map selection, use country-wide
2. **Local Campaigns**: Use map with 1-10km radius
3. **Regional Campaigns**: Use map with 20-100km radius
4. **Multi-Market**: Create separate target sets for each city/region

### Audience Configuration
1. **Age Range**: Keep ranges realistic (e.g., 18-65, not 18-20)
2. **Interests**: 3-7 interests is optimal (not too broad, not too narrow)
3. **Gender**: Use "All" unless product is gender-specific
4. **Multiple Sets**: Create sets for different demographics, not duplicates

### Organization Tips
1. Start with your primary market
2. Add secondary markets as separate sets
3. Group by geography or demographics
4. Review list before continuing
5. Remove unnecessary sets to keep focused

## Technical Details

### Data Structure
Each target set contains:
```javascript
{
  id: 1234567890,
  target: {
    country: "US",
    countryName: "United States",
    language: "en",
    languageName: "English",
    mapLocation: {
      lat: 40.7128,
      lng: -74.0060,
      radius: 5,
      address: "New York, NY, USA"
    }
  },
  audience: {
    ageRange: { min: 25, max: 40 },
    gender: "Female",
    interests: ["Fashion", "Shopping", "Design"]
  }
}
```

### Map Modal Specifications
- Modal size: 90% width, max 1000px
- Max height: 88-95vh (responsive)
- Map height: 260-320px (screen-dependent)
- Radius slider: 0.5-100km range
- All distances in kilometers internally
- Coordinates: WGS84 decimal degrees

### Performance
- Lazy loading: Map loads only when modal opens
- Reuses Google Maps script on subsequent opens
- Efficient geocoding with automatic debouncing
- List supports scrolling for 10+ target sets

## Responsive Design

### Desktop (> 768px)
- Two-column grid layout
- Form on left (1.35fr)
- List on right (1fr)
- Both columns visible simultaneously

### Mobile (< 768px)
- Single column layout
- Form appears first
- List appears below form
- Full-width buttons
- Optimized map modal size

## Troubleshooting

**"Select from Maps" shows blank**:
- Check Google Maps API key is set
- Verify internet connection
- Check browser console for errors

**Map loads but no circle**:
- Wait 1-2 seconds for initial render
- Try clicking on the map
- Refresh the page

**Can't add to list**:
- Ensure country is selected
- Ensure language is selected
- Check age range is valid (min < max)

**Button shows "Change Area Selection"**:
- This means an area is already selected
- Click to modify existing selection
- Or click ✕ on the area card to remove it

## Future Enhancements

Potential improvements:
- Import/export target sets
- Duplicate existing sets
- Reorder sets
- Bulk edit
- Save as templates
- Platform-specific previews
