
import React, { useState } from 'react';
import { Header } from './components/Header';
import { InputForm } from './components/InputForm';
import { ResultDisplay } from './components/ResultDisplay';
import { MasterReport } from './components/MasterReport';
import { generateWateringPlan, estimateLocationWeather } from './services/geminiService';
import { AppState, PlantFormData, LiveCalculation, SavedZone } from './types';

const INITIAL_FORM_STATE: PlantFormData = {
  customZoneName: '',
  zoneType: '',
  zoneAreaSqFt: '',
  location: '',
  zipCode: '',
  month: '',
  nozzleType: '',
  pressure: '',
  efficiency: '', // Default empty, populates on nozzle select
  soilType: '',
  slope: '',
  sunlight: '',
  waterSource: 'Culinary', // Default
  waterPrice: '3.00', // Default avg for Weber/Davis counties ($/kGal)
  image: null
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<PlantFormData>(INITIAL_FORM_STATE);
  const [state, setState] = useState<Omit<AppState, 'formData'>>({
    savedZones: [],
    loading: false,
    weatherLoading: false,
    result: null,
    error: null,
    editingId: null
  });

  const handleFetchWeather = async () => {
    if (!formData.zipCode || !formData.month) {
       setState(prev => ({ ...prev, error: "Please enter a Zip Code and Month first." }));
       return;
    }
    
    setState(prev => ({ ...prev, weatherLoading: true, error: null }));
    
    try {
      const data = await estimateLocationWeather(formData.zipCode, formData.month);
      // Explicitly convert numbers to strings for form inputs
      setFormData(prev => ({
        ...prev,
        estWeeklyEt: String(data.estWeeklyEt),
        estWeeklyRain: String(data.estWeeklyRain)
      }));
      setState(prev => ({ ...prev, weatherLoading: false }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        weatherLoading: false, 
        error: "Failed to fetch weather data. You can enter values manually." 
      }));
    }
  };

  const handleEditZone = (zone: SavedZone) => {
    setFormData(zone.formData);
    setState(prev => ({ ...prev, editingId: zone.id, result: null }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAndNext = (stats: LiveCalculation) => {
    if (state.editingId) {
       // Update existing zone
       setState(prev => {
         const updatedZones = prev.savedZones.map(z => 
           z.id === prev.editingId 
           ? { 
               ...z, 
               name: formData.customZoneName || z.name, 
               stats: stats, 
               formData: { ...formData }, 
               timestamp: Date.now() 
             } 
           : z
         );
         return { ...prev, savedZones: updatedZones, editingId: null, result: null };
       });
    } else {
       // Add new zone
       const newZone: SavedZone = {
         id: Date.now().toString(),
         name: formData.customZoneName || `Zone ${state.savedZones.length + 1}`,
         stats: stats,
         formData: { ...formData },
         timestamp: Date.now()
       };
   
       setState(prev => ({
         ...prev,
         savedZones: [...prev.savedZones, newZone],
         result: null 
       }));
    }

    // Reset zone-specific fields but KEEP location data
    setFormData(prev => ({
      ...prev,
      customZoneName: '',
      zoneType: '',
      zoneAreaSqFt: '',
      nozzleType: '',
      efficiency: '', // Reset
      // pressure might be constant for system, but resetting just in case
      // soil might vary, slope might vary
      // Keep zip, month, ET, Rain, Water Source, Water Price
      image: null
    }));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetZone = () => {
      // Just clear current form without saving
      setFormData(prev => ({
        ...prev,
        customZoneName: '',
        zoneType: '',
        zoneAreaSqFt: '',
        nozzleType: '',
        efficiency: '',
        image: null
      }));
      setState(prev => ({ ...prev, result: null, editingId: null }));
  };

  const handleSubmit = async (stats: LiveCalculation | null) => {
    if (!formData.image && !formData.zoneType) {
      setState(prev => ({ ...prev, error: "Please select a zone type or upload a photo." }));
      return;
    }
    if (!formData.zipCode) {
      setState(prev => ({ ...prev, error: "Please enter a valid Zip Code." }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null, result: null }));

    try {
      const schedule = await generateWateringPlan(formData, stats);
      setState(prev => ({ ...prev, loading: false, result: schedule }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message || "An unexpected error occurred." 
      }));
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 flex justify-center items-start">
      <main className="w-full max-w-4xl bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] p-6 md:p-10 border border-slate-100">
        <Header />
        
        <div className="space-y-8">
          <InputForm 
            formData={formData}
            setFormData={setFormData}
            onFetchWeather={handleFetchWeather}
            onSubmit={handleSubmit}
            onSaveAndNext={handleSaveAndNext}
            onEditZone={handleEditZone}
            onResetZone={handleResetZone}
            savedZones={state.savedZones}
            editingId={state.editingId}
            loading={state.loading}
            weatherLoading={state.weatherLoading}
          />

          {state.error && (
             <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md flex items-center gap-3 animate-pulse">
                <span className="text-sm font-medium">{state.error}</span>
             </div>
          )}

          {state.result && <ResultDisplay data={state.result} />}
          
          {/* Master Report (Cumulative) */}
          {state.savedZones.length > 0 && (
             <MasterReport zones={state.savedZones} currentZone={state.result} />
          )}
        </div>
        
        <footer className="mt-12 text-center text-xs text-gray-400">
          <p>© 2024 Botanical AI. Powered by Google Gemini.</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
