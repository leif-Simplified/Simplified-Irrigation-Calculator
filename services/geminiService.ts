
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { WateringSchedule, PlantFormData, LiveCalculation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    zoneName: { type: Type.STRING },
    scientificName: { type: Type.STRING },
    totalWeeklyWaterDurationMinutes: { type: Type.NUMBER },
    maxRunTimePerCycle: { type: Type.NUMBER },
    recommendedSoakTime: { type: Type.NUMBER },
    recommendedFrequencyDaysPerWeek: { type: Type.NUMBER },
    
    estimatedGallonsPerWeek: { type: Type.NUMBER, description: "Total gallons calculated from area and weekly depth." },
    estimatedCostPerMonth: { type: Type.STRING, description: "Estimated monthly cost string (e.g. '$15.50' or 'N/A')." },

    averageET: { type: Type.STRING },
    climateSummary: { type: Type.STRING },
    rainfallOffset: { type: Type.STRING },
    soilInfiltrationRate: { type: Type.STRING },
    nozzlePrecipitationRate: { type: Type.STRING },
    sunlightNeeds: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: ["Easy", "Moderate", "Hard"] },
    humidityPreference: { type: Type.STRING },
    pressureAdvice: { type: Type.STRING },
    mowingAdvice: { type: Type.STRING, description: "Advice on mowing frequency and height." },
    tips: { type: Type.ARRAY, items: { type: Type.STRING } },
    warning: { type: Type.STRING },
    moistureCurveData: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { day: { type: Type.NUMBER }, moistureLevel: { type: Type.NUMBER } } }
    }
  },
  required: [
    "zoneName", "totalWeeklyWaterDurationMinutes", "maxRunTimePerCycle", 
    "recommendedFrequencyDaysPerWeek", "averageET", "nozzlePrecipitationRate", 
    "tips", "moistureCurveData"
  ],
};

const weatherSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    estWeeklyEt: { type: Type.NUMBER }, // Changed to NUMBER for cleaner parsing
    estWeeklyRain: { type: Type.NUMBER }, // Changed to NUMBER for cleaner parsing
    summary: { type: Type.STRING }
  },
  required: ["estWeeklyEt", "estWeeklyRain", "summary"]
};

export const estimateLocationWeather = async (zip: string, month: string) => {
  const prompt = `
    Retrieve the standard 30-year historical climate averages (NOAA/NWS equivalent data) for Zip Code ${zip} in ${month}.
    1. Get the average daily Reference Evapotranspiration (ETo).
    2. Calculate **WEEKLY** ETo (Average Daily ETo * 7).
    3. Get the average monthly rainfall.
    4. Calculate **WEEKLY** Rainfall (Average Monthly Rainfall / 4.3).
    
    Return the values as RAW NUMBERS (floats) in the JSON fields 'estWeeklyEt' and 'estWeeklyRain'. Do not include units like "inches".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: weatherSchema,
        temperature: 0,
      }
    });
    const text = response.text;
    if (!text) throw new Error("No data returned");
    return JSON.parse(text);
  } catch (error) {
    console.error("Weather Fetch Error:", error);
    throw new Error("Could not fetch weather data.");
  }
};

export const generateWateringPlan = async (data: PlantFormData, stats: LiveCalculation | null): Promise<WateringSchedule> => {
  const modelId = data.image ? 'gemini-2.5-flash-image' : 'gemini-2.5-flash';
  
  const hydraulicContext = stats ? `
    HYDRAULIC BASELINE (STRICT):
    - Net Weekly Water Need: ${stats.weeklyTotalMinutes} minutes/week.
    - Max Run Time: ${stats.maxRunTime} minutes.
    - Soak Time: ${stats.recommendedSoakTime} minutes.
    - Frequency: ${stats.suggestedFrequency} days/week.
    - Nozzle PR: ${stats.precipRate} in/hr.
    - Inches Applied Per Day: ${stats.inchesAppliedPerDay} inches.
    - Efficiency Correction: ${stats.efficiency * 100}% (User defined).
  ` : "";

  const isSecondary = data.waterSource === 'Secondary';
  const mowingInfo = data.mowingHeight ? `- Turf Mowing Height: ${data.mowingHeight} inches.` : "";

  const areaContext = data.zoneAreaSqFt ? `
    AREA DATA:
    - Zone Size: ${data.zoneAreaSqFt} Sq Ft.
    - Water Source: ${data.waterSource}.
    - Water Price: ${isSecondary ? "N/A" : "$" + (data.waterPrice || "3.00") + " per 1000 Gallons"}.
    - Task: Calculate Estimated Weekly Gallons = (NetWeeklyInches / Efficiency) * AreaSqFt * 0.623.
    - Task: Estimate Monthly Cost. 
      ${isSecondary ? "Water Source is Secondary (Unmetered/Flat Rate). Set estimatedCostPerMonth to 'N/A (Secondary)'." : 
      `Use the user-provided price per 1000 gallons ($${data.waterPrice || "3.00"}). Formula: (Weekly Gallons * 4.3 / 1000) * Rate.`}
  ` : "Area not provided. Leave gallons/cost fields 0 or empty.";

  const promptText = `
    Act as an expert hydraulic engineer and turf grass specialist.
    INPUT DATA:
    - Zone: ${data.customZoneName || data.zoneType}
    - Location: ${data.zipCode}, ${data.month}
    - Soil: ${data.soilType}, Slope: ${data.slope}
    - Nozzle: ${data.nozzleType}, PSI: ${data.pressure}
    - System Efficiency: ${data.efficiency || "Auto"}%
    - Weekly ET: ${data.estWeeklyEt || "Auto"}, Rain: ${data.estWeeklyRain || "Auto"}
    ${mowingInfo}
    
    ${hydraulicContext}
    ${areaContext}

    CALCULATION RULES:
    1. Base PR on nozzle type and pressure (square root law).
    2. Weekly Need = (ET * PlantFactor * Sun) - Rain.
    3. Frequency Logic (Root Depth Physics): 
       - Turf Height < 2.0": Shallow roots. Requires frequent watering (5-7 days) if heat/sand dictates.
       - Turf Height >= 2.0": Deep roots possible. STRICT MAX 4 days/week even in high heat to promote deep rooting ("Deep & Infrequent").
    4. Cycles: Split if precip rate > infiltration rate.
    
    Provide specific 'mowingAdvice' based on the height provided (e.g. "Increase height to 3 inches to save water" or "Mow every 3 days at 0.5 inches").

    OUTPUT JSON conforming to schema.
  `;

  const parts: any[] = [{ text: promptText }];

  if (data.image) {
    const base64Data = await fileToGenerativePart(data.image);
    parts.unshift({
      inlineData: {
        data: base64Data,
        mimeType: data.image.type,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0,
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response");
    return JSON.parse(resultText) as WateringSchedule;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate plan.");
  }
};

async function fileToGenerativePart(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
