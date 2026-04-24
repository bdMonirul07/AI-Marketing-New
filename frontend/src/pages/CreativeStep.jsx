import React, { useEffect, useMemo, useState } from 'react';
import { useCampaign } from '../context/CampaignContext';
import './CreativeStep.css';

const PROVIDERS = ['Nano Banana', 'xAI', 'Veo', 'Gemini', 'Sora'];
const ASSET_TYPES = ['Photo', 'Video', 'Post'];

const DEFAULT_LIBRARY = {
    uploadedAssets: [],
    generatedAssets: [],
    requirements: { photos: 1, videos: 2, posts: 0 },
    providers: ['Gemini'],
    notes: ''
};

const CreativeStep = () => {
    const {
        researchContext,
        creativeLibrary,
        setCreativeLibrary,
        selectedAsset,
        setSelectedAsset
    } = useCampaign();

    const initialLibrary = creativeLibrary || DEFAULT_LIBRARY;

    const [uploadedAssets, setUploadedAssets] = useState(initialLibrary.uploadedAssets || []);
    const [generatedAssets, setGeneratedAssets] = useState(initialLibrary.generatedAssets || []);
    const [requirements, setRequirements] = useState(initialLibrary.requirements || DEFAULT_LIBRARY.requirements);
    const [providers, setProviders] = useState(initialLibrary.providers || DEFAULT_LIBRARY.providers);
    const [notes, setNotes] = useState(initialLibrary.notes || researchContext?.intent || '');
    const [autoNotes, setAutoNotes] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [urlValue, setUrlValue] = useState('');
    const [urlType, setUrlType] = useState('Link');

    useEffect(() => {
        setGeneratedAssets((prev) => {
            let changed = false;
            const cleaned = prev.map((item) => {
                const { notes, ...rest } = item;
                const next = { ...rest };
                if (notes) {
                    changed = true;
                }
                if (next.type !== 'Post' && typeof next.contentText === 'string' && next.contentText.startsWith('Brief:')) {
                    next.contentText = '';
                    changed = true;
                }
                return next;
            });
            return changed ? cleaned : prev;
        });
    }, []);

    const buildBrief = (context) => {
        if (!context) return '';
        const objectiveLine = context.strategyData?.objective
            ? `Objective: ${context.strategyData.objective}`
            : context.intent
                ? `Objective: ${context.intent}`
                : 'Objective: TBD';
        const targetSets = context.targetingPlan?.targetSets || context.targeting || [];
        const targetingLines = targetSets.length
            ? targetSets.map((t) => {
                const age = t.audience?.ageRange ? `${t.audience.ageRange.min}-${t.audience.ageRange.max}` : 'All ages';
                const gender = t.audience?.gender || 'All';
                return `- ${t.target?.countryName || t.target?.country || 'Global'} (${gender}, ${age})`;
            }).join('\n')
            : '- Global';
        const qaLines = context.qa?.length
            ? context.qa.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')
            : 'Q: Key insight\nA: TBD';
        return [
            objectiveLine,
            '',
            'Targeting:',
            targetingLines,
            '',
            'Research Highlights:',
            qaLines
        ].join('\n');
    };

    useEffect(() => {
        const nextAuto = buildBrief(researchContext);
        if (!nextAuto) return;
        setAutoNotes(nextAuto);
        setNotes(nextAuto);
    }, [researchContext]);

    useEffect(() => {
        const nextLibrary = {
            uploadedAssets,
            generatedAssets,
            requirements,
            providers,
            notes
        };

        const current = creativeLibrary || DEFAULT_LIBRARY;
        const currentSerialized = JSON.stringify({
            uploadedAssets: current.uploadedAssets || [],
            generatedAssets: current.generatedAssets || [],
            requirements: current.requirements || DEFAULT_LIBRARY.requirements,
            providers: current.providers || DEFAULT_LIBRARY.providers,
            notes: current.notes || ''
        });
        const nextSerialized = JSON.stringify(nextLibrary);

        if (currentSerialized !== nextSerialized) {
            setCreativeLibrary(nextLibrary);
        }
    }, [creativeLibrary, generatedAssets, notes, providers, requirements, setCreativeLibrary, uploadedAssets]);

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        const nextItems = files.map((file) => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isPdf = file.type === 'application/pdf';
            const type = isImage ? 'Photo' : isVideo ? 'Video' : isPdf ? 'PDF' : 'File';
            return {
                id: `${file.name}-${Date.now()}`,
                name: file.name,
                type,
                source: 'Upload'
            };
        });

        setUploadedAssets((prev) => [...prev, ...nextItems]);
        event.target.value = '';
    };

    const handleAddUrl = () => {
        if (!urlValue.trim()) return;
        const next = {
            id: `${urlValue}-${Date.now()}`,
            name: urlValue.trim(),
            type: urlType,
            source: 'URL'
        };
        setUploadedAssets((prev) => [...prev, next]);
        setUrlValue('');
    };

    const handleRemoveUploaded = (id) => {
        setUploadedAssets((prev) => prev.filter((item) => item.id !== id));
    };

    const toggleProvider = (provider) => {
        setProviders((prev) =>
            prev.includes(provider)
                ? prev.filter((item) => item !== provider)
                : [...prev, provider]
        );
    };

    const handleRequirementChange = (field, value) => {
        setRequirements((prev) => ({
            ...prev,
            [field]: Math.max(0, value)
        }));
    };

    const updateGenerated = (id, patch) => {
        setGeneratedAssets((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
        );
    };

    const runWithConcurrency = async (tasks, limit = 3) => {
        const results = [];
        let index = 0;
        const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
            while (index < tasks.length) {
                const currentIndex = index;
                index += 1;
                results[currentIndex] = await tasks[currentIndex]();
            }
        });
        await Promise.all(workers);
        return results;
    };

    const generateAssets = async () => {
        const totalNeeded = requirements.photos + requirements.videos + requirements.posts;
        if (totalNeeded === 0 || isGenerating) return;
        setIsGenerating(true);

        const providerPool = providers.length ? providers : DEFAULT_LIBRARY.providers;
        let providerIndex = 0;

        const buildItems = (count, type) =>
            Array.from({ length: count }).map((_, index) => {
                const provider = providerPool[providerIndex % providerPool.length];
                providerIndex += 1;
                return {
                    id: `${type}-${Date.now()}-${index}-${providerIndex}`,
                    title: `${type} concept ${index + 1}`,
                    type,
                    provider,
                    status: 'generating'
                };
            });

        const nextGenerated = [
            ...buildItems(requirements.photos, 'Photo'),
            ...buildItems(requirements.videos, 'Video'),
            ...buildItems(requirements.posts, 'Post')
        ];

        setGeneratedAssets((prev) => [...nextGenerated, ...prev]);

        const tasks = nextGenerated.map((item) => async () => {
            const assetType = item.type === 'Photo' ? 'image' : item.type === 'Video' ? 'video' : 'post';
            try {
                const response = await fetch('http://localhost:5286/api/campaign/creative/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                    prompt: notes || autoNotes || 'Generate creative asset.',
                    assetType
                })
            });

                if (!response.ok) {
                    const errorText = await response.text();
                    updateGenerated(item.id, { status: 'error', error: errorText || 'Generation failed.' });
                    return;
                }

                const data = await response.json();
                updateGenerated(item.id, {
                    status: 'pending',
                    contentUrl: data.contentUrl,
                    provider: data.source || item.provider,
                    promptUsed: data.promptUsed,
                    contentText: data.contentText
                });
            } catch (error) {
                updateGenerated(item.id, { status: 'error', error: 'Generation failed.' });
            }
        });

        await runWithConcurrency(tasks, 3);

        setIsGenerating(false);
    };

    const updateGeneratedStatus = (id, status) => {
        setGeneratedAssets((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status } : item))
        );
        if (status !== 'approved' && selectedAsset?.id === id) {
            setSelectedAsset(null);
        }
    };

    const setPrimaryAsset = (asset) => {
        setSelectedAsset(asset);
    };

    const openMedia = (url) => {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const summary = useMemo(() => {
        const approved = generatedAssets.filter((item) => item.status === 'approved').length;
        const pending = generatedAssets.filter((item) => item.status === 'pending' || item.status === 'generating').length;
        return { approved, pending };
    }, [generatedAssets]);

    return (
        <div className="creative-library fade-in">
            <div className="creative-header">
                <div>
                    <div className="creative-kicker">Step 4 - Creative</div>
                    <h1>Creative Library</h1>
                    <p className="subtext">
                        Manage source assets, define generation targets, and approve AI outputs before ad use.
                    </p>
                </div>
                <div className="creative-summary">
                    <div className="summary-item">
                        <span className="summary-label">Approved</span>
                        <span className="summary-value">{summary.approved}</span>
                    </div>
                    <div className="summary-item">
                        <span className="summary-label">Pending Review</span>
                        <span className="summary-value">{summary.pending}</span>
                    </div>
                </div>
            </div>

            <div className="creative-grid">
                <section className="creative-card">
                    <div className="card-header">
                        <h2>Assets</h2>
                        <span className="card-meta">Photos, videos, URLs, PDFs</span>
                    </div>

                    <div className="asset-upload">
                        <label className="field-label">Upload files</label>
                        <input
                            type="file"
                            className="input-field"
                            multiple
                            accept="image/*,video/*,application/pdf"
                            onChange={handleFileUpload}
                        />
                        <div className="helper-text">Add images, videos, or PDFs for references.</div>
                    </div>

                    <div className="asset-url">
                        <label className="field-label">Add URL</label>
                        <div className="url-row">
                            <input
                                type="url"
                                className="input-field"
                                value={urlValue}
                                onChange={(e) => setUrlValue(e.target.value)}
                                placeholder="https://example.com/creative"
                            />
                            <select
                                className="input-field compact"
                                value={urlType}
                                onChange={(e) => setUrlType(e.target.value)}
                            >
                                <option>Link</option>
                                <option>Photo</option>
                                <option>Video</option>
                                <option>PDF</option>
                            </select>
                            <button type="button" className="btn-secondary" onClick={handleAddUrl}>
                                Add
                            </button>
                        </div>
                    </div>

                    <div className="asset-list">
                        {uploadedAssets.length === 0 ? (
                            <div className="empty-state">No assets added yet.</div>
                        ) : (
                            uploadedAssets.map((item) => (
                                <div key={item.id} className="asset-item">
                                    <div>
                                        <div className="asset-title">{item.name}</div>
                                        <div className="asset-meta">{item.type} • {item.source}</div>
                                    </div>
                                    <button
                                        className="icon-btn"
                                        type="button"
                                        onClick={() => handleRemoveUploaded(item.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="creative-card">
                    <div className="card-header">
                        <h2>Generation Targets</h2>
                        <span className="card-meta">Define output volume</span>
                    </div>

                    <div className="targets-grid">
                        <div className="target-field">
                            <label className="field-label">Photos</label>
                            <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={requirements.photos}
                                onChange={(e) => handleRequirementChange('photos', Number(e.target.value))}
                            />
                        </div>
                        <div className="target-field">
                            <label className="field-label">Videos</label>
                            <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={requirements.videos}
                                onChange={(e) => handleRequirementChange('videos', Number(e.target.value))}
                            />
                        </div>
                        <div className="target-field">
                            <label className="field-label">Posts</label>
                            <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={requirements.posts}
                                onChange={(e) => handleRequirementChange('posts', Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="provider-block">
                        <label className="field-label">AI providers</label>
                        <div className="provider-grid">
                            {PROVIDERS.map((provider) => (
                                <button
                                    key={provider}
                                    type="button"
                                    className={`pill-btn ${providers.includes(provider) ? 'active' : ''}`}
                                    onClick={() => toggleProvider(provider)}
                                >
                                    {provider}
                                </button>
                            ))}
                        </div>
                        <div className="helper-text">Select one or more external AI services for generation.</div>
                    </div>

                    <div className="notes-block">
                        <label className="field-label">Generation brief</label>
                        <textarea
                            className="input-field notes"
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Describe the creative direction, tone, CTA, and product context."
                        />
                    </div>

                    <button type="button" className="btn-primary" onClick={generateAssets} disabled={isGenerating}>
                        {isGenerating ? 'Generating…' : 'Generate Assets'}
                    </button>
                </section>
            </div>

            <section className="creative-card full">
                <div className="card-header">
                    <h2>Generated Assets</h2>
                    <span className="card-meta">Review + approve before ads</span>
                </div>
                <div className="generated-toolbar">
                    <button
                        type="button"
                        className="btn-outline"
                        onClick={() =>
                            setGeneratedAssets((prev) => prev.filter((item) => item.status !== 'rejected'))
                        }
                    >
                        Clear Rejected
                    </button>
                </div>

                {generatedAssets.length === 0 ? (
                    <div className="empty-state">No generated assets yet.</div>
                ) : (
                    <div className="generated-grid">
                        {generatedAssets.map((asset) => (
                            <div key={asset.id} className={`generated-card ${asset.status}`}>
                                <div className="generated-header">
                                    <div>
                                        <div className="asset-title">{asset.title}</div>
                                        <div className="asset-meta">{asset.type} • {asset.provider}</div>
                                    </div>
                                    <span className={`status-pill ${asset.status}`}>{asset.status}</span>
                                </div>
                                <div className="generated-preview">
                                    {asset.type === 'Photo' && asset.contentUrl && (
                                        <button
                                            type="button"
                                            className="media-open"
                                            onClick={() => openMedia(asset.contentUrl)}
                                            aria-label={`Open ${asset.title} in new tab`}
                                        >
                                            <img src={asset.contentUrl} alt={asset.title} />
                                        </button>
                                    )}
                                    {asset.type === 'Video' && asset.contentUrl && (
                                        <button
                                            type="button"
                                            className="media-open"
                                            onClick={() => openMedia(asset.contentUrl)}
                                            aria-label={`Open ${asset.title} in new tab`}
                                        >
                                            <video src={asset.contentUrl} />
                                        </button>
                                    )}
                                    {asset.type === 'Post' && (
                                        <div className="post-preview">
                                            {asset.contentText || 'Generated post text will appear here.'}
                                        </div>
                                    )}
                                    {!asset.contentUrl && asset.type !== 'Post' && (
                                        <div className="post-preview">Preview pending…</div>
                                    )}
                                </div>
                                {asset.error && <div className="generated-error">{asset.error}</div>}
                                <div className="generated-actions">
                                    <button
                                        type="button"
                                        className="btn-outline"
                                        onClick={() => updateGeneratedStatus(asset.id, 'approved')}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-outline danger"
                                        onClick={() => updateGeneratedStatus(asset.id, 'rejected')}
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        disabled={asset.status !== 'approved'}
                                        onClick={() => setPrimaryAsset(asset)}
                                    >
                                        Use for Ads
                                    </button>
                                </div>
                                {selectedAsset?.id === asset.id && (
                                    <div className="selected-banner">Primary ad asset</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default CreativeStep;
