class WeatherChat {
    constructor() {
        this.mcpBaseUrl = window.MCP_BASE_URL || 'http://localhost:3001';
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.location2Wrapper = document.getElementById('location2Wrapper');
        this.location2Input = document.getElementById('location2Input');
        this.sendButton = document.getElementById('sendButton');
        this.exampleButtons = document.querySelectorAll('.example-btn');
        this.toolSelect = document.getElementById('toolSelect');
        this.unitSelect = document.getElementById('unitSelect');

        this.availableTools = new Map();

        this.initializeEventListeners();
        this.loadTools();
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());

        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.toolSelect.addEventListener('change', () => this.handleToolChange());

        this.exampleButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.dataset.tool) {
                    this.toolSelect.value = btn.dataset.tool;
                    this.handleToolChange();
                }

                if (btn.dataset.unit) {
                    this.unitSelect.value = btn.dataset.unit;
                }

                this.userInput.value = btn.dataset.location || '';
                this.location2Input.value = btn.dataset.location2 || '';

                if (btn.dataset.tool === 'compare_weather') {
                    this.location2Wrapper.classList.remove('hidden');
                }

                this.sendMessage();
            });
        });

        this.userInput.focus();
    }

    async loadTools() {
        const fallbackTools = [
            {
                name: 'get_current_weather',
                description: 'Get current weather conditions for a specific location',
                inputSchema: {
                    properties: {
                        location: { description: 'City and country (e.g. Istanbul, Turkey)' },
                        unit: { enum: ['celsius', 'fahrenheit'] }
                    }
                }
            },
            {
                name: 'get_weather_summary',
                description: 'Get a detailed weather summary for a location',
                inputSchema: {
                    properties: {
                        location: { description: 'City and country' },
                        unit: { enum: ['celsius', 'fahrenheit'] }
                    }
                }
            },
            {
                name: 'compare_weather',
                description: 'Compare weather between two locations',
                inputSchema: {
                    properties: {
                        location1: { description: 'First location' },
                        location2: { description: 'Second location' },
                        unit: { enum: ['celsius', 'fahrenheit'] }
                    }
                }
            }
        ];

        try {
            const response = await fetch(`${this.mcpBaseUrl}/tools`);
            const raw = await response.text();
            const data = raw ? JSON.parse(raw) : { tools: [] };

            if (Array.isArray(data.tools) && data.tools.length > 0) {
                this.populateToolsSelect(data.tools);
                return;
            }

            console.warn('MCP server returned no tools, using fallback.');
        } catch (error) {
            console.warn('Unable to load tools from MCP server, using fallback set.', error);
        }

        this.populateToolsSelect(fallbackTools);
    }

    populateToolsSelect(tools) {
        this.availableTools.clear();
        this.toolSelect.innerHTML = '';

        tools.forEach((tool, index) => {
            this.availableTools.set(tool.name, tool);
            const option = document.createElement('option');
            option.value = tool.name;
            const niceName = this.prettifyToolName(tool.name);
            option.textContent = niceName;
            option.title = tool.description || niceName;
            if (index === 0) {
                option.selected = true;
            }
            this.toolSelect.appendChild(option);
        });

        this.handleToolChange();
    }

    prettifyToolName(name) {
        return name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    handleToolChange() {
        const toolName = this.toolSelect.value;

        if (toolName === 'compare_weather') {
            this.location2Wrapper.classList.remove('hidden');
        } else {
            this.location2Wrapper.classList.add('hidden');
            this.location2Input.value = '';
        }

        this.updatePlaceholders(toolName);
    }

    updatePlaceholders(toolName) {
        switch (toolName) {
            case 'get_weather_summary':
                this.userInput.placeholder = 'Enter a location for a detailed summary (e.g. Tokyo, Japan)';
                break;
            case 'compare_weather':
                this.userInput.placeholder = 'First location (e.g. London, UK)';
                if (!this.location2Input.value) {
                    this.location2Input.placeholder = 'Second location (e.g. Paris, France)';
                }
                break;
            default:
                this.userInput.placeholder = 'Enter a location (e.g. Istanbul, Turkey)';
        }
    }

    async sendMessage() {
        const toolName = this.toolSelect.value;
        const unit = this.unitSelect.value;

        if (!toolName) {
            this.addMessage('assistant', 'Please choose a tool before making a request.');
            return;
        }

        const primaryLocation = this.userInput.value.trim();
        const secondaryLocation = this.location2Input.value.trim();

        if (!primaryLocation) {
            this.addMessage('assistant', 'Please provide at least one location.');
            return;
        }

        if (toolName === 'compare_weather' && !secondaryLocation) {
            this.addMessage('assistant', 'Please enter a second location when comparing weather.');
            return;
        }

        const args = this.buildArguments(toolName, unit, primaryLocation, secondaryLocation);
        const userSummary = this.buildUserSummary(toolName, args);

        this.addMessage('user', userSummary);
        this.addMessage('function-call', `🔧 Tool Call: ${toolName}\nArguments: ${JSON.stringify(args, null, 2)}`);

        this.setLoading(true);
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.mcpBaseUrl}/call-tool`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: toolName, arguments: args })
            });

            const raw = await response.text();
            let data = raw ? JSON.parse(raw) : null;

            this.hideTypingIndicator();

            if (!response.ok || data?.isError) {
                const errorMessage =
                    data?.content?.[0]?.text ||
                    data?.error ||
                    `MCP server returned HTTP ${response.status}`;
                throw new Error(errorMessage);
            }

            const assistantText = this.extractTextContent(data);
            this.addMessage('assistant', assistantText);
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('assistant', `Sorry, I encountered an error: ${error.message}`);
            console.error('Error calling MCP server:', error);
        } finally {
            this.setLoading(false);
        }
    }

    buildArguments(toolName, unit, primaryLocation, secondaryLocation) {
        if (toolName === 'compare_weather') {
            return {
                location1: primaryLocation,
                location2: secondaryLocation,
                unit
            };
        }

        return {
            location: primaryLocation,
            unit
        };
    }

    buildUserSummary(toolName, args) {
        switch (toolName) {
            case 'get_weather_summary':
                return `Show me a detailed weather summary for ${args.location} (${args.unit}).`;
            case 'compare_weather':
                return `Compare the weather between ${args.location1} and ${args.location2} (${args.unit}).`;
            default:
                return `Check the current weather in ${args.location} (${args.unit}).`;
        }
    }

    extractTextContent(data) {
        if (!data) {
            return 'Received an empty response from the MCP server.';
        }

        const contentArray = Array.isArray(data.content) ? data.content : [];
        const textBlock = contentArray.find((part) => part.type === 'text');

        if (textBlock?.text) {
            return textBlock.text;
        }

        if (typeof data === 'string') {
            return data;
        }

        return JSON.stringify(data, null, 2);
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (type === 'user') {
            contentDiv.innerHTML = `<strong>You:</strong> ${this.escapeHtml(content)}`;
        } else if (type === 'assistant') {
            contentDiv.innerHTML = `<strong>AI Assistant:</strong> ${this.formatText(content)}`;
        } else {
            contentDiv.textContent = content;
        }

        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatText(text) {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.id = 'typingIndicator';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <strong>AI Assistant:</strong> 
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        typingDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    setLoading(loading) {
        this.sendButton.disabled = loading;
        this.userInput.disabled = loading;
        this.toolSelect.disabled = loading;
        this.unitSelect.disabled = loading;
        this.location2Input.disabled = loading || this.location2Wrapper.classList.contains('hidden');

        if (loading) {
            this.sendButton.innerHTML = '<div class="loading"></div>';
        } else {
            this.sendButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                </svg>
            `;
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WeatherChat();
});
