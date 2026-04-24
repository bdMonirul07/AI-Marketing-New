import { NavLink, Outlet, Link } from 'react-router-dom';
import ThemeSelector from './ThemeSelector';
import CmoChatbot from './CmoChatbot';
import './CmoLayout.css';
import '../pages/cmo/CmoShared.css';

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/cmo' },
    { label: 'Budget', path: '/cmo/budget' },
    { label: 'Approvals', path: '/cmo/approvals' },
    { label: 'Notifications', path: '/cmo/notifications' },
    { label: 'Platform Admin', path: '/cmo/platform-admin' },
    { label: 'Calendar', path: '/cmo/calendar' },
    { label: 'Brand Guideline', path: '/cmo/brand-guideline' },
    { label: 'Creative Assets', path: '/cmo/creative-assets' },
    { label: 'Marketing Expert', path: '/cmo/marketing-expert' },
    { label: 'Targeting', path: '/cmo/targeting' },
    { label: 'Campaign Research & Strategy', path: '/cmo/research' },
    { label: 'Querys', path: '/cmo/querys' },
    { label: 'Creative Studio', path: '/cmo/creative-studio' },
    { label: 'Execute & Launch', path: '/cmo/execute-launch' }
];

const CmoLayout = () => {
    return (
        <div className="cmo-shell">
            <aside className="cmo-sidebar">
                <div className="cmo-brand">
                    <span className="cmo-brand-mark">CMO</span>
                    <div>
                        <div className="cmo-brand-name">Command Desk</div>
                        <div className="cmo-brand-sub">Role Identity</div>
                    </div>
                </div>

                <div className="cmo-profile">
                    <div className="cmo-avatar">JA</div>
                    <div>
                    <div className="cmo-profile-name">Shafqat Ahmed</div>
                        <div className="cmo-profile-role">Chief Marketing Officer</div>
                    </div>
                </div>

                <nav className="cmo-nav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/cmo'}
                            className={({ isActive }) =>
                                `cmo-nav-link${isActive ? ' active' : ''}`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>

            <div className="cmo-main">
                <header className="cmo-topbar">
                    <div className="cmo-topbar-left">
                        <span className="cmo-env">Business Core</span>
                        <span className="cmo-divider"></span>
                        <span className="cmo-status">Live Workspace</span>
                    </div>
                    <div className="cmo-topbar-actions">
                        <Link to="/" className="cmo-link">Campaign Builder</Link>
                        <ThemeSelector className="compact" />
                    </div>
                </header>

                <main className="cmo-content">
                    <Outlet />
                </main>
                <CmoChatbot />
            </div>
        </div>
    );
};

export default CmoLayout;
