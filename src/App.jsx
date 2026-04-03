import React, { useState } from 'react';
import Header from './components/Header';
import DailyView from './components/DailyView';
import WeeklyReport from './components/WeeklyReport';
import { getActiveDateString } from './utils/date';

function App() {
  const [selectedDateStr, setSelectedDateStr] = useState(getActiveDateString());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDataChange = () => {
    // Triggers re-render for header and reports when data changes in DailyView
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectDate = (dateStr) => {
    setSelectedDateStr(dateStr);
  };

  return (
    <div className="app-container">
      <Header 
        selectedDateStr={selectedDateStr} 
        onSelectDate={handleSelectDate} 
        refreshTrigger={refreshTrigger}
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
        
        {/* Bugüne Dön Butonu (Eğer seçili gün bugün değilse göster) */}
        {selectedDateStr !== getActiveDateString() && (
          <button 
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--accent-color)',
              background: 'rgba(57, 255, 20, 0.1)',
              color: 'var(--accent-color)',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: 'pointer',
              marginTop: '10px'
            }}
            onClick={() => setSelectedDateStr(getActiveDateString())}
          >
            Bugüne Dön
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
