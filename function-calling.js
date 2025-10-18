#!/usr/bin/env node

/**
 * Minimal example of OpenAI model function calling with the Responses API.
 *
 * Usage:
 *   1. npm install openai
 *   2. export OPENAI_API_KEY=sk-...
 *   3. node function-calling.js
 */

const OpenAI = require("openai");
const axios = require('axios');
require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY environment variable.");
  process.exit(1);
}

if (!process.env.WEATHER_API_KEY) {
  console.error("Missing WEATHER_API_KEY environment variable.");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const tools = [
  {
    type: "function",
    name: "getWeather",
    description: "Lookup a weather forecast for a specific location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City and country in natural language (e.g. Istanbul, Turkey).",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          default: "celsius",
        },
      },
      required: ["location"],
    },
  },
];

async function getWeather({ location, unit = "celsius" }) {
  try {
    console.log(`🌤️ Fetching real weather data for: ${location}`);
    
    const response = await axios.get('http://api.weatherapi.com/v1/current.json', {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        aqi: 'no'
      }
    });

    const data = response.data;
    const current = data.current;
    const locationInfo = data.location;

    console.log('📊 WeatherAPI response received:', {
      location: locationInfo.name,
      country: locationInfo.country,
      temperature: current.temp_c,
      condition: current.condition.text
    });

    // Convert temperature based on unit preference
    const temperature = unit === "celsius" ? current.temp_c : current.temp_f;
    
    return {
      location: `${locationInfo.name}, ${locationInfo.country}`,
      unit,
      outlook: current.condition.text,
      temperature: Math.round(temperature),
      humidity: current.humidity,
      windSpeed: unit === "celsius" ? current.wind_kph : current.wind_mph,
      windUnit: unit === "celsius" ? "km/h" : "mph",
      pressure: current.pressure_mb,
      feelsLike: unit === "celsius" ? Math.round(current.feelslike_c) : Math.round(current.feelslike_f),
      visibility: current.vis_km,
      uvIndex: current.uv,
      lastUpdated: current.last_updated
    };
  } catch (error) {
    console.error('❌ Error fetching weather data:', error.message);
    
    // Fallback to mock data if API fails
    return {
      location,
      unit,
      outlook: "Unable to fetch weather data",
      temperature: unit === "celsius" ? 20 : 68,
      humidity: 50,
      windSpeed: 10,
      windUnit: unit === "celsius" ? "km/h" : "mph",
      pressure: 1013,
      feelsLike: unit === "celsius" ? 20 : 68,
      visibility: 10,
      uvIndex: 3,
      lastUpdated: new Date().toISOString(),
      error: "Weather service temporarily unavailable"
    };
  }
}

async function run() {
  const prompt = "What's the weather like tomorrow in Istanbul, Turkey?";

  console.log("Sending prompt:", prompt);

  const firstRequest = {
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "You are a weather assistant. When users ask about weather, always use the getWeather function to provide accurate weather information." }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    tools,
  };
  console.log("First request payload:", JSON.stringify(firstRequest, null, 2));

  const firstResponse = await client.responses.create(firstRequest);

  console.log(
    "First response output:",
    JSON.stringify(firstResponse.output ?? null, null, 2),
  );

  const toolCall = firstResponse.output?.find(
    (part) => part.type === "function_call" && part.name === "getWeather",
  );

  if (!toolCall) {
    console.log(firstResponse.output_text ?? "No tool call issued.");
    return;
  }

  let args;
  try {
    args = JSON.parse(toolCall.arguments);
    console.log("Parsed tool arguments:", args);
  } catch (error) {
    console.error(`Failed to parse tool arguments: ${toolCall.arguments}`);
    throw error;
  }

  const toolResult = await getWeather(args);
  console.log("Tool result:", toolResult);

  // Create a detailed natural language response based on the function result
  const weatherInfo = toolResult;
  let finalResponse = `🌤️ **Current Weather in ${weatherInfo.location}**\n\n`;
  finalResponse += `**Condition:** ${weatherInfo.outlook}\n`;
  finalResponse += `**Temperature:** ${weatherInfo.temperature}°${weatherInfo.unit === 'celsius' ? 'C' : 'F'}\n`;
  finalResponse += `**Feels Like:** ${weatherInfo.feelsLike}°${weatherInfo.unit === 'celsius' ? 'C' : 'F'}\n`;
  finalResponse += `**Humidity:** ${weatherInfo.humidity}%\n`;
  finalResponse += `**Wind:** ${weatherInfo.windSpeed} ${weatherInfo.windUnit}\n`;
  finalResponse += `**Pressure:** ${weatherInfo.pressure} mb\n`;
  finalResponse += `**Visibility:** ${weatherInfo.visibility} km\n`;
  finalResponse += `**UV Index:** ${weatherInfo.uvIndex}\n`;
  finalResponse += `**Last Updated:** ${weatherInfo.lastUpdated}`;
  
  if (weatherInfo.error) {
    finalResponse += `\n\n⚠️ **Note:** ${weatherInfo.error}`;
  }
  
  console.log("Final response:", finalResponse);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
