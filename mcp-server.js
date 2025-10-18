#!/usr/bin/env node

/**
 * MCP Weather Server
 * 
 * This MCP server exposes weather functionality as tools, resources, and prompts
 * that can be used by MCP-compatible clients like Claude, Cursor, and others.
 * 
 * Based on: https://modelcontextprotocol.io/llms-full.txt
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

// Check for required environment variables
if (!process.env.WEATHER_API_KEY) {
    console.error("❌ Missing WEATHER_API_KEY environment variable.");
    process.exit(1);
}

const log = (...args) => console.error(...args);

log('🌤️ MCP Weather Server starting...');
log('🔑 WeatherAPI key found:', process.env.WEATHER_API_KEY.substring(0, 10) + '...');

// Create MCP server
const server = new Server(
    {
        name: "weather-mcp-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    }
);

// Weather API function
async function getWeatherData(location, unit = "celsius") {
    try {
        log(`🌤️ Fetching weather data for: ${location}`);
        
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

        // Convert temperature based on unit preference
        const temperature = unit === "celsius" ? current.temp_c : current.temp_f;
        
        return {
            location: `${locationInfo.name}, ${locationInfo.country}`,
            unit,
            condition: current.condition.text,
            temperature: Math.round(temperature),
            humidity: current.humidity,
            windSpeed: unit === "celsius" ? current.wind_kph : current.wind_mph,
            windUnit: unit === "celsius" ? "km/h" : "mph",
            pressure: current.pressure_mb,
            feelsLike: unit === "celsius" ? Math.round(current.feelslike_c) : Math.round(current.feelslike_f),
            visibility: current.vis_km,
            uvIndex: current.uv,
            lastUpdated: current.last_updated,
            windDirection: current.wind_dir,
            cloudCover: current.cloud,
            precipitation: current.precip_mm
        };
    } catch (error) {
        console.error('❌ Error fetching weather data:', error.message);
        throw new Error(`Failed to fetch weather data for ${location}: ${error.message}`);
    }
}

const TOOL_DEFINITIONS = [
    {
        name: "get_current_weather",
        description: "Get current weather conditions for a specific location",
        inputSchema: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "City and country in natural language (e.g. 'Tokyo, Japan', 'New York, USA')"
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    description: "Temperature unit preference",
                    default: "celsius"
                }
            },
            required: ["location"]
        }
    },
    {
        name: "get_weather_summary",
        description: "Get a detailed weather summary with multiple metrics for a location",
        inputSchema: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "City and country in natural language"
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    description: "Temperature unit preference",
                    default: "celsius"
                }
            },
            required: ["location"]
        }
    },
    {
        name: "compare_weather",
        description: "Compare weather conditions between two locations",
        inputSchema: {
            type: "object",
            properties: {
                location1: {
                    type: "string",
                    description: "First location to compare"
                },
                location2: {
                    type: "string",
                    description: "Second location to compare"
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    description: "Temperature unit preference",
                    default: "celsius"
                }
            },
            required: ["location1", "location2"]
        }
    }
];

async function listTools() {
    return { tools: TOOL_DEFINITIONS };
}

async function handleToolCall(name, args = {}) {
    switch (name) {
        case "get_current_weather": {
            const { location, unit = "celsius" } = args;
            const weather = await getWeatherData(location, unit);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `🌤️ **Current Weather in ${weather.location}**\n\n` +
                              `**Condition:** ${weather.condition}\n` +
                              `**Temperature:** ${weather.temperature}°${unit === 'celsius' ? 'C' : 'F'}\n` +
                              `**Feels Like:** ${weather.feelsLike}°${unit === 'celsius' ? 'C' : 'F'}\n` +
                              `**Humidity:** ${weather.humidity}%\n` +
                              `**Last Updated:** ${weather.lastUpdated}`
                    }
                ]
            };
        }

        case "get_weather_summary": {
            const { location, unit = "celsius" } = args;
            const weather = await getWeatherData(location, unit);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `🌤️ **Detailed Weather Report for ${weather.location}**\n\n` +
                              `**Condition:** ${weather.condition}\n` +
                              `**Temperature:** ${weather.temperature}°${unit === 'celsius' ? 'C' : 'F'}\n` +
                              `**Feels Like:** ${weather.feelsLike}°${unit === 'celsius' ? 'C' : 'F'}\n` +
                              `**Humidity:** ${weather.humidity}%\n` +
                              `**Wind:** ${weather.windSpeed} ${weather.windUnit} (${weather.windDirection})\n` +
                              `**Pressure:** ${weather.pressure} mb\n` +
                              `**Visibility:** ${weather.visibility} km\n` +
                              `**UV Index:** ${weather.uvIndex}\n` +
                              `**Cloud Cover:** ${weather.cloudCover}%\n` +
                              `**Precipitation:** ${weather.precipitation} mm\n` +
                              `**Last Updated:** ${weather.lastUpdated}`
                    }
                ]
            };
        }

        case "compare_weather": {
            const { location1, location2, unit = "celsius" } = args;
            const [weather1, weather2] = await Promise.all([
                getWeatherData(location1, unit),
                getWeatherData(location2, unit)
            ]);
            
            const tempDiff = weather1.temperature - weather2.temperature;
            const tempUnit = unit === 'celsius' ? 'C' : 'F';
            
            return {
                content: [
                    {
                        type: "text",
                        text: `🌤️ **Weather Comparison**\n\n` +
                              `**${weather1.location}:**\n` +
                              `- ${weather1.condition}, ${weather1.temperature}°${tempUnit}\n` +
                              `- Humidity: ${weather1.humidity}%\n` +
                              `- Wind: ${weather1.windSpeed} ${weather1.windUnit}\n\n` +
                              `**${weather2.location}:**\n` +
                              `- ${weather2.condition}, ${weather2.temperature}°${tempUnit}\n` +
                              `- Humidity: ${weather2.humidity}%\n` +
                              `- Wind: ${weather2.windSpeed} ${weather2.windUnit}\n\n` +
                              `**Temperature Difference:** ${Math.abs(tempDiff)}°${tempUnit} ` +
                              `(${weather1.location} is ${tempDiff > 0 ? 'warmer' : 'cooler'} than ${weather2.location})`
                    }
                ]
            };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

const RESOURCE_CONTENT = {
    "weather://popular-cities": {
        uri: "weather://popular-cities",
        name: "Popular Cities",
        description: "List of popular cities for weather queries",
        mimeType: "application/json",
        text: JSON.stringify({
            cities: [
                { name: "Tokyo, Japan", country: "Japan", region: "Asia" },
                { name: "New York, USA", country: "United States", region: "North America" },
                { name: "London, UK", country: "United Kingdom", region: "Europe" },
                { name: "Paris, France", country: "France", region: "Europe" },
                { name: "Sydney, Australia", country: "Australia", region: "Oceania" },
                { name: "Dubai, UAE", country: "United Arab Emirates", region: "Middle East" },
                { name: "Mumbai, India", country: "India", region: "Asia" },
                { name: "São Paulo, Brazil", country: "Brazil", region: "South America" },
                { name: "Cairo, Egypt", country: "Egypt", region: "Africa" },
                { name: "Toronto, Canada", country: "Canada", region: "North America" }
            ]
        }, null, 2)
    },
    "weather://weather-conditions": {
        uri: "weather://weather-conditions",
        name: "Weather Conditions",
        description: "Reference guide for weather condition codes and descriptions",
        mimeType: "application/json",
        text: JSON.stringify({
            conditions: {
                "Sunny": "Clear skies with bright sunshine",
                "Partly Cloudy": "Some clouds with periods of sunshine",
                "Cloudy": "Overcast skies with limited sunshine",
                "Rainy": "Precipitation falling from clouds",
                "Snowy": "Snow falling from clouds",
                "Foggy": "Reduced visibility due to fog",
                "Stormy": "Thunderstorms with lightning and heavy rain",
                "Windy": "Strong winds affecting the area"
            },
            temperature_ranges: {
                celsius: {
                    "Very Cold": "< 0°C",
                    "Cold": "0-10°C",
                    "Cool": "10-20°C",
                    "Mild": "20-25°C",
                    "Warm": "25-30°C",
                    "Hot": "30-35°C",
                    "Very Hot": "> 35°C"
                },
                fahrenheit: {
                    "Very Cold": "< 32°F",
                    "Cold": "32-50°F",
                    "Cool": "50-68°F",
                    "Mild": "68-77°F",
                    "Warm": "77-86°F",
                    "Hot": "86-95°F",
                    "Very Hot": "> 95°F"
                }
            }
        }, null, 2)
    }
};

async function listResources() {
    return {
        resources: Object.values(RESOURCE_CONTENT).map(({ uri, name, mimeType, description }) => ({
            uri,
            name,
            description: description || "Weather data resource",
            mimeType
        }))
    };
}

async function readResource(uri) {
    const resource = RESOURCE_CONTENT[uri];
    if (!resource) {
        throw new Error(`Unknown resource: ${uri}`);
    }

    return {
        contents: [
            resource
        ]
    };
}

const PROMPT_DEFINITIONS = [
    {
        name: "weather-check",
        description: "Check current weather for a specific location",
        arguments: [
            {
                name: "location",
                description: "The city and country to check weather for",
                required: true
            },
            {
                name: "unit",
                description: "Temperature unit (celsius or fahrenheit)",
                required: false
            }
        ]
    },
    {
        name: "weather-comparison",
        description: "Compare weather between two locations",
        arguments: [
            {
                name: "location1",
                description: "First location to compare",
                required: true
            },
            {
                name: "location2",
                description: "Second location to compare",
                required: true
            },
            {
                name: "unit",
                description: "Temperature unit (celsius or fahrenheit)",
                required: false
            }
        ]
    },
    {
        name: "travel-weather",
        description: "Get weather information for travel planning",
        arguments: [
            {
                name: "destination",
                description: "Travel destination",
                required: true
            },
            {
                name: "departure_date",
                description: "Departure date (YYYY-MM-DD)",
                required: false
            },
            {
                name: "unit",
                description: "Temperature unit (celsius or fahrenheit)",
                required: false
            }
        ]
    }
];

async function listPrompts() {
    return { prompts: PROMPT_DEFINITIONS };
}

async function getPrompt(name, args) {
    switch (name) {
        case "weather-check": {
            const { location } = args;
            return {
                description: `Current weather conditions for ${location}`,
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Please provide a detailed weather report for ${location} including current conditions, temperature, humidity, wind, and any relevant weather alerts.`
                        }
                    }
                ]
            };
        }

        case "weather-comparison": {
            const { location1, location2 } = args;
            
            return {
                description: `Weather comparison between ${location1} and ${location2}`,
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Please compare the current weather conditions between ${location1} and ${location2}, highlighting differences in temperature, humidity, wind, and overall conditions.`
                        }
                    }
                ]
            };
        }

        case "travel-weather": {
            const { destination, departure_date } = args;
            
            return {
                description: `Travel weather information for ${destination}`,
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `I'm planning to travel to ${destination}${departure_date ? ` on ${departure_date}` : ''}. Please provide current weather conditions and any travel-related weather advice, including what to pack and expect.`
                        }
                    }
                ]
            };
        }

        default:
            throw new Error(`Unknown prompt: ${name}`);
    }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, listTools);

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        return await handleToolCall(name, args);
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `❌ Error: ${error.message}`
                }
            ],
            isError: true
        };
    }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, listResources);

// Handle resource requests
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    return readResource(uri);
});

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, listPrompts);

// Handle prompt requests
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    return getPrompt(name, args);
});

// Create Express app for HTTP transport
const app = express();
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});
app.use(express.json());

// HTTP endpoints for direct API access
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'MCP Weather Server',
        timestamp: new Date().toISOString()
    });
});

app.get('/tools', async (req, res) => {
    try {
        const result = await listTools();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

app.get('/resources', async (req, res) => {
    try {
        const result = await listResources();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

app.get('/prompts', async (req, res) => {
    try {
        const result = await listPrompts();
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

app.post('/call-tool', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;
        const result = await handleToolCall(name, args || {});
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

app.get('/resource/:uri', async (req, res) => {
    try {
        const { uri } = req.params;
        const result = await readResource(uri);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

app.get('/prompt/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const { arguments: args } = req.query;
        const result = await getPrompt(name, args ? JSON.parse(args) : {});
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

// Direct weather API endpoint
app.get('/weather/:location', async (req, res) => {
    try {
        const { location } = req.params;
        const { unit = 'celsius' } = req.query;
        const weather = await getWeatherData(location, unit);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(weather));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

// Compare weather endpoint
app.get('/weather/compare/:location1/:location2', async (req, res) => {
    try {
        const { location1, location2 } = req.params;
        const { unit = 'celsius' } = req.query;
        const [weather1, weather2] = await Promise.all([
            getWeatherData(location1, unit),
            getWeatherData(location2, unit)
        ]);
        
        const tempDiff = weather1.temperature - weather2.temperature;
        const tempUnit = unit === 'celsius' ? 'C' : 'F';
        
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
            location1: weather1,
            location2: weather2,
            comparison: {
                temperatureDifference: Math.abs(tempDiff),
                warmerLocation: tempDiff > 0 ? location1 : location2,
                unit: tempUnit
            }
        }));
    } catch (error) {
        res.status(500).setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: error.message }));
    }
});

// Start the server
async function main() {
    const port = process.env.MCP_PORT || 3001;
    const transport = process.env.MCP_TRANSPORT || 'stdio';
    
    if (transport === 'http') {
        // HTTP transport
        app.listen(port, () => {
            log(`🌤️ MCP Weather Server running on HTTP port ${port}`);
            log(`📡 Health check: http://localhost:${port}/health`);
            log(`🛠️ Tools: http://localhost:${port}/tools`);
            log(`📚 Resources: http://localhost:${port}/resources`);
            log(`💬 Prompts: http://localhost:${port}/prompts`);
            log(`🌤️ Weather API: http://localhost:${port}/weather/{location}`);
        });
    } else {
        // Stdio transport (default for MCP clients)
        const stdioTransport = new StdioServerTransport();
        await server.connect(stdioTransport);
        log('🌤️ MCP Weather Server is running on stdio');
    }
}

main().catch((error) => {
    console.error('❌ MCP Server error:', error);
    process.exit(1);
});
