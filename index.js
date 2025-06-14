import express from 'express';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import ollama from 'ollama';

const app = express();
app.use(express.json());

// Configuration
const TARGET_NUMBER = '555193309135'; // Replace with your target number

// Create a new WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/snap/bin/chromium',   // ou /usr/bin/google-chrome
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
});

// Generate QR Code
client.on('qr', (qr) => {
    console.log('QR Code received:');
    qrcode.generate(qr, { small: true });
});

// When client is ready
client.on('ready', () => {
    console.log('Client is ready!');
});

// Message listener
client.on('message', async (message) => {
    try {
        // Check if the message is from the target number
        const senderNumber = message.from.split('@')[0];
        if (senderNumber === TARGET_NUMBER) {
            console.log('Received message from target number:', message.body);

            // Generate response using Ollama
            const response = await ollama.chat({
                model: 'llama3',
                messages: [
                    { role: 'system', content: 'You are a helpful AI assistant. Please provide clear and concise responses.' },
                    { role: 'user', content: message.body }
                ],
            });

            // Send the response back
            await message.reply(response.message.content);
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