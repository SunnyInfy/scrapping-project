import { useState } from 'react';
import { Home, Briefcase, Tag } from 'lucide-react';
import { RoomsView } from './pages/RoomsView';

function App() {
  const [activeTab, setActiveTab] = useState<'rooms' | 'jobs' | 'deals'>('rooms');

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <h2>ScrapeMaster</h2>
        </div>
        <nav className="nav-menu">
          <button 
            className={`nav-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            <Home size={20} />
            <span>Rooms</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <Briefcase size={20} />
            <span>Jobs (Soon)</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'deals' ? 'active' : ''}`}
            onClick={() => setActiveTab('deals')}
          >
            <Tag size={20} />
            <span>Deals (Soon)</span>
          </button>
        </nav>
      </aside>
      <main className="main-content">
        {activeTab === 'rooms' && <RoomsView />}
        {activeTab === 'jobs' && <div>Jobs scraper coming in Phase 5...</div>}
        {activeTab === 'deals' && <div>Deals scraper coming in Phase 5...</div>}
      </main>
    </div>
  );
}

export default App;
