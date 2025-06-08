const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

// Initialize Express for Render deployment
const app = express();
const port = process.env.PORT || 3000;

// Initialize Telegram Bot
const botToken = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID; // Your Telegram channel ID (e.g., @YourChannel or chat ID)
const bot = new TelegramBot(botToken, { polling: true });

// VPN Plans
const vpnPlans = [
  { duration: '4 days', price: 70 },
  { duration: '1 week', price: 100 },
  { duration: '2 weeks', price: 160 },
  { duration: '3 weeks', price: 250 },
  { duration: '1 month', price: 300 },
];

// Store user state (e.g., waiting for M-Pesa message)
const userStates = new Map();

// Welcome message
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🌟 Welcome to the VPN Shop! 🌟
Get unlimited Airtel VPN access in Kenya! 🇰🇪
Please select a plan below:
  `;
  const keyboard = {
    inline_keyboard: vpnPlans.map((plan) => [
      {
        text: `${plan.duration} - Ksh.${plan.price}`,
        callback_data: `plan_${plan.duration}`,
      },
    ]),
  };
  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
  });
});

// Handle plan selection
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const username = query.from.username || query.from.first_name;
  const data = query.data;

  if (data.startsWith('plan_')) {
    const duration = data.replace('plan_', '');
    const plan = vpnPlans.find((p) => p.duration === duration);
    if (plan) {
      const paymentInstructions = `
✅ You selected: *${plan.duration}* for *Ksh.${plan.price}*

Please send the payment to the following M-Pesa number:
📞 *0703500820*

After making the payment, paste the M-Pesa transaction message here to confirm your payment.
Example: "QJ12345678 Confirmed. Ksh.100 received from..."

Waiting for your transaction message... ⏳
      `;
      // Store user state
      userStates.set(userId, { plan: duration, username });
      bot.sendMessage(chatId, paymentInstructions, { parse_mode: 'Markdown' });
    }
    bot.answerCallbackQuery(query.id);
  }
});

// Handle incoming messages (for M-Pesa transaction message)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;
  const text = msg.text;

  // Ignore commands
  if (text && text.startsWith('/')) return;

  // Check if user is in the process of submitting an M-Pesa message
  if (userStates.has(userId)) {
    const state = userStates.get(userId);
    const forwardMessage = `
📥 New Payment Confirmation
👤 User: @${state.username}
🪙 Plan: ${state.plan}
💬 M-Pesa Message: ${text}
    `;
    
    // Forward to channel
    bot.sendMessage(channelId, forwardMessage, { parse_mode: 'Markdown' })
      .then(() => {
        bot.sendMessage(chatId, `
✅ Thank you for your payment confirmation!
Our team will verify your transaction and send you the VPN files shortly. 🚀
        `);
        // Clear user state
        userStates.delete(userId);
      })
      .catch((error) => {
        console.error('Error forwarding to channel:', error);
        bot.sendMessage(chatId, '❌ An error occurred while processing your request. Please try again or contact support.');
      });
  }
});

// Handle polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Express server for Render health check
app.get('/', (req, res) => {
  res.send('Telegram VPN Bot is running!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});
