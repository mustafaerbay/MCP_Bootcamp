class WeatherChat {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.exampleButtons = document.querySelectorAll('.example-btn');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key press
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Example buttons
        this.exampleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                this.userInput.value = query;
                this.sendMessage();
            });
        });

        // Auto-focus input
        this.userInput.focus();
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage('user', message);
        this.userInput.value = '';
        this.setLoading(true);

        try {
            // Show typing indicator
            this.showTypingIndicator();

            // Send request to server
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Remove typing indicator
            this.hideTypingIndicator();

            // Display the conversation flow
            this.displayConversationFlow(data);

        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('assistant', `Sorry, I encountered an error: ${error.message}`);
            console.error('Error:', error);
        } finally {
            this.setLoading(false);
        }
    }

    displayConversationFlow(data) {
        // Show the AI's initial response (if any)
        if (data.firstResponse) {
            this.addMessage('assistant', data.firstResponse);
        }

        // Show function call details
        if (data.functionCall) {
            const functionDetails = `🔧 Function Call: ${data.functionCall.name}
Arguments: ${JSON.stringify(JSON.parse(data.functionCall.arguments), null, 2)}`;
            this.addMessage('function-call', functionDetails);
        }

        // Show function result
        if (data.functionResult) {
            const resultDetails = `📊 Function Result:
${JSON.stringify(data.functionResult, null, 2)}`;
            this.addMessage('function-result', resultDetails);
        }

        // Show final AI response
        if (data.finalResponse) {
            this.addMessage('assistant', data.finalResponse);
        }
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (type === 'user') {
            contentDiv.innerHTML = `<strong>You:</strong> ${this.escapeHtml(content)}`;
        } else if (type === 'assistant') {
            contentDiv.innerHTML = `<strong>AI Assistant:</strong> ${this.escapeHtml(content)}`;
        } else {
            contentDiv.textContent = content;
        }
        
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
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

// Initialize the chat when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new WeatherChat();
});
