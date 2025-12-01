
import React from 'react';
import { SavedZone, WateringSchedule } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MasterReportProps {
  zones: SavedZone[];
  currentZone?: WateringSchedule | null;
}

export const MasterReport: React.FC<MasterReportProps> = ({ zones, currentZone }) => {
  const handlePrint = () => {
    window.print();
  };

  // Calculate totals
  let totalGallons = 0;
  let totalMonthlyCost = 0;

  const calculateZoneGallons = (z: SavedZone) => {
    if (!z.formData.zoneAreaSqFt) return 0;
    const area = parseFloat(z.formData.zoneAreaSqFt);
    const pr = z.stats.precipRate;
    const minutes = z.stats.weeklyTotalMinutes;
    // Inches applied = (minutes / 60) * pr
    const inches = (minutes / 60) * pr;
    return Math.round(inches * area * 0.623);
  };

  const savedZoneRows = zones.map(z => {
    const gallons = calculateZoneGallons(z);
    totalGallons += gallons;
    
    // Cost Logic
    let cost = 0;
    if (z.formData.waterSource === 'Secondary') {
      cost = 0;
    } else {
      // Use user-defined price per 1000 gallons (defaulting to 3.00 if missing)
      const pricePer1k = parseFloat(z.formData.waterPrice || '3.00');
      // Formula: (Gallons / 1000) * PricePer1k * 4.3 weeks/month
      cost = (gallons * 4.3 / 1000) * pricePer1k;
    }
    
    totalMonthlyCost += cost;

    return {
      name: z.name,
      area: z.formData.zoneAreaSqFt || '-',
      pr: z.stats.precipRate,
      weeklyMin: z.stats.weeklyTotalMinutes,
      freq: z.stats.suggestedFrequency,
      cycle: `${z.stats.minutesPerCycle}m x ${z.stats.cyclesPerDay}`,
      gallons: gallons,
      cost: cost,
      isSecondary: z.formData.waterSource === 'Secondary'
    };
  });

  const chartData = savedZoneRows.map(row => ({
    name: row.name.length > 10 ? row.name.substring(0, 10) + '...' : row.name, // Truncate for chart display
    fullName: row.name,
    minutes: row.weeklyMin,
    gallons: row.gallons
  }));

  return (
    <div className="mt-12 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
      <div className="bg-slate-800 p-6 flex justify-between items-center print:bg-white print:text-black print:border-b">
        <div>
          <h2 className="text-xl font-bold text-white print:text-black">Master Irrigation Report</h2>
          <p className="text-slate-400 text-sm print:text-slate-600">Cumulative Usage & Programming Guide</p>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-white text-slate-800 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-100 print:hidden"
        >
          Print Report
        </button>
      </div>

      <div className="p-0 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs border-b">
            <tr>
              <th className="px-6 py-3">Zone Name</th>
              <th className="px-6 py-3">Area (Sq Ft)</th>
              <th className="px-6 py-3">Nozzle PR</th>
              <th className="px-6 py-3">Wkly Time</th>
              <th className="px-6 py-3">Freq</th>
              <th className="px-6 py-3">Cycle Protocol</th>
              <th className="px-6 py-3">Est. Wkly Gal</th>
              <th className="px-6 py-3">Est. Mo. Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {savedZoneRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                <td className="px-6 py-4 text-slate-600">{row.area}</td>
                <td className="px-6 py-4 text-slate-600">{row.pr}"/hr</td>
                <td className="px-6 py-4 font-bold text-slate-700">{row.weeklyMin} m</td>
                <td className="px-6 py-4">{row.freq} Days</td>
                <td className="px-6 py-4 text-brand-600 font-medium">{row.cycle}</td>
                <td className="px-6 py-4 text-slate-600">{row.gallons.toLocaleString()}</td>
                <td className="px-6 py-4 text-slate-600">
                  {row.isSecondary ? <span className="text-xs text-slate-400 uppercase font-bold">Secondary</span> : `$${row.cost.toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold text-slate-700 border-t">
            <tr>
              <td className="px-6 py-4" colSpan={6}>TOTALS</td>
              <td className="px-6 py-4 text-blue-600">{totalGallons.toLocaleString()} Gal/Wk</td>
              <td className="px-6 py-4 text-green-600">${totalMonthlyCost.toFixed(2)} / Mo</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {savedZoneRows.length > 0 && (
        <div className="p-6 border-t border-slate-200 print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-700 mb-6">Zone Performance Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-80">
            {/* Runtime Chart */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center">Weekly Runtime (Minutes)</h4>
                <div className="flex-grow min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} interval={0} />
                          <YAxis tick={{fontSize: 11, fill: '#64748b'}} />
                          <Tooltip 
                            cursor={{fill: '#f1f5f9'}}
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                          />
                          <Bar dataKey="minutes" name="Minutes" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill="#3b82f6" />
                            ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Gallons Chart */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center">Weekly Consumption (Gallons)</h4>
                <div className="flex-grow min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} interval={0} />
                          <YAxis tick={{fontSize: 11, fill: '#64748b'}} />
                          <Tooltip 
                             cursor={{fill: '#f1f5f9'}}
                             contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                          />
                          <Bar dataKey="gallons" name="Gallons" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill="#10b981" />
                            ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 bg-slate-50 text-xs text-slate-500 border-t print:bg-white">
        * Cost estimates are calculated using the user-defined rate (or default ~$3.00/kGal average). Secondary water is typically billed as a flat rate ($0.00 usage cost).
      </div>
    </div>
  );
};
