import React from 'react';
import './MagicButton.css';

const MagicButton = ({ children, onClick, disabled, loading, type = 'button' }) => {
    return (
        <button
            className="magic-button"
            onClick={onClick}
            disabled={disabled || loading}
            type={type}
        >
            {loading ? 'Thinking...' : children}
            {!loading && <span className="sparkle">✨</span>}
        </button>
    );
};

export default MagicButton;
