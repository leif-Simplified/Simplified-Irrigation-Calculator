
export enum Difficulty {
  EASY = 'Easy',
  MODERATE = 'Moderate',
  HARD = 'Hard'
}

export interface PlantFormData {
  customZoneName?: string;
  zoneType: string;
  zoneAreaSqFt?: string;
  mowingHeight?: string; // New field for Turf height
  location: string;
  zipCode: string;
  month: string;
  estWeeklyEt?: string;
  estWeeklyRain?: string;
  nozzleType: string;
  pressure: number | '';
  efficiency?: string; // New field for manual efficiency adjustment
  soilType: string;
  slope: string;
  sunlight: string;
  waterSource: string; 
  waterPrice?: string; // Price per 1000 gallons
  image?: File | null;
}

export interface LiveCalculation {
  precipRate: number;
  weeklyTotalMinutes: number;
  suggestedFrequency: number;
  dailyRunTime: number;
  maxRunTime: number;
  recommendedSoakTime: number;
  cyclesPerDay: number;
  minutesPerCycle: number;
  inchesAppliedPerDay: number; // New field
  isEstData: boolean;
  efficiency: number;
}

export interface SavedZone {
  id: string;
  name: string;
  stats: LiveCalculation;
  formData: PlantFormData;
  timestamp: number;
}

export interface WateringSchedule {
  zoneName: string;
  scientificName: string;
  
  // Dynamic Calculation Data
  totalWeeklyWaterDurationMinutes: number;
  maxRunTimePerCycle: number;
  recommendedSoakTime: number;
  recommendedFrequencyDaysPerWeek: number;
  
  // Consumption & Cost
  estimatedGallonsPerWeek?: number;
  estimatedCostPerMonth?: string;
  
  // Environmental Data
  averageET: string;
  climateSummary: string;
  rainfallOffset: string;
  soilInfiltrationRate: string;
  nozzlePrecipitationRate: string;
  
  // Descriptions
  sunlightNeeds: string;
  difficulty: Difficulty;
  tips: string[];
  mowingAdvice?: string; // New advice field
  warning?: string;
  pressureAdvice: string;
  humidityPreference: string;
  
  moistureCurveData: { day: number; moistureLevel: number }[];
}

export interface AppState {
  savedZones: SavedZone[];
  formData: PlantFormData;
  loading: boolean;
  weatherLoading: boolean; 
  result: WateringSchedule | null;
  error: string | null;
  editingId: string | null;
}
