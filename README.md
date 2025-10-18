# Weather AI Assistant with MCP Support

A modern web interface for OpenAI function calling with **Model Context Protocol (MCP)** support, specifically designed for weather queries. This application demonstrates how to use OpenAI's Responses API with function calling in a beautiful, interactive web UI, plus MCP server capabilities for integration with AI clients like Claude, Cursor, and others.

## Features

- 🌤️ **Interactive Chat Interface**: Modern, responsive chat UI for weather queries
- 🔧 **Function Calling Visualization**: See exactly how the AI calls functions and processes results
- 📱 **Mobile Responsive**: Works perfectly on desktop and mobile devices
- 🎨 **Beautiful Design**: Modern gradient design with smooth animations
- ⚡ **Real-time Updates**: Live typing indicators and smooth message transitions
- 🔌 **MCP Server Support**: Full Model Context Protocol integration for AI clients
- 🛠️ **Weather Tools**: Comprehensive weather tools for MCP-compatible applications
- 📚 **Resources & Prompts**: Weather resources and structured prompts for AI workflows

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your API keys:**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit .env with your actual API keys
   OPENAI_API_KEY=sk-your-openai-api-key-here
   WEATHER_API_KEY=your-weatherapi-key-here
   ```

3. **Start the web server:**
   ```bash
   npm run web
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## MCP Server Usage

### Start the MCP Server

#### Stdio Mode (for MCP clients)
```bash
npm run mcp
```

#### HTTP Mode (for direct API access)
```bash
npm run mcp:http
```

The HTTP mode provides REST API endpoints for direct access to weather data and MCP functionality.

### MCP Server Features

#### 🛠️ **Available Tools:**
- `get_current_weather` - Get current weather for a location
- `get_weather_summary` - Detailed weather report with all metrics
- `compare_weather` - Compare weather between two locations

#### 📚 **Available Resources:**
- `weather://popular-cities` - List of popular cities for weather queries
- `weather://weather-conditions` - Weather condition reference guide

#### 💬 **Available Prompts:**
- `weather-check` - Check current weather for a specific location
- `weather-comparison` - Compare weather between two locations  
- `travel-weather` - Get weather information for travel planning

### MCP Client Integration

#### Claude Desktop

**Option 1: Automatic Setup (Recommended)**
```bash
npm run setup:claude
```
This will generate the correct configuration with your current directory path.

**Option 2: Manual Setup**
1. Copy `claude-desktop-config.json` to your Claude Desktop config directory
2. The configuration now uses absolute paths, so it should work directly
3. Update the `WEATHER_API_KEY` in the config if needed
4. Restart Claude Desktop

**Note:** Use `claude-desktop-config-portable.json` for a more portable configuration with `${HOME}` variable.

#### Cursor IDE
1. Copy `cursor-mcp-config.json` to your Cursor settings
2. Update the `cwd` path to point to your project directory  
3. Update the `WEATHER_API_KEY` in the config if needed
4. Restart Cursor

#### Other MCP Clients
Use the `mcp-config.json` as a template for your MCP client configuration.

### HTTP API Endpoints

When running in HTTP mode (`npm run mcp:http`), the server provides these REST endpoints:

#### **Health & Status**
- `GET /health` - Server health check
- `GET /tools` - List available MCP tools
- `GET /resources` - List available MCP resources  
- `GET /prompts` - List available MCP prompts

#### **Direct Weather API**
- `GET /weather/:location` - Get current weather for a location
- `GET /weather/compare/:location1/:location2` - Compare weather between two locations

#### **MCP Protocol Endpoints**
- `POST /call-tool` - Call an MCP tool directly
- `GET /resource/:uri` - Access MCP resources
- `GET /prompt/:name` - Get MCP prompts

#### **Example Usage**
```bash
# Get weather for Tokyo
curl "http://localhost:3001/weather/Tokyo,Japan"

# Compare weather between cities
curl "http://localhost:3001/weather/compare/Tokyo,Japan/London,UK"

# Call MCP tool directly
curl -X POST "http://localhost:3001/call-tool" \
  -H "Content-Type: application/json" \
  -d '{"name": "get_current_weather", "arguments": {"location": "Paris, France"}}'

# Test all endpoints
npm run test:mcp
```

## Usage

### Web Interface
- Open the web interface and start chatting about weather
- Try the example buttons for quick queries
- Watch as the AI calls the weather function and processes the results

### Command Line (Original)
```bash
npm start
```

## How It Works

1. **User Input**: You ask a weather question through the web interface
2. **AI Processing**: The AI analyzes your question and decides to call the `getWeather` function
3. **Function Execution**: The server executes the weather function with your specified location
4. **Result Processing**: The AI processes the function result and provides a natural language response
5. **Visualization**: The web UI shows you the entire flow including function calls and results

## API Endpoints

- `GET /` - Serves the main web interface
- `POST /api/chat` - Handles chat messages and function calling
- `GET /health` - Health check endpoint

## File Structure

```
├── index.html          # Main web interface
├── styles.css          # Modern CSS styling
├── script.js           # Frontend JavaScript
├── server.js           # Express.js server
├── function-calling.js                    # Original CLI version
├── mcp-server.js                          # MCP server implementation (complex)
├── mcp-server-simple.js                  # MCP server implementation (simple, working)
├── mcp-config.json                        # MCP configuration template
├── claude-desktop-config.json             # Claude Desktop MCP config
├── claude-desktop-config-generic.json     # Claude Desktop MCP config (portable)
├── cursor-mcp-config.json                 # Cursor IDE MCP config
├── test-mcp-http.js                       # HTTP mode test script
├── test-mcp-stdio.js                      # Stdio mode test script
├── package.json                           # Dependencies and scripts
└── README.md                              # This file
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `WEATHER_API_KEY` - Your WeatherAPI.com API key (required)
- `PORT` - Server port (default: 3000)

## Getting API Keys

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key

### WeatherAPI.com Key
1. Go to [WeatherAPI.com](https://www.weatherapi.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Free tier includes 1 million calls per month

## Dependencies

- **express**: Web server framework
- **openai**: OpenAI API client
- **axios**: HTTP client for WeatherAPI.com
- **dotenv**: Environment variable management
- **@modelcontextprotocol/sdk**: MCP SDK for server implementation
- **Modern CSS**: No additional CSS frameworks needed

## Example Queries

Try these example queries in the web interface:

- "What's the weather like in Istanbul, Turkey?"
- "How's the weather in New York City?"
- "What's the temperature in Tokyo, Japan?"
- "Weather forecast for London, UK"

## Development

To run in development mode:
```bash
npm run dev
```

The server will start on `http://localhost:3000` and automatically serve the web interface.
