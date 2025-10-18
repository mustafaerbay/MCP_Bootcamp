const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Check for API keys
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY environment variable.");
    process.exit(1);
}

if (!process.env.WEATHER_API_KEY) {
    console.error("❌ Missing WEATHER_API_KEY environment variable.");
    process.exit(1);
}

console.log('🔑 OpenAI API key found:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
console.log('🌤️ WeatherAPI key found:', process.env.WEATHER_API_KEY.substring(0, 10) + '...');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('🤖 OpenAI client initialized successfully');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📦 Request body:', req.body);
    }
    next();
});

// Real weather function using WeatherAPI.com
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

// Tools definition (same as in function-calling.js)
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

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        console.log('🚀 Received chat request:', { message, timestamp: new Date().toISOString() });
        
        if (!message) {
            console.log('❌ Error: No message provided');
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('📡 Making first API call to OpenAI...');
        console.log('📋 Request details:', {
            model: "gpt-4o-mini",
            message: message,
            toolsCount: tools.length
        });

        // First API call to get the initial response and potential tool call
        const firstResponse = await client.responses.create({
            model: "gpt-4o-mini",
            input: [
                {
                    role: "system",
                    content: [{ type: "input_text", text: "You are a weather assistant. When users ask about weather, always use the getWeather function to provide accurate weather information." }],
                },
                {
                    role: "user",
                    content: [{ type: "input_text", text: message }],
                },
            ],
            tools,
        });

        console.log('✅ First API call completed');
        console.log('📊 First response details:', {
            responseId: firstResponse.id,
            outputText: firstResponse.output_text,
            outputLength: firstResponse.output?.length || 0
        });
        
        // Debug: Log the full response structure
        console.log('🔍 Full response structure:', JSON.stringify(firstResponse, null, 2));
        console.log('🔍 Raw output array:', firstResponse.output);

        const toolCall = firstResponse.output?.find(
            (part) => part.type === "function_call" && part.name === "getWeather",
        );

        console.log('🔍 Checking for tool calls...');
        console.log('🔧 Tool call found:', !!toolCall);
        
        if (toolCall) {
            console.log('🛠️ Tool call details:', {
                name: toolCall.name,
                id: toolCall.id,
                arguments: toolCall.arguments
            });
        }

        let responseData = {
            firstResponse: firstResponse.output_text || null,
            functionCall: null,
            functionResult: null,
            finalResponse: null
        };

        // If there's a tool call, execute it and get the final response
        if (toolCall) {
            console.log('⚙️ Executing function call...');
            let args;
            console.log(`🔧 Tool call detected: ${toolCall.name} with arguments: ${toolCall.arguments}`);
            try {
                args = JSON.parse(toolCall.arguments);
                console.log('✅ Parsed arguments successfully:', args);
            } catch (error) {
                console.error(`❌ Failed to parse tool arguments: ${toolCall.arguments}`);
                throw error;
            }

            console.log('🌤️ Calling getWeather function with args:', args);
            const toolResult = await getWeather(args);
            console.log('📊 Function result:', toolResult);

            // Store function call and result info
            responseData.functionCall = {
                name: toolCall.name,
                arguments: toolCall.arguments
            };
            responseData.functionResult = toolResult;

            console.log('📝 Creating final response with function result...');
            
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
            
            console.log('✅ Final response created:', finalResponse);
            
            responseData.finalResponse = finalResponse;
        } else {
            console.log('ℹ️ No tool call detected, using first response only');
        }

        console.log('📤 Sending response to client:', {
            hasFirstResponse: !!responseData.firstResponse,
            hasFunctionCall: !!responseData.functionCall,
            hasFunctionResult: !!responseData.functionResult,
            hasFinalResponse: !!responseData.finalResponse
        });

        res.json(responseData);

    } catch (error) {
        console.error('❌ Error in chat endpoint:', error);
        console.error('📊 Error details:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🌤️ Weather AI Assistant Server Started');
    console.log('='.repeat(60));
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`📡 Ready to receive requests...`);
    console.log('='.repeat(60));
});
