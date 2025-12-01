import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="mb-8 text-center md:text-left">
      <div className="inline-flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Simplified Irrigation Calculator</h1>
      </div>
      <p className="text-slate-500 text-sm max-w-lg">
        Configure your watering zones based on plant type, nozzle specifications, and water pressure for an optimized schedule.
      </p>
    </header>
  );
};