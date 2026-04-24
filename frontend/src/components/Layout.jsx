import { Outlet, useLocation, Link, NavLink } from 'react-router-dom';
import ThemeSelector from './ThemeSelector';
import './Layout.css';

const STEPS = [
    { path: '/', label: 'Strategy' },
    { path: '/targeting', label: 'Targeting' },
    { path: '/research', label: 'Research' },
    { path: '/creative', label: 'Creative' },
    { path: '/plan', label: 'Plan' },
    { path: '/execute', label: 'Execute' }
];

const Layout = () => {
    const location = useLocation();

    const currentStepIndex = STEPS.findIndex(s => s.path === location.pathname)
        === -1 ? 0 : STEPS.findIndex(s => s.path === location.pathname);

    return (
        <div className="layout-shell">
            <header className="app-header">
                <div className="container flex items-center justify-between">
                    <Link to="/" className="logo">PRECISION AI</Link>
                    <div className="header-links">
                        <Link to="/cmo" className="header-link">CMO Dashboard</Link>
                        <ThemeSelector />
                        <div className="auth-status">BUSINESS CORE v1.0</div>
                    </div>
                </div>
            </header>

            <div className="layout-body">
                <aside className="builder-sidebar">
                    <div className="builder-sidebar-title">Campaign Builder</div>
                    <div className="builder-steps">
                        {STEPS.map((step, index) => {
                            const isActive = index === currentStepIndex;
                            const isComplete = index < currentStepIndex;
                            return (
                                <NavLink
                                    key={step.path}
                                    to={step.path}
                                    end={step.path === '/'}
                                    className={`builder-step${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}
                                >
                                    <div className="builder-step-number">
                                        {isComplete ? '✓' : index + 1}
                                    </div>
                                    <div className="builder-step-content">
                                        <span className="builder-step-label">{step.label}</span>
                                        <span className="builder-step-status">
                                            {isActive ? 'In progress' : isComplete ? 'Complete' : 'Upcoming'}
                                        </span>
                                    </div>
                                </NavLink>
                            );
                        })}
                    </div>
                </aside>

                <main className="page-content">
                    <div className="container">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
