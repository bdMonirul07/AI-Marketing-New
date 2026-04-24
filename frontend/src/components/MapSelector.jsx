import React, { useState, useEffect, useRef } from 'react';
import './MapSelector.css';

const MapSelector = ({ isOpen, onClose, onSelect, initialLocation }) => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [circle, setCircle] = useState(null);
    const [selectedArea, setSelectedArea] = useState({
        lat: initialLocation?.lat || 40.7128,
        lng: initialLocation?.lng || -74.0060,
        radius: initialLocation?.radius || 5, // km
        address: initialLocation?.address || 'New York, NY, USA'
    });
    const [manualAddress, setManualAddress] = useState(initialLocation?.address || '');
    const [radius, setRadius] = useState(initialLocation?.radius || 5);
    const [loadError, setLoadError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !mapRef.current) return;

        // Load Google Maps Script
        const loadGoogleMaps = () => {
            if (window.google && window.google.maps) {
                console.log('Google Maps already loaded');
                initializeMap();
                return;
            }

            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

            if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY' || apiKey === 'your_api_key_here') {
                setLoadError('API_KEY_MISSING');
                return;
            }

            setIsLoading(true);
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                console.log('Google Maps script loaded successfully');
                setIsLoading(false);
                initializeMap();
            };
            script.onerror = (error) => {
                console.error('Failed to load Google Maps script:', error);
                setIsLoading(false);
                setLoadError('SCRIPT_LOAD_FAIL');
            };
            document.head.appendChild(script);
        };

        const initializeMap = () => {
            try {
                console.log('Initializing map...');
                const mapInstance = new window.google.maps.Map(mapRef.current, {
                    center: { lat: selectedArea.lat, lng: selectedArea.lng },
                    zoom: 10,
                    mapTypeControl: true,
                    streetViewControl: false,
                });

                setMap(mapInstance);
                console.log('Map initialized successfully');

                // Fetch initial address if we only have default coordinates
                if (selectedArea.address === 'New York, NY, USA' && !initialLocation) {
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode(
                        { location: { lat: selectedArea.lat, lng: selectedArea.lng } },
                        (results, status) => {
                            if (status === 'OK' && results[0]) {
                                setSelectedArea(prev => ({
                                    ...prev,
                                    address: results[0].formatted_address
                                }));
                            }
                        }
                    );
                }

            // Create initial circle
            const circleInstance = new window.google.maps.Circle({
                map: mapInstance,
                center: { lat: selectedArea.lat, lng: selectedArea.lng },
                radius: radius * 1000, // Convert km to meters
                fillColor: '#7C3AED',
                fillOpacity: 0.2,
                strokeColor: '#7C3AED',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                editable: true,
                draggable: true,
            });

            setCircle(circleInstance);

            // Add click listener to move circle
            mapInstance.addListener('click', (e) => {
                const newLat = e.latLng.lat();
                const newLng = e.latLng.lng();

                circleInstance.setCenter(e.latLng);

                // Reverse geocode to get address
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: e.latLng }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        setSelectedArea({
                            lat: newLat,
                            lng: newLng,
                            radius: radius,
                            address: results[0].formatted_address
                        });
                    }
                });
            });

            // Listen to circle radius changes
            window.google.maps.event.addListener(circleInstance, 'radius_changed', () => {
                const newRadius = Math.round(circleInstance.getRadius() / 1000);
                setRadius(newRadius);
                setSelectedArea(prev => ({ ...prev, radius: newRadius }));
            });

            // Listen to circle center changes
            window.google.maps.event.addListener(circleInstance, 'center_changed', () => {
                const center = circleInstance.getCenter();
                const newLat = center.lat();
                const newLng = center.lng();

                // Reverse geocode
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: center }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        setSelectedArea({
                            lat: newLat,
                            lng: newLng,
                            radius: radius,
                            address: results[0].formatted_address
                        });
                    }
                });
            });

            // Add search box
            const input = document.getElementById('map-search-input');
            const searchBox = new window.google.maps.places.SearchBox(input);

            searchBox.addListener('places_changed', () => {
                const places = searchBox.getPlaces();
                if (places.length === 0) return;

                const place = places[0];
                if (!place.geometry || !place.geometry.location) return;

                mapInstance.setCenter(place.geometry.location);
                mapInstance.setZoom(12);
                circleInstance.setCenter(place.geometry.location);

                setSelectedArea({
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    radius: radius,
                    address: place.formatted_address || place.name
                });
            });
            } catch (error) {
                console.error('Error initializing map:', error);
                alert('Failed to initialize map. Please try again.');
            }
        };

        loadGoogleMaps();
    }, [isOpen]);

    // Update circle radius when slider changes
    useEffect(() => {
        if (circle) {
            circle.setRadius(radius * 1000); // radius is in km, convert to meters
            setSelectedArea(prev => ({ ...prev, radius }));
        }
    }, [radius, circle]);

    // Format radius display (show meters if < 1km, otherwise km)
    const formatRadius = (radiusKm) => {
        if (radiusKm < 1) {
            return `${Math.round(radiusKm * 1000)} meters`;
        }
        return `${radiusKm} km`;
    };

    const handleConfirm = () => {
        onSelect(selectedArea);
        onClose();
    };

    const applyManualAddress = () => {
        if (!manualAddress.trim()) return;
        setSelectedArea((prev) => ({
            ...prev,
            address: manualAddress.trim()
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="map-modal-overlay" onClick={onClose}>
            <div className="map-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="map-modal-header">
                    <h2>Select Target Area</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="map-search-container">
                    <input
                        id="map-search-input"
                        type="text"
                        placeholder="Search for a location..."
                        className="map-search-input"
                    />
                </div>

                <div ref={mapRef} className="map-container">
                    {isLoading && (
                        <div className="map-loading-overlay">
                            <div className="loader"></div>
                            <p>Loading Maps...</p>
                        </div>
                    )}
                    {loadError === 'API_KEY_MISSING' && (
                        <div className="map-error-overlay">
                            <span className="error-icon">🔑</span>
                            <h3>API Key Missing</h3>
                            <p>Add your Google Maps API key to the <code>.env</code> file to enable the map.</p>
                            <p className="text-sm">Variable name: <code>VITE_GOOGLE_MAPS_API_KEY</code></p>
                            <div className="manual-entry">
                                <input
                                    type="text"
                                    className="map-search-input"
                                    placeholder="Enter city or address"
                                    value={manualAddress}
                                    onChange={(e) => setManualAddress(e.target.value)}
                                />
                                <button className="retry-btn" onClick={applyManualAddress}>Use Address</button>
                            </div>
                        </div>
                    )}
                    {loadError === 'SCRIPT_LOAD_FAIL' && (
                        <div className="map-error-overlay">
                            <span className="error-icon">⚠️</span>
                            <h3>Connection Error</h3>
                            <p>Failed to load Google Maps. Please check your internet connection or API key restrictions.</p>
                            <div className="manual-entry">
                                <input
                                    type="text"
                                    className="map-search-input"
                                    placeholder="Enter city or address"
                                    value={manualAddress}
                                    onChange={(e) => setManualAddress(e.target.value)}
                                />
                                <button className="retry-btn" onClick={applyManualAddress}>Use Address</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="map-controls">
                    <div className="radius-control">
                        <div className="radius-label-row">
                            <label>Target Radius</label>
                            <span className="radius-value">{formatRadius(radius)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="100"
                            step="0.5"
                            value={radius}
                            onChange={(e) => setRadius(parseFloat(e.target.value))}
                            className="radius-slider"
                        />
                        <div className="radius-markers">
                            <span>500m</span>
                            <span>50 km</span>
                            <span>100 km</span>
                        </div>
                    </div>

                    <div className="selected-info">
                        <strong>Selected Area:</strong>
                        <p>{selectedArea.address}</p>
                        <p className="coordinates">
                            Lat: {selectedArea.lat.toFixed(4)}, Lng: {selectedArea.lng.toFixed(4)}
                        </p>
                    </div>
                </div>

                <div className="map-modal-actions">
                    <button className="secondary-btn" onClick={onClose}>Cancel</button>
                    <button className="primary-btn" onClick={handleConfirm}>✓ Done</button>
                </div>
            </div>
        </div>
    );
};

export default MapSelector;
