#!/usr/bin/env node

/**
 * Test script for MCP Weather Server HTTP endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testEndpoints() {
    console.log('🧪 Testing MCP Weather Server HTTP endpoints...\n');

    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const health = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Health check:', health.data);
        console.log('');

        // Test tools endpoint
        console.log('2. Testing tools endpoint...');
        const tools = await axios.get(`${BASE_URL}/tools`);
        console.log('✅ Available tools:', tools.data.tools.map(t => t.name));
        console.log('');

        // Test resources endpoint
        console.log('3. Testing resources endpoint...');
        const resources = await axios.get(`${BASE_URL}/resources`);
        console.log('✅ Available resources:', resources.data.resources.map(r => r.name));
        console.log('');

        // Test prompts endpoint
        console.log('4. Testing prompts endpoint...');
        const prompts = await axios.get(`${BASE_URL}/prompts`);
        console.log('✅ Available prompts:', prompts.data.prompts.map(p => p.name));
        console.log('');

        // Test direct weather API
        console.log('5. Testing direct weather API...');
        const weather = await axios.get(`${BASE_URL}/weather/Tokyo,Japan`);
        console.log('✅ Weather for Tokyo:', {
            location: weather.data.location,
            condition: weather.data.condition,
            temperature: weather.data.temperature,
            unit: weather.data.unit
        });
        console.log('');

        // Test weather comparison
        console.log('6. Testing weather comparison...');
        const comparison = await axios.get(`${BASE_URL}/weather/compare/Tokyo,Japan/London,UK`);
        console.log('✅ Weather comparison:', {
            location1: comparison.data.location1.location,
            location2: comparison.data.location2.location,
            temperatureDifference: comparison.data.comparison.temperatureDifference,
            warmerLocation: comparison.data.comparison.warmerLocation
        });
        console.log('');

        // Test tool call via HTTP
        console.log('7. Testing tool call via HTTP...');
        const toolCall = await axios.post(`${BASE_URL}/call-tool`, {
            name: 'get_current_weather',
            arguments: {
                location: 'Paris, France',
                unit: 'celsius'
            }
        });
        console.log('✅ Tool call result:', toolCall.data.content[0].text.substring(0, 100) + '...');
        console.log('');

        // Test resource access
        console.log('8. Testing resource access...');
        const popularCities = await axios.get(`${BASE_URL}/resource/weather://popular-cities`);
        console.log('✅ Popular cities:', JSON.parse(popularCities.data.contents[0].text).cities.slice(0, 3));
        console.log('');

        console.log('🎉 All tests passed! MCP Weather Server is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    }
}

// Check if server is running
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/health`);
        return true;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('🔍 Checking if MCP server is running...');
    
    const isRunning = await checkServer();
    if (!isRunning) {
        console.log('❌ MCP server is not running on port 3001');
        console.log('💡 Start it with: npm run mcp:http');
        process.exit(1);
    }
    
    console.log('✅ MCP server is running, starting tests...\n');
    await testEndpoints();
}

main().catch(console.error);
