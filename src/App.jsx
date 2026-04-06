import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DailyView from './components/DailyView';
import WeeklyReport from './components/WeeklyReport';
import TodoView from './components/TodoView';
import CalendarView from './components/CalendarView';
import ContentView from './components/ContentView';
import { Home, CheckSquare, Calendar, Sparkles, MoreHorizontal } from 'lucide-react';
import { getActiveDateString } from './utils/date';
import { performRollover } from './utils/storage';

function App() {
  const [selectedDateStr, setSelectedDateStr] = useState(getActiveDateString());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentTab, setCurrentTab] = useState('habit');

  // Todo sayfası için ayrı tarih state'i
  const [todoDateStr, setTodoDateStr] = useState(getActiveDateString());
  const [todoRefresh, setTodoRefresh] = useState(0);

  // Calendar sayfası için ayrı tarih state'i
  const [calDateStr, setCalDateStr] = useState(getActiveDateString());
  const [calRefresh, setCalRefresh] = useState(0);

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

  const handleCalDataChange = () => {
    setCalRefresh(prev => prev + 1);
  };

  const handleCalSelectDate = (dateStr) => {
    setCalDateStr(dateStr);
  };

  // Listen for calendar month modal date selection
  useEffect(() => {
    const handler = (e) => setCalDateStr(e.detail);
    window.addEventListener('calendarDateSelect', handler);
    return () => window.removeEventListener('calendarDateSelect', handler);
  }, []);

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

      {currentTab === 'calendar' && (
        <>
          <Header 
            selectedDateStr={calDateStr} 
            onSelectDate={handleCalSelectDate} 
            refreshTrigger={calRefresh}
            mode="calendar"
          />
          <div className="main-content">
            <CalendarView 
              selectedDateStr={calDateStr}
              onDataChange={handleCalDataChange}
            />
          </div>
        </>
      )}

      {currentTab === 'content' && (
        <div className="main-content">
          <ContentView />
        </div>
      )}

      {currentTab === 'page5' && (
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
        <button className={`bottom-nav-item ${currentTab === 'calendar' ? 'active' : ''}`} onClick={() => setCurrentTab('calendar')}>
          <Calendar size={24} />
          <span>Takvim</span>
        </button>
        <button className={`bottom-nav-item ${currentTab === 'content' ? 'active' : ''}`} onClick={() => setCurrentTab('content')}>
          <Sparkles size={24} />
          <span>Content</span>
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
