import React from 'react';

const StyleGuide = () => {
    return (
        <div className="style-guide fade-in">
            <section className="guide-section">
                <h1>GenZ Style Guide</h1>
                <p className="subtext">A preview of components and design tokens used in this application.</p>
            </section>

            <section className="guide-section">
                <h2>Colors & Themes</h2>
                <div className="color-grid">
                    <div className="color-swatch primary">Primary</div>
                    <div className="color-swatch accent">Accent</div>
                    <div className="color-swatch success">Success</div>
                    <div className="color-swatch surface">Surface</div>
                    <div className="color-swatch border">Border</div>
                </div>
            </section>

            <section className="guide-section">
                <h2>Typography</h2>
                <div className="typography-examples">
                    <h1>Heading 1 - Bold & Punchy</h1>
                    <h2>Heading 2 - Clean & Modern</h2>
                    <h3>Heading 3 - Subtle & Refined</h3>
                    <p>Paragraph text - Readable with good line height. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                    <span className="subtext">Subtext / Caption text</span>
                </div>
            </section>

            <section className="guide-section">
                <h2>Interactive Elements</h2>
                <div className="flex gap-4 items-center">
                    <button className="btn-primary">Primary Action</button>
                    <button className="btn-secondary">Secondary Action</button>
                    <button className="btn-outline">Outline Action</button>
                </div>
            </section>

            <section className="guide-section">
                <h2>Cards & Containers</h2>
                <div className="grid-cards">
                    <div className="demo-card">
                        <h3>Strategy Card</h3>
                        <p>Cards have soft shadows or borders depending on the theme.</p>
                        <div className="card-footer">
                            <span className="badge">Active</span>
                        </div>
                    </div>
                    <div className="demo-card elevated">
                        <h3>Elevated Card</h3>
                        <p>Used for primary highlights and focus areas.</p>
                        <div className="card-footer">
                            <span className="badge success">Verified</span>
                        </div>
                    </div>
                    <div className="demo-card glass">
                        <h3>Glass Card</h3>
                        <p>Modern glassmorphism effect for a premium feel.</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default StyleGuide;
