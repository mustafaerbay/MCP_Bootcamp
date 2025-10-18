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
require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY environment variable.");
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

function getWeather({ location, unit = "celsius" }) {
  return {
    location,
    unit,
    outlook: "sunny with light clouds",
    temperature: unit === "celsius" ? 24 : 75,
    humidity: 0.45,
  };
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

  const toolResult = getWeather(args);
  console.log("Tool result:", toolResult);

  // Create a natural language response based on the function result
  const weatherInfo = toolResult;
  const finalResponse = `The weather in ${weatherInfo.location} is ${weatherInfo.outlook} with a temperature of ${weatherInfo.temperature}°${weatherInfo.unit === 'celsius' ? 'C' : 'F'} and humidity at ${Math.round(weatherInfo.humidity * 100)}%.`;
  
  console.log("Final response:", finalResponse);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
