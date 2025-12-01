
import React, { useRef, useState, useEffect } from 'react';
import { PlantFormData, LiveCalculation, SavedZone } from '../types';

interface InputFormProps {
  formData: PlantFormData;
  setFormData: React.Dispatch<React.SetStateAction<PlantFormData>>;
  onFetchWeather: () => void;
  onSubmit: (stats: LiveCalculation | null) => void;
  onSaveAndNext: (stats: LiveCalculation) => void;
  onEditZone: (zone: SavedZone) => void;
  savedZones: SavedZone[];
  editingId: string | null;
  loading: boolean;
  weatherLoading: boolean;
  onResetZone?: () => void;
}

// Precise Precipitation Rates (in/hr), Optimal Pressure, and Application Efficiency (DU)
const NOZZLE_DATA: Record<string, { rate: number, label: string, optimalPsi: number, efficiency: number }> = {
  "Fixed Spray (Generic)": { rate: 1.5, label: "Fixed Spray (Generic)", optimalPsi: 30, efficiency: 0.70 },
  "Rainbird 1800 / HE-VAN": { rate: 1.6, label: "Rainbird 1800 / HE-VAN", optimalPsi: 30, efficiency: 0.75 },
  "Hunter Pro-Spray": { rate: 1.5, label: "Hunter Pro-Spray", optimalPsi: 30, efficiency: 0.75 },
  "Hunter MP Rotator (Standard)": { rate: 0.4, label: "Hunter MP Rotator (Standard)", optimalPsi: 40, efficiency: 0.80 },
  "Hunter MP Rotator (MP800 SR)": { rate: 0.8, label: "Hunter MP Rotator (MP800 SR)", optimalPsi: 40, efficiency: 0.80 },
  "Rainbird R-VAN": { rate: 0.6, label: "Rainbird R-VAN", optimalPsi: 45, efficiency: 0.75 },
  "Rotor (Gear Drive - PGP/5000)": { rate: 0.5, label: "Rotor (Gear Drive - PGP/5000)", optimalPsi: 45, efficiency: 0.80 },
  "Rotor (Low Angle)": { rate: 0.75, label: "Rotor (Low Angle)", optimalPsi: 45, efficiency: 0.80 },
  "Drip Line (0.9 GPH - 12in Spacing)": { rate: 0.8, label: "Drip Line (0.9 GPH @ 12in)", optimalPsi: 30, efficiency: 0.90 },
  "Drip Line (0.6 GPH - 12in Spacing)": { rate: 0.5, label: "Drip Line (0.6 GPH @ 12in)", optimalPsi: 30, efficiency: 0.90 },
  "Drip Line (0.4 GPH - 12in Spacing)": { rate: 0.35, label: "Drip Line (0.4 GPH @ 12in)", optimalPsi: 30, efficiency: 0.90 },
  "Bubbler (Flood)": { rate: 12.0, label: "Bubbler (High Flow)", optimalPsi: 30, efficiency: 0.85 }, 
};

const SOIL_RATES: Record<string, number> = {
  "Sand": 2.0, "Loamy Sand": 1.5, "Sandy Loam": 0.8,
  "Loam": 0.5, "Clay Loam": 0.25, "Silty Clay": 0.15, "Clay": 0.1,
};

const SOIL_SOAK_TIMES: Record<string, number> = {
  "Sand": 0, "Loamy Sand": 0, "Sandy Loam": 15,
  "Loam": 30, "Clay Loam": 45, "Silty Clay": 60, "Clay": 60,
};

const SLOPE_FACTORS: Record<string, number> = {
  "0-15%": 1.0, "15-30%": 0.7, "30-45%": 0.5, ">45%": 0.3,
};

const ZONE_FACTORS: Record<string, number> = {
  "Cool Season Turf Grass": 0.95,
  "Warm Season Turf Grass": 0.7,
  "All Plants": 0.5,
  "Trees": 0.6,
  "Perennials": 0.5,
  "Drip": 0.5
};

const SUNLIGHT_FACTORS: Record<string, number> = {
  "Direct Sun": 1.0, "Partial Sun": 0.9, "Shade": 0.8
};

export const InputForm: React.FC<InputFormProps> = ({
  formData,
  setFormData,
  onFetchWeather,
  onSubmit,
  onSaveAndNext,
  onEditZone,
  savedZones,
  editingId,
  loading,
  weatherLoading
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [liveCalc, setLiveCalc] = useState<LiveCalculation | null>(null);
  const [manualCycles, setManualCycles] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'nozzleType') {
      // Auto-set efficiency when nozzle changes
      const nozzle = NOZZLE_DATA[value];
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        efficiency: nozzle ? (nozzle.efficiency * 100).toString() : prev.efficiency
      }));
      setManualCycles(null);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'soilType' || name === 'slope') {
        setManualCycles(null);
      }
    }
  };

  const handleNextZone = () => {
    if (liveCalc) {
      onSaveAndNext(liveCalc);
    }
  };

  const handleCycleChange = (increment: number) => {
    if (!liveCalc) return;
    const current = manualCycles !== null ? manualCycles : liveCalc.cyclesPerDay;
    const newValue = Math.max(1, Math.min(10, current + increment));
    setManualCycles(newValue);
  };

  useEffect(() => {
    if (formData.nozzleType && formData.soilType && formData.slope && formData.zoneType) {
      const nozzle = NOZZLE_DATA[formData.nozzleType];
      const soilInfiltration = SOIL_RATES[formData.soilType] || 0.5;
      const slopeFactor = SLOPE_FACTORS[formData.slope] || 1.0;
      const sunFactor = SUNLIGHT_FACTORS[formData.sunlight] || 1.0;
      
      // Use User Efficiency if provided, else Nozzle Default, else 0.75
      const efficiencyInput = parseFloat(formData.efficiency || '');
      const efficiency = !isNaN(efficiencyInput) ? efficiencyInput / 100 : (nozzle.efficiency || 0.75);
      
      let precipRate = nozzle.rate;
      if (formData.pressure) {
        const actualPsi = Number(formData.pressure);
        const optimalPsi = nozzle.optimalPsi;
        if (actualPsi > 0) {
          const pressureMultiplier = Math.sqrt(actualPsi / optimalPsi);
          const clampedMultiplier = Math.min(Math.max(pressureMultiplier, 0.5), 1.5);
          precipRate = parseFloat((nozzle.rate * clampedMultiplier).toFixed(2));
        }
      }
      
      const userEt = parseFloat(formData.estWeeklyEt || '0');
      const isEstData = !userEt;
      const baseEt = userEt || 1.25; 
      
      const plantFactor = ZONE_FACTORS[formData.zoneType] || 0.5;
      const rainOffset = parseFloat(formData.estWeeklyRain || '0');
      
      const adjustedEt = baseEt * plantFactor * sunFactor;
      const netWeeklyInches = Math.max(0, adjustedEt - rainOffset);
      
      // Effective PR = Raw PR * Efficiency. 
      // Lower efficiency = lower effective PR = Longer Run Time needed.
      const effectivePr = precipRate * efficiency;
      
      const weeklyTotalMinutes = effectivePr > 0 
        ? Math.ceil((netWeeklyInches / effectivePr) * 60) 
        : 0;

      const isSandy = formData.soilType.includes("Sand");
      const isTurf = formData.zoneType.includes("Turf");
      const mowingHeight = parseFloat(formData.mowingHeight || '3.0');

      // --- BASE FREQUENCY (Soil & Water Demand) ---
      let suggestedFrequency = 3; 
      
      if (isSandy) {
        // Sand Logic: Low holding capacity = more frequent
        suggestedFrequency = netWeeklyInches > 0.8 ? 4 : 3; 
        if (netWeeklyInches > 1.5) suggestedFrequency = 5;
      } else {
        // Clay/Loam Logic: High holding capacity = less frequent
        if (netWeeklyInches > 1.4) suggestedFrequency = 4; // High heat
        else if (netWeeklyInches > 0.7) suggestedFrequency = 3; 
        else suggestedFrequency = 2; 
      }

      // --- MOWING HEIGHT CONSTRAINT LOGIC ---
      if (isTurf) {
        if (mowingHeight < 2.0) {
           // Short turf (< 2.0") -> Can go up to 5-7 days if needed (sand/heat)
           // because roots are shallower
           if (mowingHeight <= 0.75) suggestedFrequency = 7;
           else if (mowingHeight <= 1.5) suggestedFrequency = Math.max(suggestedFrequency, 5);
           // 1.5" - 1.99": Allow up to 5 days, or use base logic
           else suggestedFrequency = Math.max(suggestedFrequency, 4);
        } else {
           // >= 2.0" -> STRICT Cap at 4 days to promote deep rooting
           // Even if hot, we want "Deep & Infrequent"
           suggestedFrequency = Math.min(suggestedFrequency, 4);
        }
      }

      suggestedFrequency = Math.max(1, Math.min(7, suggestedFrequency));

      const dailyRunTime = suggestedFrequency > 0 
        ? Math.ceil(weeklyTotalMinutes / suggestedFrequency)
        : 0;

      // Calculate inches applied per day
      // Inches = (DailyMin / 60) * EffectivePR
      const inchesAppliedPerDay = dailyRunTime > 0 
        ? parseFloat(((dailyRunTime / 60) * effectivePr).toFixed(2)) 
        : 0;

      let maxRunTime = 60;
      if (precipRate > soilInfiltration) {
        const runoffRatio = soilInfiltration / precipRate;
        maxRunTime = Math.floor(60 * runoffRatio * slopeFactor);
        maxRunTime = Math.max(3, maxRunTime);
      }

      // Auto calculation
      const cyclesPerDayCalc = Math.ceil(dailyRunTime / maxRunTime);
      const isSandCycles = isSandy && cyclesPerDayCalc < 2; 
      const autoCycles = isSandCycles ? 2 : cyclesPerDayCalc; 
      
      // Use manual override if present, otherwise auto
      const finalCyclesPerDay = manualCycles !== null ? manualCycles : autoCycles;
      
      const minutesPerCycle = finalCyclesPerDay > 0 ? Math.ceil(dailyRunTime / finalCyclesPerDay) : 0;
      const recommendedSoakTime = finalCyclesPerDay > 1 ? (SOIL_SOAK_TIMES[formData.soilType] || 0) : 0;

      setLiveCalc({
        precipRate,
        weeklyTotalMinutes,
        suggestedFrequency,
        dailyRunTime,
        maxRunTime,
        recommendedSoakTime,
        cyclesPerDay: finalCyclesPerDay,
        minutesPerCycle,
        inchesAppliedPerDay,
        isEstData,
        efficiency
      });
    } else {
      setLiveCalc(null);
    }
  }, [formData.nozzleType, formData.soilType, formData.slope, formData.zoneType, formData.estWeeklyEt, formData.estWeeklyRain, formData.pressure, formData.efficiency, formData.sunlight, formData.mowingHeight, manualCycles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, image: e.target.files![0] }));
    }
  };

  const getPressureWarning = (psi: number | '') => {
    if (psi === '') return null;
    if (psi < 50) return { type: 'warn', text: 'Low PSI reduces flow.' };
    if (psi > 85) return { type: 'warn', text: 'High PSI causes misting.' };
    return { type: 'success', text: 'PSI OK.' };
  };

  const pressureStatus = getPressureWarning(formData.pressure);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  // Warning if manual cycle adjustment causes potential runoff
  const runoffWarning = liveCalc && liveCalc.minutesPerCycle > liveCalc.maxRunTime;
  const isTurf = formData.zoneType.includes("Turf");

  return (
    <div className="mb-8">
      {/* Top Header Row with Add Next Zone Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Zone Configuration</h2>
        <button
          onClick={handleNextZone}
          disabled={!liveCalc}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1
            ${liveCalc 
              ? 'text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100' 
              : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          {editingId ? "Update & Add Next" : "Add Next Zone"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        
        {/* Name and Photo */}
        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-grow w-full">
            <label htmlFor="customZoneName" className="block text-sm font-semibold text-gray-700 mb-1">
              Zone Name <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              id="customZoneName"
              name="customZoneName"
              placeholder="e.g. Front Yard Turf"
              value={formData.customZoneName || ''}
              onChange={handleChange}
              className={`w-full px-3 py-2.5 rounded-lg border bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none 
                ${editingId ? 'border-brand-300 ring-1 ring-brand-100' : 'border-gray-300'}`}
            />
          </div>
          
          <div className="flex-shrink-0 mb-3">
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="4"/></svg>
                {formData.image ? "Change Photo" : "Add Zone Photo"}
              </button>
              {formData.image && <span className="text-xs text-green-600 block mt-0.5 truncate max-w-[120px]">✓ {formData.image.name}</span>}
          </div>
        </div>

        {/* Location & Weather */}
        <div className="md:col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <div className="flex justify-between items-center mb-3">
             <label className="block text-xs font-bold text-blue-800 uppercase">Location</label>
             <button 
               onClick={onFetchWeather}
               disabled={!formData.zipCode || !formData.month || weatherLoading}
               className={`text-xs px-3 py-1 rounded bg-white border border-blue-200 text-blue-600 font-semibold shadow-sm transition-all
                 ${!formData.zipCode || !formData.month ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 active:scale-95'}
               `}
             >
               {weatherLoading ? 'Loading...' : 'Get Weather Data'}
             </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Zip Code</label>
              <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Month</label>
              <select name="month" value={formData.month} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none">
                <option value="">Select...</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-1">
               <label className="block text-sm font-semibold text-gray-700 mb-1">Weekly ET <span className="text-gray-400 font-normal">(in)</span></label>
              <input type="number" name="estWeeklyEt" placeholder="Auto" value={formData.estWeeklyEt || ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
             <div className="col-span-1">
               <label className="block text-sm font-semibold text-gray-700 mb-1">Weekly Rain <span className="text-gray-400 font-normal">(in)</span></label>
              <input type="number" name="estWeeklyRain" placeholder="Auto" value={formData.estWeeklyRain || ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
          </div>
        </div>

        {/* Zone Details */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
           <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Zone / Plant Type</label>
            <select name="zoneType" value={formData.zoneType} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Select zone type...</option>
              <option value="Cool Season Turf Grass">Cool Season Turf Grass</option>
              <option value="Warm Season Turf Grass">Warm Season Turf Grass</option>
              <option value="All Plants">All Plants / Mixed Bed</option>
              <option value="Trees">Trees</option>
              <option value="Perennials">Perennials / Shrubs</option>
              <option value="Drip">Drip Zone</option>
            </select>
          </div>
          {isTurf ? (
            <div>
               <label className="block text-sm font-semibold text-gray-700 mb-1">Mowing Height <span className="text-gray-400 font-normal">(in)</span></label>
               <input type="number" name="mowingHeight" placeholder="e.g. 3.0" value={formData.mowingHeight || ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
          ) : (
             <div className="hidden md:block"></div>
          )}
          <div>
             <label className="block text-sm font-semibold text-gray-700 mb-1">Zone Area <span className="text-gray-400 font-normal">(sq ft)</span></label>
             <input type="number" name="zoneAreaSqFt" placeholder="e.g. 1000" value={formData.zoneAreaSqFt || ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
             <label className="block text-sm font-semibold text-gray-700 mb-1">Sunlight</label>
             <select name="sunlight" value={formData.sunlight} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Select exposure...</option>
              <option value="Direct Sun">Direct Sun (100% Rate)</option>
              <option value="Partial Sun">Partial Sun (90% Rate)</option>
              <option value="Shade">Shade (80% Rate)</option>
            </select>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              Note: Turf surrounded by large trees with heavy roots may require 'Direct Sun' setting due to root competition.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="block text-sm font-semibold text-gray-700 mb-1">Water Source</label>
               <select name="waterSource" value={formData.waterSource} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none">
                 <option value="Culinary">Culinary (Metered)</option>
                 <option value="Secondary">Secondary (Unmetered)</option>
               </select>
             </div>
             {formData.waterSource === 'Culinary' && (
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 truncate" title="Price per 1000 Gallons">Price ($) / 1,000 Gal</label>
                  <input type="number" step="0.01" name="waterPrice" value={formData.waterPrice || ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
                  <p className="text-[10px] text-gray-400 mt-1">Avg Weber/Davis: $3.00</p>
               </div>
             )}
          </div>
        </div>

        <div className="md:col-span-2 border-t border-gray-100 my-2"></div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Nozzle Type</label>
          <select name="nozzleType" value={formData.nozzleType} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none font-medium">
            <option value="">Select specific nozzle...</option>
            {Object.keys(NOZZLE_DATA).map(key => <option key={key} value={key}>{NOZZLE_DATA[key].label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Pressure (PSI)</label>
            <input type="number" name="pressure" placeholder="e.g. 60" value={formData.pressure} onChange={handleChange} className={`w-full px-3 py-2.5 rounded-lg border outline-none ${pressureStatus?.type === 'warn' ? 'border-amber-300' : 'border-gray-300'}`} />
            {pressureStatus && <p className={`text-xs mt-1.5 font-medium ${pressureStatus.type === 'warn' ? 'text-amber-600' : 'text-green-600'}`}>{pressureStatus.text}</p>}
          </div>

          <div>
             <label className="block text-sm font-semibold text-gray-700 mb-1">Head Efficiency <span className="text-gray-400 font-normal">(%)</span></label>
             <input type="number" name="efficiency" placeholder="e.g. 75" value={formData.efficiency || ''} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none" />
             <p className="text-[10px] text-gray-500 mt-1">
               Lower % = Poor spacing = Longer Run Time.
             </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Soil Type</label>
            <select name="soilType" value={formData.soilType} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Select soil texture...</option>
              <option value="Sand">Sand</option>
              <option value="Loamy Sand">Loamy Sand</option>
              <option value="Sandy Loam">Sandy Loam</option>
              <option value="Loam">Loam</option>
              <option value="Clay Loam">Clay Loam</option>
              <option value="Silty Clay">Silty Clay</option>
              <option value="Clay">Clay</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Slope</label>
            <select name="slope" value={formData.slope} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">Select slope...</option>
              <option value="0-15%">0-15%</option>
              <option value="15-30%">15-30%</option>
              <option value="30-45%">30-45%</option>
              <option value=">45%"> &gt; 45%</option>
            </select>
          </div>
        </div>

        {/* AT A GLANCE WATERING (Running Report) */}
        {(savedZones.length > 0 || liveCalc) && (
          <div className="col-span-1 md:col-span-2 mt-6 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg animate-fade-in-up text-white">
            <div className="flex items-center justify-between p-4 border-b border-slate-600 bg-slate-800/50">
               <div className="flex items-center gap-2">
                   <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
                   <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                     At A Glance Watering
                   </h3>
               </div>
               <div className="flex items-center gap-3">
                   {savedZones.length > 0 && <span className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300">Zones Built: {savedZones.length}</span>}
                   {liveCalc?.isEstData && <span className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300">Default 1.25" ET</span>}
               </div>
            </div>
            
            <div className="divide-y divide-slate-700/50">
              {/* SAVED ZONES LIST */}
              {savedZones.map((zone, idx) => (
                <div 
                  key={zone.id} 
                  onClick={() => onEditZone(zone)}
                  className={`p-3 border-b border-slate-700/50 last:border-0 transition-colors cursor-pointer group relative
                    ${editingId === zone.id ? 'bg-brand-900/30 border-l-4 border-l-brand-500' : 'bg-slate-800/40 hover:bg-slate-700/50'}`}
                >
                   {editingId === zone.id && (
                      <span className="absolute top-2 right-2 text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded font-bold uppercase shadow-sm">Editing</span>
                   )}
                   <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                         <span className="bg-slate-700 text-slate-300 text-[10px] font-mono px-1.5 py-0.5 rounded group-hover:bg-brand-700 group-hover:text-white transition-colors">{idx + 1}</span>
                         <span className="font-bold text-white text-xs">{zone.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                         <span>{zone.formData.zoneType}</span>
                         <span className="text-slate-600">•</span>
                         <span className="truncate max-w-[120px]">{zone.formData.nozzleType}</span>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-6 gap-2 text-center">
                      <div className="bg-slate-900/50 rounded py-1">
                         <span className="block text-[8px] text-slate-500 uppercase tracking-tight">Area</span>
                         <span className="text-xs text-slate-300">{zone.formData.zoneAreaSqFt || '-'}</span>
                      </div>
                      <div className="bg-slate-900/50 rounded py-1">
                         <span className="block text-[8px] text-slate-500 uppercase tracking-tight">Daily</span>
                         <span className="text-xs text-slate-300">{zone.stats.dailyRunTime}m</span>
                      </div>
                      <div className="bg-slate-900/50 rounded py-1">
                         <span className="block text-[8px] text-slate-500 uppercase tracking-tight">Freq</span>
                         <span className="text-xs text-slate-300">{zone.stats.suggestedFrequency}x</span>
                      </div>
                      <div className="bg-slate-900/50 rounded py-1">
                         <span className="block text-[8px] text-slate-500 uppercase tracking-tight">Runtime</span>
                         <span className="text-xs text-slate-300">{zone.stats.minutesPerCycle}m</span>
                      </div>
                       <div className="bg-slate-900/50 rounded py-1 border border-slate-600/50">
                         <span className="block text-[8px] text-brand-400 uppercase font-bold tracking-tight">Repeats</span>
                         <span className="text-xs text-brand-300 font-bold">{zone.stats.cyclesPerDay}x</span>
                      </div>
                      <div className="bg-slate-900/50 rounded py-1 border border-blue-500/20">
                         <span className="block text-[8px] text-blue-400 uppercase font-bold tracking-tight">In/Day</span>
                         <span className="text-xs text-blue-300 font-bold">{zone.stats.inchesAppliedPerDay}"</span>
                      </div>
                   </div>
                   {editingId !== zone.id && (
                     <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                   )}
                </div>
              ))}

              {/* CURRENT LIVE PREVIEW */}
              {liveCalc && (
                <div className="p-4 bg-slate-700/20">
                  <div className="flex items-center gap-2 mb-3">
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${editingId ? 'bg-brand-500/20 text-brand-300' : 'bg-green-500/20 text-green-300'}`}>
                        {editingId ? 'Updating Zone' : 'Active Edit'}
                     </span>
                     <span className="text-xs font-semibold text-slate-200">{formData.customZoneName || "Current Zone"}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                    <div className="bg-slate-800 p-2 rounded border border-slate-600 col-span-1">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Wkly Time</p>
                      <p className="text-base font-bold text-white">{liveCalc.weeklyTotalMinutes} <span className="text-[10px] font-normal text-slate-500">min</span></p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded border border-slate-600 col-span-1">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Daily Total</p>
                      <p className="text-base font-bold text-white">{liveCalc.dailyRunTime} <span className="text-[10px] font-normal text-slate-500">min</span></p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded border border-slate-600 col-span-1">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Freq (Days)</p>
                      <p className="text-base font-bold text-white">{liveCalc.suggestedFrequency} <span className="text-[10px] font-normal text-slate-500">/wk</span></p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded border border-slate-600 relative group col-span-1">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Cycles/Day</p>
                      <div className="flex items-center justify-center gap-2">
                         <button 
                           onClick={() => handleCycleChange(-1)}
                           className="text-slate-500 hover:text-white hover:bg-slate-600 rounded px-1 transition-colors"
                           title="Decrease cycles"
                         >-</button>
                         <p className="text-base font-bold text-white">{liveCalc.cyclesPerDay} <span className="text-[10px] font-normal text-slate-500">x</span></p>
                         <button 
                           onClick={() => handleCycleChange(1)}
                           className="text-slate-500 hover:text-white hover:bg-slate-600 rounded px-1 transition-colors"
                           title="Increase cycles"
                         >+</button>
                      </div>
                    </div>
                    <div className={`bg-slate-800 p-2 rounded border col-span-1 ${runoffWarning ? 'border-amber-500/50 bg-amber-900/10' : 'border-brand-500/50'}`}>
                      <p className={`text-[10px] uppercase font-bold ${runoffWarning ? 'text-amber-400' : 'text-brand-300'}`}>Runtime</p>
                      <p className={`text-base font-bold ${runoffWarning ? 'text-amber-400' : 'text-brand-400'}`}>
                        {liveCalc.minutesPerCycle} <span className={`text-[10px] font-normal ${runoffWarning ? 'text-amber-300/60' : 'text-brand-300/60'}`}>min</span>
                      </p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded border border-blue-500/30 col-span-1">
                       <p className="text-[10px] text-blue-400 uppercase font-bold">Inches Applied</p>
                       <p className="text-base font-bold text-blue-100">{liveCalc.inchesAppliedPerDay}" <span className="text-[10px] font-normal text-slate-500">/day</span></p>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-400 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex flex-wrap gap-3">
                      {liveCalc.cyclesPerDay > 1 ? (
                        <span className="text-brand-200">
                          <strong>Protocol:</strong> Run {liveCalc.minutesPerCycle}m ➔ Wait {liveCalc.recommendedSoakTime}m ➔ Repeat {liveCalc.cyclesPerDay}x
                        </span>
                      ) : (
                        <span className="text-green-300">✓ Single Cycle OK</span>
                      )}
                    </div>
                    {runoffWarning && (
                       <span className="text-amber-400 font-semibold flex items-center gap-1">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                         Runoff Warning: {liveCalc.minutesPerCycle}m exceeds safe limit ({liveCalc.maxRunTime}m). Increase cycles.
                       </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col md:flex-row gap-4">
        <button
          onClick={() => onSubmit(liveCalc)}
          disabled={loading}
          className={`flex-1 px-8 py-3 rounded-full text-white font-semibold text-sm tracking-wide shadow-md transition-all 
            ${loading ? 'bg-brand-500 opacity-75 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 active:scale-95'}`}
        >
          {loading ? "Analyzing..." : "Generate Full Technical Plan"}
        </button>

        <button
          onClick={handleNextZone}
          disabled={!liveCalc || loading}
          className={`px-6 py-3 rounded-full text-slate-600 bg-white border border-slate-300 font-semibold text-sm tracking-wide shadow-sm transition-all
             ${!liveCalc ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 active:scale-95'}`}
        >
          {editingId ? "Update & Add Next" : "Save & Add Next"}
        </button>
      </div>
    </div>
  );
};
