#!/usr/bin/env node

/**
 * Test script for MCP Weather Server stdio mode
 * This simulates how MCP clients would interact with the server
 */

const { spawn } = require('child_process');
const path = require('path');

async function testStdioMode() {
    console.log('🧪 Testing MCP Weather Server stdio mode...\n');

    // Start the MCP server in stdio mode
    const server = spawn('node', ['mcp-server-simple.js'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
            ...process.env,
            WEATHER_API_KEY: process.env.WEATHER_API_KEY || '75d7417873874b2984d94227251810'
        }
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
        output += data.toString();
    });

    server.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    // Test MCP protocol messages
    const testMessages = [
        // Initialize
        {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {}
                },
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0"
                }
            }
        },
        // List tools
        {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {}
        },
        // Call a tool
        {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "get_current_weather",
                arguments: {
                    location: "Tokyo, Japan",
                    unit: "celsius"
                }
            }
        }
    ];

    // Send test messages
    for (const message of testMessages) {
        console.log(`📤 Sending: ${message.method}`);
        server.stdin.write(JSON.stringify(message) + '\n');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for response
    }

    // Close the server
    server.stdin.end();

    // Wait for server to close
    await new Promise((resolve) => {
        server.on('close', (code) => {
            console.log(`\n📊 Server output:`);
            console.log(output);
            
            if (errorOutput) {
                console.log(`\n❌ Server errors:`);
                console.log(errorOutput);
            }
            
            if (code === 0) {
                console.log('\n✅ MCP server stdio mode test completed');
            } else {
                console.log(`\n❌ MCP server exited with code ${code}`);
            }
            
            resolve();
        });
    });
}

// Check if server file exists
const fs = require('fs');
if (!fs.existsSync('mcp-server-simple.js')) {
    console.error('❌ mcp-server-simple.js not found');
    process.exit(1);
}

testStdioMode().catch(console.error);
