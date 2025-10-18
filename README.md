# Weather AI Assistant

A modern web interface for OpenAI function calling, specifically designed for weather queries. This application demonstrates how to use OpenAI's Responses API with function calling in a beautiful, interactive web UI.

## Features

- 🌤️ **Interactive Chat Interface**: Modern, responsive chat UI for weather queries
- 🔧 **Function Calling Visualization**: See exactly how the AI calls functions and processes results
- 📱 **Mobile Responsive**: Works perfectly on desktop and mobile devices
- 🎨 **Beautiful Design**: Modern gradient design with smooth animations
- ⚡ **Real-time Updates**: Live typing indicators and smooth message transitions

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up your OpenAI API key:**
   ```bash
   export OPENAI_API_KEY=sk-your-api-key-here
   ```

3. **Start the web server:**
   ```bash
   npm run web
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

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
├── function-calling.js  # Original CLI version
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3000)

## Dependencies

- **express**: Web server framework
- **openai**: OpenAI API client
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
