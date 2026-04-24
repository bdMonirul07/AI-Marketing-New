import { useEffect, useState } from 'react';
import './ThemeSelector.css';

const THEMES = [
    { value: 'executive', label: 'Executive Crimson' },
    { value: 'ocean', label: 'Ocean Slate' },
    { value: 'citrus', label: 'Citrus Glow' },
    { value: 'forest', label: 'Forest Ink' },
    { value: 'harbor', label: 'Harbor Mist' },
    { value: 'copper', label: 'Copper Clay' },
    { value: 'sage', label: 'Sage Linen' },
    { value: 'cobalt', label: 'Cobalt Sand' },
    { value: 'rose', label: 'Rose Quartz' }
];

const DEFAULT_THEME = 'executive';

const ThemeSelector = ({ className = '' }) => {
    const [theme, setTheme] = useState(DEFAULT_THEME);

    useEffect(() => {
        const savedTheme = window.localStorage.getItem('theme');
        const nextTheme = savedTheme || DEFAULT_THEME;
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
    }, []);

    const handleChange = (event) => {
        const nextTheme = event.target.value;
        setTheme(nextTheme);
        window.localStorage.setItem('theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
    };

    return (
        <div className={`theme-switcher ${className}`.trim()}>
            <label className="theme-label" htmlFor="theme-select">Theme</label>
            <select id="theme-select" className="theme-select" value={theme} onChange={handleChange}>
                {THEMES.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default ThemeSelector;
