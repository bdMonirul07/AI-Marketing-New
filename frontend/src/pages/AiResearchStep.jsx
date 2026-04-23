import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MagicButton from '../components/MagicButton';
import { useCampaign } from '../context/CampaignContext';
import './AiResearchStep.css';

const AiResearchStep = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        strategyData,
        targetingPlan,
        researchContext,
        setStrategyData,
        setTargetingPlan,
        setResearchContext
    } = useCampaign();
    const fallbackStrategy = location.state?.strategyData;
    const fallbackTargeting = location.state?.targetingPlan;
    const [step, setStep] = useState('intent'); // intent | set1 | set2
    const [intent, setIntent] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeVoiceTarget, setActiveVoiceTarget] = useState(null);
    const [voiceError, setVoiceError] = useState('');
    const recognitionRef = useRef(null);
    const activeSetterRef = useRef(null);

    // Set 1
    const [questions1, setQuestions1] = useState([]);
    const [answers1, setAnswers1] = useState({});

    // Set 2
    const [questions2, setQuestions2] = useState([]);
    const [answers2, setAnswers2] = useState({});

    const handleStage1 = async () => {
        if (!intent.trim()) return;
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5286/api/ai/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent })
            });
            const data = await response.json();
            const parsed = typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions;

            setQuestions1(parsed);
            const initial = {};
            parsed.forEach((_, i) => initial[i] = '');
            setAnswers1(initial);
            setStep('set1');
        } catch (error) {
            console.error("Stage 1 failed:", error);
            alert("Connection error. Ensure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    const handleStage2 = async () => {
        setLoading(true);
        try {
            // Format first set of Q&A for the backend context
            const summary = questions1.map((q, i) => `Q: ${q}\nA: ${answers1[i]}`).join('\n\n');

            const response = await fetch('http://localhost:5286/api/ai/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intent, researchSummary: summary })
            });
            const data = await response.json();
            const parsed = typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions;

            setQuestions2(parsed);
            const initial = {};
            parsed.forEach((_, i) => initial[i] = '');
            setAnswers2(initial);
            setStep('set2');
        } catch (error) {
            console.error("Stage 2 failed:", error);
            alert("Failed to generate follow-up questions.");
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = () => {
        const fullContext = {
            intent,
            strategyData,
            targetingPlan,
            targeting: targetingPlan?.targetSets || location.state?.targetingData || [],
            qa: [
                ...questions1.map((q, i) => ({ question: q, answer: answers1[i], set: 1 })),
                ...questions2.map((q, i) => ({ question: q, answer: answers2[i], set: 2 }))
            ]
        };

        setResearchContext(fullContext);
        navigate('/creative');
    };

    useEffect(() => {
        if (fallbackStrategy && !strategyData) {
            setStrategyData(fallbackStrategy);
        }
        if (fallbackTargeting && !targetingPlan) {
            setTargetingPlan(fallbackTargeting);
        }
    }, [fallbackStrategy, fallbackTargeting, setStrategyData, setTargetingPlan, strategyData, targetingPlan]);

    useEffect(() => {
        if (researchContext?.intent) {
            setIntent(researchContext.intent);
            return;
        }
        if (intent || !strategyData?.objective) return;
        const inputSummary = strategyData.contentInputs?.text?.trim()
            ? 'Inputs provided'
            : strategyData.contentInputs?.url?.trim()
                ? 'Reference URL provided'
                : strategyData.contentInputs?.files?.length
                    ? 'Asset files provided'
                    : 'No inputs provided';
        setIntent(`Objective: ${strategyData.objective}. ${inputSummary}.`);
    }, [intent, researchContext, strategyData]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript;
                }
            }
            if (transcript.trim()) {
                if (activeSetterRef.current) {
                    activeSetterRef.current(transcript.trim());
                }
            }
        };

        recognition.onerror = () => {
            setVoiceError('Voice input failed. Check mic permissions or try again.');
            setActiveVoiceTarget(null);
        };

        recognition.onend = () => {
            setActiveVoiceTarget(null);
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
    }, []);

    const handleVoiceToggle = (targetId, onTranscript) => {
        const recognition = recognitionRef.current;
        if (!recognition) {
            setVoiceError('Voice input is not supported in this browser.');
            return;
        }
        setVoiceError('');
        if (activeVoiceTarget === targetId) {
            recognition.stop();
            return;
        }
        try {
            activeSetterRef.current = onTranscript;
            setActiveVoiceTarget(targetId);
            recognition.start();
        } catch (error) {
            setVoiceError('Voice input is already active.');
            setActiveVoiceTarget(targetId);
        }
    };

    return (
        <div className="research-page fade-in">
            <h1 className="research-title">Research</h1>
            <p className="research-subtitle">Dynamic requirements gathering via AI-driven diagnostics.</p>

            {/* Step 1: User Intent */}
            {step === 'intent' && (
                <div className="research-card">
                    <h2 className="research-section-title">What is your campaign goal?</h2>
                    <div className="research-input-row">
                        <textarea
                            className="research-textarea with-mic"
                            placeholder="e.g. I want to increase brand awareness for my new sustainable coffee brand among Gen Z."
                            rows={8}
                            value={intent}
                            onChange={(e) => setIntent(e.target.value)}
                        />
                        <button
                            type="button"
                            className={`voice-chip ${activeVoiceTarget === 'goal' ? 'listening' : ''}`}
                            onClick={() => handleVoiceToggle('goal', (text) => {
                                setIntent((prev) => (prev ? `${prev} ${text}` : text));
                            })}
                            aria-label="Voice input for campaign goal"
                            title="Voice input"
                        >
                            🎙️
                        </button>
                    </div>
                    {voiceError && <div className="voice-input-error">{voiceError}</div>}
                    <div className="research-action-row">
                        <MagicButton onClick={handleStage1} loading={loading} disabled={!intent.trim()}>
                            Analyze Strategy
                        </MagicButton>
                    </div>
                </div>
            )}

            {/* Step 2: Set 1 Questions */}
            {step === 'set1' && (
                <div className="research-card">
                    <h2 className="research-section-title">Stage 1: Core Diagnostics</h2>
                    <div className="research-question-list">
                        {questions1.map((q, i) => (
                            <div key={i}>
                                <label className="research-question-label">{i + 1}. {q}</label>
                                <div className="research-input-row">
                                    <textarea
                                        className="research-textarea compact with-mic"
                                        rows={2}
                                        value={answers1[i] || ''}
                                        onChange={(e) => setAnswers1({ ...answers1, [i]: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        className={`voice-chip ${activeVoiceTarget === `set1-${i}` ? 'listening' : ''}`}
                                        onClick={() => handleVoiceToggle(`set1-${i}`, (text) => {
                                            setAnswers1((prev) => ({
                                                ...prev,
                                                [i]: prev[i] ? `${prev[i]} ${text}` : text
                                            }));
                                        })}
                                        aria-label="Voice input for question"
                                        title="Voice input"
                                    >
                                        🎙️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="research-action-row spaced">
                        <button onClick={() => setStep('intent')} className="research-back-btn">Back</button>
                        <MagicButton
                            onClick={handleStage2}
                            loading={loading}
                            disabled={Object.values(answers1).some(a => !a.trim())}
                        >
                            Next: Refine Details
                        </MagicButton>
                    </div>
                </div>
            )}

            {/* Step 3: Set 2 Questions */}
            {step === 'set2' && (
                <div className="research-card">
                    <h2 className="research-section-title">Stage 2: Technical & Creative Refinement</h2>
                    <div className="research-question-list">
                        {questions2.map((q, i) => (
                            <div key={i}>
                                <label className="research-question-label alt">{i + 6}. {q}</label>
                                <div className="research-input-row">
                                    <textarea
                                        className="research-textarea compact with-mic"
                                        rows={2}
                                        value={answers2[i] || ''}
                                        onChange={(e) => setAnswers2({ ...answers2, [i]: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        className={`voice-chip ${activeVoiceTarget === `set2-${i}` ? 'listening' : ''}`}
                                        onClick={() => handleVoiceToggle(`set2-${i}`, (text) => {
                                            setAnswers2((prev) => ({
                                                ...prev,
                                                [i]: prev[i] ? `${prev[i]} ${text}` : text
                                            }));
                                        })}
                                        aria-label="Voice input for question"
                                        title="Voice input"
                                    >
                                        🎙️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="research-action-row spaced">
                        <button onClick={() => setStep('set1')} className="research-back-btn">Back</button>
                        <MagicButton
                            onClick={handleFinalSubmit}
                            loading={loading}
                            disabled={Object.values(answers2).some(a => !a.trim())}
                        >
                            Finalize & Create Assets
                        </MagicButton>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiResearchStep;
