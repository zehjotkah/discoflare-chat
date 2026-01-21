/**
 * DiscoFlare Chat Widget
 * Lightweight chat widget with WebSocket communication
 *
 * Bundle sizes:
 * - Source: 18.7KB
 * - Minified: 12.3KB
 * - Gzipped: 3.4KB (actual transfer size)
 *
 * @version 1.0.0
 */
(function() {
  'use strict';
  
  // Configuration
  const config = window.DiscoFlareChat || {};
  const WORKER_URL = config.workerUrl || '';
  const TURNSTILE_SITE_KEY = config.turnstileSiteKey || '';
  const THEME = config.theme || {};
  const TEXT = config.text || {};
  
  // Constants
  const STORAGE_KEY = 'discoflare_chat_session';
  const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
  const RECONNECT_INTERVALS = [2000, 4000, 8000, 16000];
  const MAX_MESSAGE_LENGTH = 2000;
  
  // State
  let ws = null;
  let sessionId = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let isInitialized = false;
  let isOpen = false;
  let turnstileToken = null;
  
  // DOM elements
  let chatButton = null;
  let chatWindow = null;
  let chatHeader = null;
  let chatMessages = null;
  let chatForm = null;
  let chatInput = null;
  let sendButton = null;
  let closeButton = null;
  let initForm = null;
  let statusIndicator = null;
  
  /**
   * Initialize widget
   */
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    
    // Validate configuration
    if (!WORKER_URL) {
      console.error('CloudflareChat: workerUrl is required');
      return;
    }
    
    if (!TURNSTILE_SITE_KEY) {
      console.error('CloudflareChat: turnstileSiteKey is required');
      return;
    }
    
    injectStyles();
    createChatButton();
    
    // Try to restore session
    restoreSession();
    
    // Auto-open if configured
    if (config.autoOpen) {
      setTimeout(() => openChat(), 1000);
    }
  }
  
  /**
   * Inject CSS styles
   */
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .cf-chat-button {
        position: fixed;
        ${THEME.position === 'bottom-left' ? 'left' : 'right'}: 20px;
        bottom: 20px;
        width: ${THEME.buttonSize || 60}px;
        height: ${THEME.buttonSize || 60}px;
        border-radius: 50%;
        background: ${THEME.primaryColor || '#5865F2'};
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: ${THEME.zIndex || 9998};
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
      }
      
      .cf-chat-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }
      
      .cf-chat-button:active {
        transform: scale(0.95);
      }
      
      .cf-chat-window {
        position: fixed;
        ${THEME.position === 'bottom-left' ? 'left' : 'right'}: 20px;
        bottom: ${(THEME.buttonSize || 60) + 30}px;
        width: 380px;
        height: 600px;
        max-height: calc(100vh - ${(THEME.buttonSize || 60) + 50}px);
        background: white;
        border-radius: ${THEME.borderRadius || 12}px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        display: none;
        flex-direction: column;
        z-index: ${THEME.zIndex || 9999};
        overflow: hidden;
        font-family: ${THEME.fontFamily || 'system-ui, -apple-system, sans-serif'};
      }
      
      .cf-chat-window.open {
        display: flex;
      }
      
      .cf-chat-header {
        background: ${THEME.primaryColor || '#5865F2'};
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .cf-chat-header-title {
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .cf-chat-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #43b581;
      }
      
      .cf-chat-status.connecting {
        background: #faa61a;
      }
      
      .cf-chat-status.disconnected {
        background: #f04747;
      }
      
      .cf-chat-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
      }
      
      .cf-chat-close:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .cf-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .cf-chat-message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 12px;
        word-wrap: break-word;
        animation: slideIn 0.2s ease-out;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .cf-chat-message.user {
        align-self: flex-end;
        background: ${THEME.primaryColor || '#5865F2'};
        color: white;
      }
      
      .cf-chat-message.agent {
        align-self: flex-start;
        background: #f3f4f6;
        color: #1f2937;
      }
      
      .cf-chat-message.system {
        align-self: center;
        background: #e5e7eb;
        color: #6b7280;
        font-size: 13px;
        padding: 6px 12px;
      }
      
      .cf-chat-message-author {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 4px;
        opacity: 0.8;
      }
      
      .cf-chat-init-form {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .cf-chat-init-form h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
        color: #1f2937;
      }
      
      .cf-chat-init-form p {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: #6b7280;
      }
      
      .cf-chat-input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .cf-chat-label {
        font-size: 13px;
        font-weight: 500;
        color: #374151;
      }
      
      .cf-chat-text-input {
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
      }
      
      .cf-chat-text-input:focus {
        outline: none;
        border-color: ${THEME.primaryColor || '#5865F2'};
      }
      
      .cf-chat-button-primary {
        padding: 12px;
        background: ${THEME.primaryColor || '#5865F2'};
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      
      .cf-chat-button-primary:hover {
        opacity: 0.9;
      }
      
      .cf-chat-button-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .cf-chat-form {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 8px;
      }
      
      .cf-chat-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        resize: none;
        max-height: 100px;
      }
      
      .cf-chat-input:focus {
        outline: none;
        border-color: ${THEME.primaryColor || '#5865F2'};
      }
      
      .cf-chat-send {
        padding: 10px 16px;
        background: ${THEME.primaryColor || '#5865F2'};
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      
      .cf-chat-send:hover:not(:disabled) {
        opacity: 0.9;
      }
      
      .cf-chat-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      @media (max-width: 768px) {
        .cf-chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - ${(THEME.buttonSize || 60) + 50}px);
          max-height: calc(100vh - ${(THEME.buttonSize || 60) + 50}px);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  /**
   * Create chat button
   */
  function createChatButton() {
    chatButton = document.createElement('button');
    chatButton.className = 'cf-chat-button';
    chatButton.innerHTML = '💬';
    chatButton.setAttribute('aria-label', TEXT.buttonLabel || 'Open chat');
    chatButton.onclick = toggleChat;
    document.body.appendChild(chatButton);
  }
  
  /**
   * Create chat window
   */
  function createChatWindow() {
    if (chatWindow) return;
    
    chatWindow = document.createElement('div');
    chatWindow.className = 'cf-chat-window';
    
    // Header
    chatHeader = document.createElement('div');
    chatHeader.className = 'cf-chat-header';
    chatHeader.innerHTML = `
      <div class="cf-chat-header-title">
        <span class="cf-chat-status connecting"></span>
        ${TEXT.headerTitle || 'Support Chat'}
      </div>
      <button class="cf-chat-close" aria-label="Close chat">×</button>
    `;
    chatWindow.appendChild(chatHeader);
    
    statusIndicator = chatHeader.querySelector('.cf-chat-status');
    closeButton = chatHeader.querySelector('.cf-chat-close');
    closeButton.onclick = closeChat;
    
    // Messages container
    chatMessages = document.createElement('div');
    chatMessages.className = 'cf-chat-messages';
    chatWindow.appendChild(chatMessages);
    
    // Init form (shown first)
    initForm = document.createElement('div');
    initForm.className = 'cf-chat-init-form';
    initForm.innerHTML = `
      <h3>${TEXT.welcomeMessage || 'Welcome! How can we help?'}</h3>
      <p>Please enter your details to start chatting with our support team.</p>
      <div class="cf-chat-input-group">
        <label class="cf-chat-label">Name</label>
        <input type="text" class="cf-chat-text-input" id="cf-chat-name" required>
      </div>
      <div class="cf-chat-input-group">
        <label class="cf-chat-label">Email</label>
        <input type="email" class="cf-chat-text-input" id="cf-chat-email" required>
      </div>
      <div id="cf-turnstile"></div>
      <button type="submit" class="cf-chat-button-primary">Start Chat</button>
    `;
    chatWindow.appendChild(initForm);
    
    // Chat form (hidden initially)
    chatForm = document.createElement('form');
    chatForm.className = 'cf-chat-form';
    chatForm.style.display = 'none';
    chatForm.innerHTML = `
      <textarea class="cf-chat-input" placeholder="${TEXT.placeholder || 'Type your message...'}" rows="1"></textarea>
      <button type="submit" class="cf-chat-send">${TEXT.sendButton || 'Send'}</button>
    `;
    chatWindow.appendChild(chatForm);
    
    chatInput = chatForm.querySelector('.cf-chat-input');
    sendButton = chatForm.querySelector('.cf-chat-send');
    
    // Event listeners
    initForm.querySelector('button').onclick = handleInitSubmit;
    chatForm.onsubmit = handleMessageSubmit;
    
    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });
    
    document.body.appendChild(chatWindow);
    
    // Load Turnstile
    loadTurnstile();
  }
  
  /**
   * Load Cloudflare Turnstile
   */
  function loadTurnstile() {
    if (typeof turnstile === 'undefined') {
      setTimeout(loadTurnstile, 100);
      return;
    }
    
    turnstile.render('#cf-turnstile', {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => {
        turnstileToken = token;
      },
    });
  }
  
  /**
   * Toggle chat window
   */
  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }
  
  /**
   * Open chat window
   */
  function openChat() {
    if (!chatWindow) {
      createChatWindow();
    }
    chatWindow.classList.add('open');
    isOpen = true;
    
    // Focus input
    if (initForm.style.display !== 'none') {
      initForm.querySelector('#cf-chat-name').focus();
    } else if (chatInput) {
      chatInput.focus();
    }
  }
  
  /**
   * Close chat window
   */
  function closeChat() {
    if (chatWindow) {
      chatWindow.classList.remove('open');
    }
    isOpen = false;
  }
  
  /**
   * Handle init form submit
   */
  async function handleInitSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('cf-chat-name').value.trim();
    const email = document.getElementById('cf-chat-email').value.trim();
    
    if (!name || !email) {
      alert('Please enter your name and email');
      return;
    }
    
    if (!turnstileToken) {
      alert('Please complete the verification');
      return;
    }
    
    // Hide init form, show chat
    initForm.style.display = 'none';
    chatMessages.style.display = 'flex';
    chatForm.style.display = 'flex';
    
    // Connect WebSocket
    connectWebSocket(name, email, turnstileToken);
  }
  
  /**
   * Handle message submit
   */
  function handleMessageSubmit(e) {
    e.preventDefault();
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    if (message.length > MAX_MESSAGE_LENGTH) {
      addSystemMessage(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }
    
    sendMessage(message);
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }
  
  /**
   * Connect to WebSocket
   */
  function connectWebSocket(name, email, token) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    setStatus('connecting');
    
    const wsUrl = WORKER_URL.replace(/^http/, 'ws') + '/ws';
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Send init message
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          name,
          email,
          page: window.location.pathname,
          turnstileToken: token,
          sessionId: sessionId,
        },
      }));
    };
    
    ws.onmessage = (event) => {
      handleServerMessage(JSON.parse(event.data));
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setStatus('disconnected');
      scheduleReconnect(name, email, token);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('disconnected');
    };
  }
  
  /**
   * Handle server messages
   */
  function handleServerMessage(message) {
    switch (message.type) {
      case 'ready':
        setStatus('connected');
        sessionId = message.data.sessionId;
        saveSession();
        addSystemMessage(message.data.message);
        break;
      case 'message':
        addAgentMessage(message.data.message, message.data.author);
        break;
      case 'error':
        addSystemMessage('Error: ' + message.data.message);
        break;
      case 'pong':
        // Heartbeat response
        break;
    }
  }
  
  /**
   * Send message
   */
  function sendMessage(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addSystemMessage('Not connected. Please wait...');
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'message',
      data: { message },
    }));
    
    addUserMessage(message);
  }
  
  /**
   * Add user message to chat
   */
  function addUserMessage(text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'cf-chat-message user';
    messageEl.textContent = text;
    chatMessages.appendChild(messageEl);
    scrollToBottom();
  }
  
  /**
   * Add agent message to chat
   */
  function addAgentMessage(text, author) {
    const messageEl = document.createElement('div');
    messageEl.className = 'cf-chat-message agent';
    
    if (author) {
      const authorEl = document.createElement('div');
      authorEl.className = 'cf-chat-message-author';
      authorEl.textContent = author;
      messageEl.appendChild(authorEl);
    }
    
    const textEl = document.createElement('div');
    textEl.textContent = text;
    messageEl.appendChild(textEl);
    
    chatMessages.appendChild(messageEl);
    scrollToBottom();
  }
  
  /**
   * Add system message to chat
   */
  function addSystemMessage(text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'cf-chat-message system';
    messageEl.textContent = text;
    chatMessages.appendChild(messageEl);
    scrollToBottom();
  }
  
  /**
   * Scroll to bottom of messages
   */
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  /**
   * Set connection status
   */
  function setStatus(status) {
    if (!statusIndicator) return;
    
    statusIndicator.className = 'cf-chat-status ' + status;
  }
  
  /**
   * Schedule reconnection
   */
  function scheduleReconnect(name, email, token) {
    if (reconnectTimer) return;
    
    const delay = RECONNECT_INTERVALS[Math.min(reconnectAttempt, RECONNECT_INTERVALS.length - 1)];
    reconnectAttempt++;
    
    addSystemMessage(`Reconnecting in ${delay / 1000}s...`);
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket(name, email, token);
    }, delay);
  }
  
  /**
   * Save session to localStorage
   */
  function saveSession() {
    if (!sessionId) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessionId,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }
  
  /**
   * Restore session from localStorage
   */
  function restoreSession() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      // Check if session is still valid
      if (Date.now() - data.timestamp > SESSION_TIMEOUT) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      
      sessionId = data.sessionId;
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
