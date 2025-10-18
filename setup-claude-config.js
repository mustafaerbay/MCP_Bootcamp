#!/usr/bin/env node

/**
 * Setup script for Claude Desktop MCP configuration
 * This script generates the correct configuration with the current directory path
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const currentDir = process.cwd();
const serverPath = path.join(currentDir, 'mcp-server-simple.js');

// Check if the server file exists
if (!fs.existsSync(serverPath)) {
    console.error('❌ mcp-server-simple.js not found in current directory');
    console.error('💡 Make sure you run this script from the MCP_Bootcamp directory');
    process.exit(1);
}

// Generate the configuration
const config = {
    mcpServers: {
        "weather-server": {
            command: "node",
            args: [serverPath],
            env: {
                WEATHER_API_KEY: "75d7417873874b2984d94227251810"
            }
        }
    }
};

// Write the configuration
const configPath = path.join(currentDir, 'claude-desktop-config-generated.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ Generated Claude Desktop configuration:');
console.log(`📁 Config file: ${configPath}`);
console.log(`🔧 Server path: ${serverPath}`);
console.log('');
console.log('📋 Next steps:');
console.log('1. Copy the generated config to your Claude Desktop config directory:');
console.log(`   cp ${configPath} ~/.config/claude-desktop/config.json`);
console.log('');
console.log('2. Or manually copy this configuration:');
console.log('');
console.log(JSON.stringify(config, null, 2));
console.log('');
console.log('3. Restart Claude Desktop');
console.log('');
console.log('🧪 Test the server manually:');
console.log(`   node ${serverPath}`);
