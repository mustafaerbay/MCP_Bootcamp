const express = require('express');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY environment variable.");
    process.exit(1);
}

console.log('🔑 OpenAI API key found:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
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

// Weather function (same as in function-calling.js)
function getWeather({ location, unit = "celsius" }) {
    return {
        location,
        unit,
        outlook: "sunny with light clouds",
        temperature: unit === "celsius" ? 24 : 75,
        humidity: 0.45,
    };
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
            const toolResult = getWeather(args);
            console.log('📊 Function result:', toolResult);

            // Store function call and result info
            responseData.functionCall = {
                name: toolCall.name,
                arguments: toolCall.arguments
            };
            responseData.functionResult = toolResult;

            console.log('📝 Creating final response with function result...');
            
            // Create a natural language response based on the function result
            const weatherInfo = toolResult;
            const finalResponse = `The weather in ${weatherInfo.location} is ${weatherInfo.outlook} with a temperature of ${weatherInfo.temperature}°${weatherInfo.unit === 'celsius' ? 'C' : 'F'} and humidity at ${Math.round(weatherInfo.humidity * 100)}%.`;
            
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
