import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    analytics,
    channels,
    comparative,
    criteria,
    microBudgets,
    microCampaigns,
    schedule
} from '../data/cmoDashboardData';
import './CmoChatbot.css';

const STARTER_MESSAGE = 'Hi! Ask me about budgets, micro-campaigns, schedules, KPIs, or performance by channel.';
const SUGGESTIONS = [
    'Which channel has the best ROAS?',
    'Show me the micro-campaign budgets.',
    'What is the total micro-campaign spend?',
    'List the evaluation criteria.',
    'What is the TikTok budget?'
];

const buildFallbackResponse = () =>
    'I can answer questions about budgets, micro-campaigns, schedules, KPIs, and channel performance.';

const CmoChatbot = ({ variant = 'launcher' }) => {
    const navigate = useNavigate();
    const isPage = variant === 'page';
    const [isOpen, setIsOpen] = useState(isPage);
    const [messages, setMessages] = useState([
        { id: 'intro', role: 'assistant', text: STARTER_MESSAGE }
    ]);
    const [input, setInput] = useState('');

    const conversation = useMemo(() => messages, [messages]);
    const contextPayload = useMemo(
        () =>
            JSON.stringify({
                channels,
                microCampaigns,
                microBudgets,
                schedule,
                criteria,
                analytics,
                comparative
            }),
        []
    );

    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const userMessage = { id: `user-${Date.now()}`, role: 'user', text: trimmed };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:5286/api/cmo/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: trimmed,
                    context: contextPayload
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Chat failed.');
            }

            const data = await response.json();
            const answer = data?.answer || buildFallbackResponse();
            const botMessage = { id: `bot-${Date.now() + 1}`, role: 'assistant', text: answer };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            const botMessage = {
                id: `bot-${Date.now() + 1}`,
                role: 'assistant',
                text: error?.message ? `Chat error: ${error.message}` : buildFallbackResponse()
            };
            setMessages((prev) => [...prev, botMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`cmo-chatbot ${isPage ? 'page' : ''}`.trim()}>
            {(isOpen || isPage) && (
                <div className={`cmo-chat-panel ${isPage ? 'full' : ''}`.trim()}>
                    <div className="cmo-chat-header">
                        <div>
                            <div className="cmo-chat-title">CMO Command Chat</div>
                            <div className="cmo-chat-sub">Powered by workspace data</div>
                        </div>
                        <div className="cmo-chat-header-actions">
                            {!isPage && (
                                <button
                                    type="button"
                                    className="cmo-chat-expand"
                                    onClick={() => navigate('/cmo/chat')}
                                    aria-label="Open chat in full screen"
                                >
                                    ⤢
                                </button>
                            )}
                            {!isPage && (
                                <button
                                    type="button"
                                    className="cmo-chat-close"
                                    onClick={() => setIsOpen(false)}
                                    aria-label="Close chat"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="cmo-chat-messages">
                        {conversation.map((message) => (
                            <div key={message.id} className={`cmo-chat-bubble ${message.role}`}>
                                {message.text}
                            </div>
                        ))}
                    </div>
                    <div className="cmo-chat-suggestions">
                        {SUGGESTIONS.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                className="cmo-chat-chip"
                                onClick={() => handleSend(suggestion)}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                    <form
                        className="cmo-chat-input"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleSend(input);
                        }}
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Ask about budgets, KPIs, or performance"
                            aria-label="Chat message"
                            disabled={isLoading}
                        />
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? 'Thinking…' : 'Send'}
                        </button>
                    </form>
                </div>
            )}
            {!isPage && (
                <button
                    type="button"
                    className="cmo-chat-launcher"
                    onClick={() => setIsOpen((prev) => !prev)}
                    aria-expanded={isOpen}
                >
                    <span className="cmo-chat-launcher-icon">💬</span>
                    <span>Chat</span>
                </button>
            )}
        </div>
    );
};

export default CmoChatbot;
