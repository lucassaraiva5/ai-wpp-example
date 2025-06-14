const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { LLama } = require('@llama-node/llama-cpp');
const { LLamaCpp } = require('@llama-node/core');

const app = express();
app.use(express.json());

// Configuration
const TARGET_NUMBER = '555193309135'; // Replace with your target number
const MODEL_PATH = './models/deepseek-coder-6.7b-instruct.Q5_K_M.gguf'; // Path to your LLAMA model

// Initialize LLAMA
const llama = new LLama(LLamaCpp);
const llmConfig = {
    modelPath: MODEL_PATH,
    enableLogging: true,
    nCtx: 1024,
    seed: 0,
    f16Kv: false,
    logitsAll: false,
    vocabOnly: false,
    useMlock: false,
    embedding: false,
    useMmap: true,
};

// Initialize LLAMA
async function initializeLLAMA() {
    try {
        await llama.load(llmConfig);
        console.log('LLAMA model loaded successfully');
    } catch (error) {
        console.error('Error loading LLAMA model:', error);
    }
}

// Create a new WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Generate QR Code
client.on('qr', (qr) => {
    console.log('QR Code received:');
    qrcode.generate(qr, { small: true });
});

// When client is ready
client.on('ready', () => {
    console.log('Client is ready!');
    initializeLLAMA();
});

// Message listener
client.on('message', async (message) => {
    try {
        // Check if the message is from the target number
        const senderNumber = message.from.split('@')[0];
        if (senderNumber === TARGET_NUMBER) {
            console.log('Received message from target number:', message.body);

            // Generate response using LLAMA
            const prompt = `Human: ${message.body}\nAssistant:`;
            const response = await llama.createCompletion({
                prompt,
                maxTokens: 200,
                temperature: 0.7,
                topP: 0.9,
                stop: ['Human:', '\n\n'],
            });

            // Send the response back
            await message.reply(response.text.trim());
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

// Initialize the client
client.initialize();

// API endpoint to send a message
app.post('/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message are required' });
        }

        // Format the number to include the country code
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
        
        const response = await client.sendMessage(formattedNumber, message);
        res.json({ success: true, messageId: response.id });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// API endpoint to get all chats
app.get('/chats', async (req, res) => {
    try {
        const chats = await client.getChats();
        const formattedChats = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            lastMessage: chat.lastMessage ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp
            } : null
        }));
        res.json(formattedChats);
    } catch (error) {
        console.error('Error getting chats:', error);
        res.status(500).json({ error: 'Failed to get chats' });
    }
});

// API endpoint to get messages from a specific chat
app.get('/messages/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 50 });
        
        const formattedMessages = messages.map(msg => ({
            id: msg.id._serialized,
            body: msg.body,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            author: msg.author || msg.from
        }));
        
        res.json(formattedMessages);
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 