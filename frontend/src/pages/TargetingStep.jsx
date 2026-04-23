import React, { useEffect, useMemo, useState } from 'react';
import LogicCard from '../components/LogicCard';
import MagicButton from '../components/MagicButton';
import MapSelector from '../components/MapSelector';
import { useLocation, Link } from 'react-router-dom';
import { countries } from '../data/countries';
import { languages } from '../data/languages';
import { useCampaign } from '../context/CampaignContext';
import './TargetingStep.css';

const TargetingStep = () => {
    const location = useLocation();
    const {
        strategyData,
        targetingPlan,
        setStrategyData,
        setTargetingPlan
    } = useCampaign();
    const fallbackStrategy = location.state?.strategyData;

    // State for inputs
    const [country, setCountry] = useState('US');
    const [language, setLanguage] = useState('en');
    const [mapLocation, setMapLocation] = useState(null);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [ageRange, setAgeRange] = useState({ min: 18, max: 65 });
    const [gender, setGender] = useState('All');
    const [interests, setInterests] = useState([]);
    const [interestInput, setInterestInput] = useState('');
    const [audiencePreference, setAudiencePreference] = useState(
        targetingPlan?.audiencePreference || 'Broad'
    );

    // List of added { target, audience } sets
    const [targetAudienceList, setTargetAudienceList] = useState(
        targetingPlan?.targetSets || []
    );

    useEffect(() => {
        if (fallbackStrategy && !strategyData) {
            setStrategyData(fallbackStrategy);
        }
    }, [fallbackStrategy, setStrategyData, strategyData]);

    const handleInterestAdd = (e) => {
        if (e.key === 'Enter' && interestInput.trim()) {
            setInterests([...interests, interestInput.trim()]);
            setInterestInput('');
        }
    };

    const removeInterest = (index) => {
        setInterests(interests.filter((_, i) => i !== index));
    };

    const handleMapSelect = (selectedArea) => {
        setMapLocation(selectedArea);
    };

    const getCountryName = (code) => {
        const c = countries.find(c => c.code === code);
        return c ? c.name : code;
    };

    const getLanguageName = (code) => {
        const l = languages.find(l => l.code === code);
        return l ? l.name : code;
    };

    const formatRadius = (radiusKm) => {
        if (!radiusKm) return '';
        if (radiusKm < 1) {
            return `${Math.round(radiusKm * 1000)}m radius`;
        }
        return `${radiusKm}km radius`;
    };

    const estimatedBreadth = useMemo(() => {
        const interestCount = interests.length + (interestInput.trim() ? 1 : 0);
        if (interestCount >= 4) return 'Small';
        if (interestCount >= 2) return 'Medium';
        return 'Large';
    }, [interests, interestInput]);

    // Add current set to list
    const handleAddSet = () => {
        const currentInterests = [...interests];
        if (interestInput.trim()) {
            currentInterests.push(interestInput.trim());
        }

        const newSet = {
            id: Date.now(),
            target: {
                country,
                countryName: getCountryName(country),
                language,
                languageName: getLanguageName(language),
                mapLocation
            },
            audience: {
                ageRange: { ...ageRange },
                gender,
                interests: currentInterests,
                preference: audiencePreference,
                breadth: estimatedBreadth
            }
        };

        setTargetAudienceList([...targetAudienceList, newSet]);
        setInterests([]);
        setInterestInput('');
    };

    const handleRemoveSet = (id) => {
        setTargetAudienceList(targetAudienceList.filter(item => item.id !== id));
    };

    const handleContinue = () => {
        const targetingPlan = {
            targetSets: targetAudienceList,
            audiencePreference
        };

        setTargetingPlan(targetingPlan);
    };

    useEffect(() => {
        const nextPlan = {
            targetSets: targetAudienceList,
            audiencePreference
        };
        const current = targetingPlan || { targetSets: [], audiencePreference: '' };
        const nextSerialized = JSON.stringify(nextPlan);
        const currentSerialized = JSON.stringify({
            targetSets: current.targetSets || [],
            audiencePreference: current.audiencePreference || ''
        });

        if (nextSerialized !== currentSerialized) {
            setTargetingPlan(nextPlan);
        }
    }, [audiencePreference, setTargetingPlan, targetAudienceList, targetingPlan]);

    return (
        <div className="targeting-step fade-in">
            <div className="page-header">
                <div>
                    <h1>Targeting</h1>
                    <p className="subtext">Define audiences and targeting signals.</p>
                </div>
                {strategyData?.objective && (
                    <div className="objective-pill">
                        Strategy Objective: <strong>{strategyData.objective}</strong>
                    </div>
                )}
            </div>

            <div className="targeting-grid">
                <div className="targeting-left">
                    <div className="section-card">
                        <div className="headers-group">
                            <h3>Location & Audience</h3>
                            <p className="text-sm subtext">Configure a location and audience profile, then add it to your list.</p>
                        </div>

                        <div className="form-columns">
                            <div>
                                <h4 className="section-subtitle">Location & Language</h4>
                                <div className="form-group">
                                    <label>Country</label>
                                    <select
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="input-field"
                                    >
                                        {countries.map(c => (
                                            <option key={c.code} value={c.code}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Specific Area (Optional)</label>
                                    <button
                                        className="map-selector-btn"
                                        onClick={() => setIsMapOpen(true)}
                                    >
                                        <span className="icon">🗺️</span>
                                        {mapLocation ? 'Change Area Selection' : 'Select from Maps'}
                                    </button>
                                    {mapLocation && (
                                        <div className="selected-area-display mt-2">
                                            <div className="area-info">
                                                <div className="area-icon">📍</div>
                                                <div className="area-details">
                                                    <div className="area-name">{mapLocation.address}</div>
                                                    <div className="area-meta">
                                                        <span className="area-radius">{formatRadius(mapLocation.radius)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                className="clear-area-btn"
                                                onClick={() => setMapLocation(null)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Language</label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="input-field"
                                    >
                                        {languages.map(l => (
                                            <option key={l.code} value={l.code}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="audience-column">
                                <h4 className="section-subtitle">Audience Definition</h4>
                                <div className="form-group">
                                    <label>Age Range: {ageRange.min} - {ageRange.max}+</label>
                                    <div className="range-inputs">
                                        <input
                                            type="number"
                                            min="13" max="65"
                                            value={ageRange.min}
                                            onChange={(e) => setAgeRange({ ...ageRange, min: parseInt(e.target.value) })}
                                            className="input-field small"
                                        />
                                        <span>to</span>
                                        <input
                                            type="number"
                                            min="13" max="65"
                                            value={ageRange.max}
                                            onChange={(e) => setAgeRange({ ...ageRange, max: parseInt(e.target.value) })}
                                            className="input-field small"
                                        />
                                    </div>
                                    {ageRange.min < 18 && (
                                        <div className="helper-text">Platform policy may restrict audiences under 18.</div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Gender</label>
                                    <div className="segment-control">
                                        {['All', 'Male', 'Female'].map(g => (
                                            <button
                                                key={g}
                                                className={`segment-btn ${gender === g ? 'active' : ''}`}
                                                onClick={() => setGender(g)}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Interests / Behaviors</label>
                                    <input
                                        type="text"
                                        value={interestInput}
                                        onChange={(e) => setInterestInput(e.target.value)}
                                        onKeyDown={handleInterestAdd}
                                        className="input-field"
                                        placeholder="Type and press Enter"
                                    />
                                    <div className="tags-container">
                                        {interests.map((tag, i) => (
                                            <span key={i} className="tag">
                                                {tag} <button onClick={() => removeInterest(i)}>x</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Audience Size Preference</label>
                                    <div className="segment-control">
                                        {['Broad', 'Balanced', 'Narrow'].map(pref => (
                                            <button
                                                key={pref}
                                                className={`segment-btn ${audiencePreference === pref ? 'active' : ''}`}
                                                onClick={() => setAudiencePreference(pref)}
                                            >
                                                {pref}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="helper-text">Estimated breadth: {estimatedBreadth}</div>
                                </div>
                            </div>
                        </div>

                        <button className="add-set-btn mt-4 full-width-btn primary-outline" onClick={handleAddSet}>
                            + Add to List
                        </button>
                    </div>
                </div>

                <div className="targeting-right">
                    <div className="section-card">
                        <h3>Your Target Sets</h3>
                        {targetAudienceList.length === 0 ? (
                            <div className="empty-state">
                                <p>No target sets added yet.</p>
                                <p className="text-sm subtext">Configure the form and click "Add to List".</p>
                            </div>
                        ) : (
                            <div className="target-list">
                                {targetAudienceList.map(item => (
                                    <div key={item.id} className="target-list-item">
                                        <div className="item-header">
                                            <span className="item-title">
                                                {item.target.countryName} • {item.target.languageName}
                                            </span>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleRemoveSet(item.id)}
                                                title="Remove"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <div className="item-details">
                                            {item.target.mapLocation && (
                                                <div className="detail-row">
                                                    📍 {item.target.mapLocation.address} ({formatRadius(item.target.mapLocation.radius)})
                                                </div>
                                            )}
                                            <div className="detail-row">
                                                👥 {item.audience.gender}, {item.audience.ageRange.min}-{item.audience.ageRange.max}
                                            </div>
                                            <div className="detail-row">
                                                Preference: {item.audience.preference} • {item.audience.breadth} audience
                                            </div>
                                            {item.audience.interests.length > 0 && (
                                                <div className="detail-tags">
                                                    {item.audience.interests.map((int, i) => (
                                                        <span key={i} className="mini-tag">{int}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <div className="targeting-footer">
                {targetAudienceList.length > 0 ? (
                    <Link to="/research" className="magic-button" onClick={handleContinue}>
                        Continue to Research <span className="sparkle">✨</span>
                    </Link>
                ) : (
                    <MagicButton disabled>
                        Continue to Research
                    </MagicButton>
                )}
                <div className="helper-text">Add at least one target set before continuing.</div>
            </div>

            <MapSelector
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                onSelect={handleMapSelect}
                initialLocation={mapLocation}
            />
        </div>
    );
};

export default TargetingStep;
