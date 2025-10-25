class WeatherChat {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.exampleButtons = document.querySelectorAll('.example-btn');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());

        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.exampleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                this.userInput.value = query;
                this.sendMessage();
            });
        });

        this.userInput.focus();
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addMessage('user', message);
        this.userInput.value = '';
        this.setLoading(true);

        try {
            this.showTypingIndicator();

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            this.hideTypingIndicator();
            this.displayConversationFlow(data);
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('assistant', `Sorry, something went wrong: ${error.message}`);
            console.error('Chat error:', error);
        } finally {
            this.setLoading(false);
        }
    }

    displayConversationFlow(data) {
        if (data.firstResponse) {
            this.addMessage('assistant', data.firstResponse);
        }

        if (data.functionCall) {
            const { name, arguments: args } = data.functionCall;
            let formattedArguments = args;
            try {
                formattedArguments = JSON.stringify(JSON.parse(args), null, 2);
            } catch {
                formattedArguments = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
            }
            const details = `🔧 Tool Call: ${name}\nArguments: ${formattedArguments}`;
            this.addMessage('function-call', details);
        }

        if (data.functionResult) {
            const resultDetails = `📊 Tool Result:\n${JSON.stringify(data.functionResult, null, 2)}`;
            this.addMessage('function-result', resultDetails);
        }

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
            contentDiv.innerHTML = `<strong>AI Assistant:</strong> ${this.formatText(content)}`;
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

    formatText(text) {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new WeatherChat();
});
