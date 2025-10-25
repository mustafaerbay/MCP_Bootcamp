const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MCP_BASE_URL = process.env.MCP_HTTP_BASE || 'http://localhost:3001';

// Check for API key
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY environment variable.");
    process.exit(1);
}

console.log('🔑 OpenAI API key found:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
console.log('🌐 MCP base URL:', MCP_BASE_URL);
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

async function fetchMcpTools() {
    try {
        const response = await axios.get(`${MCP_BASE_URL}/tools`);
        const tools = response.data?.tools;
        if (Array.isArray(tools) && tools.length > 0) {
            console.log(`🧰 Loaded ${tools.length} tools from MCP server.`);
            return tools;
        }
        console.warn('⚠️ MCP server returned no tools, falling back to empty tool list.');
        return [];
    } catch (error) {
        console.error('❌ Failed to load tools from MCP server:', error.message);
        return [];
    }
}

function mapToolsToOpenAITools(tools) {
    return tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema ?? {
            type: "object",
            properties: {}
        },
    }));
}

async function callMcpTool(name, args = {}) {
    try {
        console.log(`📡 Calling MCP tool "${name}" with args:`, args);
        const response = await axios.post(`${MCP_BASE_URL}/call-tool`, {
            name,
            arguments: args,
        });
        console.log(`✅ MCP tool "${name}" completed.`);
        return response.data;
    } catch (error) {
        console.error(`❌ MCP tool "${name}" failed:`, error.message);
        const reason = error.response?.data?.error || error.message;
        throw new Error(reason);
    }
}

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        console.log('🚀 Received chat request:', { message, timestamp: new Date().toISOString() });
        
        if (!message) {
            console.log('❌ Error: No message provided');
            return res.status(400).json({ error: 'Message is required' });
        }

        const availableTools = await fetchMcpTools();
        const toolDefinitions = mapToolsToOpenAITools(availableTools);

        const systemPrompt = [
            "You are a helpful weather assistant.",
            "You have access to weather tools via the MCP weather server.",
            "Always invoke the relevant tool when you need real weather data.",
            "Explain your answers clearly using the returned tool data."
        ].join(' ');

        console.log('📡 Making first API call to OpenAI...');
        console.log('📋 Request details:', {
            model: "gpt-4.1-mini",
            message,
            toolCount: toolDefinitions.length
        });

        const firstResponse = await client.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: [{ type: "input_text", text: systemPrompt }],
                },
                {
                    role: "user",
                    content: [{ type: "input_text", text: message }],
                },
            ],
            tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        });

        console.log('✅ First API call completed');
        console.log('📊 First response details:', {
            responseId: firstResponse.id,
            outputText: firstResponse.output_text,
            outputLength: firstResponse.output?.length || 0
        });
        console.log('🔍 Raw output array:', firstResponse.output);

        let responseData = {
            firstResponse: firstResponse.output_text || null,
            functionCall: null,
            functionResult: null,
            finalResponse: null
        };

        const toolCall = firstResponse.output?.find(
            (part) =>
                (part.type === "tool_call" || part.type === "function_call") &&
                part.name &&
                toolDefinitions.find((tool) => tool.name === part.name)
        );

        if (!toolCall) {
            console.log('ℹ️ No tool call detected, returning first response.');
            responseData.finalResponse = responseData.firstResponse;
            return res.json(responseData);
        }

        const toolCallId = toolCall.call_id ?? toolCall.id ?? toolCall.tool_call_id;

        console.log('🔧 Tool call detected:', {
            name: toolCall.name,
            id: toolCallId,
            arguments: toolCall.arguments
        });

        if (!toolCallId) {
            throw new Error('Tool call did not include a call ID.');
        }

        responseData.functionCall = {
            id: toolCallId,
            name: toolCall.name,
            arguments: toolCall.arguments
        };

        let parsedArgs = {};
        if (toolCall.arguments) {
            try {
                parsedArgs = typeof toolCall.arguments === 'string'
                    ? JSON.parse(toolCall.arguments)
                    : toolCall.arguments;
                console.log('✅ Parsed tool arguments:', parsedArgs);
            } catch (error) {
                console.error(`❌ Failed to parse tool arguments: ${toolCall.arguments}`);
                throw new Error(`Invalid tool arguments: ${toolCall.arguments}`);
            }
        }

        const toolResult = await callMcpTool(toolCall.name, parsedArgs);
        responseData.functionResult = toolResult;

        console.log('📝 Sending tool output back to OpenAI for final response...');

        const toolResultText = JSON.stringify(toolResult, null, 2);

        const secondResponse = await client.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: `${systemPrompt} You have already called the tool ${toolCall.name}. Use the provided tool output to answer the user's question without calling another tool.`,
                        },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: message,
                        },
                    ],
                },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "input_text",
                            text: `Tool "${toolCall.name}" output:\n${toolResultText}`,
                        },
                    ],
                },
            ],
        });

        responseData.finalResponse = secondResponse.output_text || null;

        console.log('✅ Tool call completed and final response generated.');
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
