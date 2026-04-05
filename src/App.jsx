import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DailyView from './components/DailyView';
import WeeklyReport from './components/WeeklyReport';
import TodoView from './components/TodoView';
import { Home, CheckSquare, Component, Activity, MoreHorizontal } from 'lucide-react';
import { getActiveDateString } from './utils/date';
import { performRollover } from './utils/storage';

function App() {
  const [selectedDateStr, setSelectedDateStr] = useState(getActiveDateString());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentTab, setCurrentTab] = useState('habit');

  // Todo sayfası için ayrı tarih state'i
  const [todoDateStr, setTodoDateStr] = useState(getActiveDateString());
  const [todoRefresh, setTodoRefresh] = useState(0);

  // Rollover: App ilk açılışta
  useEffect(() => {
    performRollover(getActiveDateString());
  }, []);

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleTodoDataChange = () => {
    setTodoRefresh(prev => prev + 1);
  };

  const handleSelectDate = (dateStr) => {
    setSelectedDateStr(dateStr);
  };

  const handleTodoSelectDate = (dateStr) => {
    setTodoDateStr(dateStr);
  };

  return (
    <div className="app-container">
      {currentTab === 'habit' && (
        <>
          <Header 
            selectedDateStr={selectedDateStr} 
            onSelectDate={handleSelectDate} 
            refreshTrigger={refreshTrigger}
            mode="habit"
          />
          
          <div className="main-content">
            <DailyView 
              selectedDateStr={selectedDateStr} 
              onDataChange={handleDataChange} 
            />
            
            <WeeklyReport 
              selectedDateStr={selectedDateStr} 
              refreshTrigger={refreshTrigger}
            />
            
            {selectedDateStr !== getActiveDateString() && (
              <button 
                style={{
                  padding: '16px', borderRadius: '12px', border: '1px solid var(--accent-color)',
                  background: 'rgba(57, 255, 20, 0.1)', color: 'var(--accent-color)',
                  fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px'
                }}
                onClick={() => setSelectedDateStr(getActiveDateString())}
              >
                Bugüne Dön
              </button>
            )}
          </div>
        </>
      )}

      {currentTab === 'todo' && (
        <>
          <Header 
            selectedDateStr={todoDateStr} 
            onSelectDate={handleTodoSelectDate} 
            refreshTrigger={todoRefresh}
            mode="todo"
          />
          <div className="main-content">
            <TodoView 
              selectedDateStr={todoDateStr}
              onDataChange={handleTodoDataChange}
            />
          </div>
        </>
      )}

      {['page3', 'page4', 'page5'].includes(currentTab) && (
        <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <h2 style={{color: 'var(--text-muted)'}}>Yeni Sayfa Tasarımı</h2>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="bottom-nav">
        <button className={`bottom-nav-item ${currentTab === 'habit' ? 'active' : ''}`} onClick={() => setCurrentTab('habit')}>
          <Home size={24} />
          <span>Habit</span>
        </button>
        <button className={`bottom-nav-item ${currentTab === 'todo' ? 'active' : ''}`} onClick={() => setCurrentTab('todo')}>
          <CheckSquare size={24} />
          <span>To-Do</span>
        </button>
        <button className={`bottom-nav-item ${currentTab === 'page3' ? 'active' : ''}`} onClick={() => setCurrentTab('page3')}>
          <Component size={24} />
          <span>Extra</span>
        </button>
        <button className={`bottom-nav-item ${currentTab === 'page4' ? 'active' : ''}`} onClick={() => setCurrentTab('page4')}>
          <Activity size={24} />
          <span>Stats</span>
        </button>
        <button className={`bottom-nav-item ${currentTab === 'page5' ? 'active' : ''}`} onClick={() => setCurrentTab('page5')}>
          <MoreHorizontal size={24} />
          <span>More</span>
        </button>
      </div>
    </div>
  );
}

export default App;
