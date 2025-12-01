
import React, { useState, useEffect } from 'react';
import { WateringSchedule } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ResultDisplayProps {
  data: WateringSchedule;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ data }) => {
  // Initialize with AI recommendation
  const [daysPerWeek, setDaysPerWeek] = useState<number>(data.recommendedFrequencyDaysPerWeek || 3);
  
  // Derived calculations
  const totalWeeklyMinutes = data.totalWeeklyWaterDurationMinutes;
  const dailyTotalMinutes = Math.ceil(totalWeeklyMinutes / daysPerWeek);
  
  // Cycle Logic (Scientific)
  // Number of cycles = Daily Need / Max Run Time (soil capacity)
  // If Daily Need < Max Run Time, Cycles = 1.
  const rawCycles = Math.ceil(dailyTotalMinutes / data.maxRunTimePerCycle);
  const cyclesPerDay = Math.max(1, rawCycles); 
  const minutesPerCycle = Math.ceil(dailyTotalMinutes / cyclesPerDay);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDaysPerWeek(parseInt(e.target.value));
  };

  return (
    <div className="animate-fade-in-up pb-10">
      <div className="border-t border-gray-200 pt-8 mt-2">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
                {data.zoneName}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 uppercase tracking-wider">
                {data.averageET}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800">Irrigation Schedule</h2>
            <p className="text-sm text-slate-500 mt-1">
              Based on historical weather data for this zip code, soil type, and terrain.
            </p>
          </div>
        </div>

        {/* Environmental Context Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 bg-slate-50 rounded-xl p-4 border border-slate-100">
           <div>
             <span className="block text-xs font-bold text-slate-400 uppercase">Est. Weekly ET</span>
             <span className="text-lg font-semibold text-slate-700">{data.averageET}</span>
             <p className="text-[10px] text-slate-500 mt-1 leading-tight border-t border-slate-200 pt-1">
               {data.climateSummary}
             </p>
           </div>
           <div>
             <span className="block text-xs font-bold text-slate-400 uppercase">Soil Intake</span>
             <span className="text-lg font-semibold text-slate-700">{data.soilInfiltrationRate}</span>
           </div>
           <div>
             <span className="block text-xs font-bold text-slate-400 uppercase">Nozzle Output</span>
             <span className="text-lg font-semibold text-slate-700">{data.nozzlePrecipitationRate}</span>
           </div>
           <div>
             <span className="block text-xs font-bold text-slate-400 uppercase">Slope Limit</span>
             <span className="text-lg font-semibold text-slate-700">{data.maxRunTimePerCycle} min</span>
           </div>
           <div>
             <span className="block text-xs font-bold text-slate-400 uppercase">Rain Offset</span>
             <span className="text-lg font-semibold text-slate-700">{data.rainfallOffset || "N/A"}</span>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Main Interactive Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-brand-100 shadow-sm overflow-hidden">
            <div className="bg-brand-50 p-6 border-b border-brand-100">
              <h3 className="text-brand-800 font-bold uppercase tracking-wide text-xs mb-4">
                Interactive Scheduler
              </h3>
              
              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                   <label className="text-sm font-semibold text-slate-700">Days per week to water:</label>
                   <span className="text-2xl font-bold text-brand-600">{daysPerWeek} Days</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="7" 
                  value={daysPerWeek} 
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-brand-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
                <div className="flex justify-between text-xs text-brand-400 mt-1 font-medium">
                  <span>1 Day (Rare)</span>
                  <span>7 Days (Daily)</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg border border-brand-100 text-sm text-brand-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>
                  Total Weekly Requirement: <strong>{data.totalWeeklyWaterDurationMinutes} minutes</strong>. 
                  Adjust frequency to match plant health; high heat may require 3-4 days.
                </p>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                  <h4 className="text-slate-400 font-bold text-xs uppercase mb-2">Daily Runtime</h4>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-800">{dailyTotalMinutes}</span>
                    <span className="text-lg font-medium text-slate-500">min / day</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Total water applied on scheduled days.
                  </p>
                </div>

                <div className="relative pl-6 border-l-2 border-slate-100">
                  <h4 className="text-slate-400 font-bold text-xs uppercase mb-2">Cycle & Soak Strategy</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-brand-600">{cyclesPerDay}</span>
                        <span className="text-[10px] uppercase font-bold text-brand-400">Cycles</span>
                      </div>
                      <div className="h-8 w-px bg-slate-200"></div>
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-brand-600">{minutesPerCycle}</span>
                        <span className="text-[10px] uppercase font-bold text-brand-400">Min Each</span>
                      </div>
                    </div>
                  </div>

                  {cyclesPerDay > 1 ? (
                     <div className="mt-3">
                        <div className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded font-medium border border-blue-100">
                           <span className="font-bold">Protocol:</span> Run {minutesPerCycle}m ➔ Soak {data.recommendedSoakTime}m ➔ Repeat
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          *Multi-cycling prevents runoff on this soil/slope.
                        </p>
                     </div>
                  ) : (
                    <div className="mt-3 inline-block bg-green-50 text-green-700 text-xs px-2 py-1 rounded font-medium border border-green-100">
                       ✓ Standard Single Cycle (No runoff risk)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Column */}
          <div className="space-y-6">
             <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-slate-400 font-semibold mb-3 text-xs uppercase tracking-wide">Pressure Check</h3>
                <div className={`p-3 rounded-lg border flex gap-3 ${
                   data.pressureAdvice.toLowerCase().includes('ideal') || data.pressureAdvice.toLowerCase().includes('good')
                   ? 'bg-green-50 border-green-100 text-green-800'
                   : 'bg-amber-50 border-amber-100 text-amber-800'
                }`}>
                   <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                   <p className="text-sm font-medium leading-snug">{data.pressureAdvice}</p>
                </div>
             </div>

             <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-slate-400 font-semibold mb-3 text-xs uppercase tracking-wide">Maintenance</h3>
                <div className="flex items-center gap-2 mb-2">
                   <div className={`w-3 h-3 rounded-full ${
                     data.difficulty === 'Easy' ? 'bg-green-500' : 
                     data.difficulty === 'Moderate' ? 'bg-yellow-500' : 'bg-red-500'
                   }`}></div>
                   <span className="font-semibold text-slate-700">{data.difficulty} Level</span>
                </div>
                <p className="text-xs text-slate-500">{data.sunlightNeeds}</p>
             </div>

             {data.mowingAdvice && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                   <h3 className="text-slate-400 font-semibold mb-3 text-xs uppercase tracking-wide">Mowing & Health</h3>
                   <div className="flex gap-3 items-start">
                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.8-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.35"></path></svg>
                     <p className="text-sm text-slate-700 leading-snug">{data.mowingAdvice}</p>
                   </div>
                </div>
             )}
          </div>
        </div>

        {/* Forecast & Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div>
              <h3 className="text-slate-400 font-semibold mb-4 text-xs uppercase tracking-wide">Soil Moisture Projection</h3>
              <div className="h-64 w-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.moistureCurveData}>
                    <defs>
                      <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} tickFormatter={(v) => `Day ${v}`}/>
                    <YAxis hide domain={[0, 100]}/>
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                      itemStyle={{color: '#2563eb', fontWeight: 600}}
                      formatter={(value: number) => [`${value}%`, 'Moisture']}
                    />
                    <Area type="monotone" dataKey="moistureLevel" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorMoisture)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div>
              <h3 className="text-slate-400 font-semibold mb-4 text-xs uppercase tracking-wide">Specialist Recommendations</h3>
              <ul className="space-y-3">
                {data.tips.map((tip, idx) => (
                  <li key={idx} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-gray-100 shadow-sm transition-hover hover:border-brand-200">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-600 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
};
