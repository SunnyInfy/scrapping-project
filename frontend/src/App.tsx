import { useState } from 'react';
import { Home, Briefcase, Tag, History } from 'lucide-react';
import { RoomsView } from './pages/RoomsView';
import { HistoryView } from './pages/HistoryView';

type Tab = 'rooms' | 'jobs' | 'deals' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('rooms');

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
          <button
            className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={20} />
            <span>History</span>
          </button>
        </nav>
      </aside>
      <main className="main-content">
        {activeTab === 'rooms' && <RoomsView />}
        {activeTab === 'jobs' && <div>Jobs scraper coming soon...</div>}
        {activeTab === 'deals' && <div>Deals scraper coming soon...</div>}
        {activeTab === 'history' && <HistoryView />}
      </main>
    </div>
  );
}

export default App;
