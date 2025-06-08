const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

// Initialize Express for Render deployment
const app = express();
const port = process.env.PORT || 3000;

// Initialize Telegram Bot
const botToken = process.env.BOT_TOKEN;
const channelId = process.env.CHANNEL_ID; // Your Telegram channel ID (e.g., @YourChannel)
const supportHandle = '@dayamsmartsolutions';
const bot = new TelegramBot(botToken, { polling: true });

// VPN Plans
const vpnPlans = [
  { duration: '4 days', price: 70 },
  { duration: '1 week', price: 100 },
  { duration: '2 weeks', price: 160 },
  { duration: '3 weeks', price: 250 },
  { duration: '1 month', price: 300 },
];

// Store user state and rate limiting
const userStates = new Map();
const rateLimits = new Map(); // Tracks message submissions for rate limiting

// Rate limiting configuration (5 messages per hour)
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Welcome message with animation
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🌟 *Welcome to VPN Shop!* 🌟
Unlimited Airtel VPN access in Kenya! 🇰🇪

🔍 Choose a plan below to get started.
📞 Need help? Contact ${supportHandle}

🚀 Let's connect you securely!
  `;
  const keyboard = {
    inline_keyboard: vpnPlans.map((plan) => [
      {
        text: `${plan.duration} - Ksh.${plan.price}`,
        callback_data: `select_${plan.duration}`,
      },
    ]),
  };
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

// Help command with FAQ
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
❓ *Need Assistance?* ❓
Select a topic or contact ${supportHandle} for support.

Choose an option:
  `;
  const keyboard = {
    inline_keyboard: [
      [{ text: 'How to Pay?', callback_data: 'faq_payment' }],
      [{ text: 'VPN Setup Guide', callback_data: 'faq_setup' }],
      [{ text: 'Contact Support', url: `https://t.me/dayamsmartsolutions` }],
    ],
  };
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown', reply_markup: keyboard });
});

// Cancel command
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (userStates.has(userId)) {
    userStates.delete(userId);
    bot.sendMessage(chatId, '✅ Action cancelled. Use /start to begin again.', { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, '❌ Nothing to cancel. Use /start to select a plan.', { parse_mode: 'Markdown' });
  }
});

// Status command
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (userStates.has(userId)) {
    const state = userStates.get(userId);
    bot.sendMessage(chatId, `
📊 *Your Status*
🪙 Plan Selected: ${state.plan} (Ksh.${state.price})
📬 Waiting for: M-Pesa transaction message
🔄 Use /cancel to stop or ${supportHandle} for help.
    `, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, 'ℹ️ No active process. Use /start to select a plan.', { parse_mode: 'Markdown' });
  }
});

// Support command
bot.onText(/\/support/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `📞 Need help? Contact our support team at ${supportHandle}`, { parse_mode: 'Markdown' });
});

// Handle inline button callbacks
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const username = query.from.username || query.from.first_name;
  const data = query.data;

  // Plan selection
  if (data.startsWith('select_')) {
    const duration = data.replace('select_', '');
    const plan = vpnPlans.find((p) => p.duration === duration);
    if (plan) {
      const confirmMessage = `
🪙 You chose: *${plan.duration}* for *Ksh.${plan.price}*

✅ Confirm to proceed or cancel.
      `;
      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Confirm', callback_data: `confirm_${duration}` }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      };
      bot.sendMessage(chatId, confirmMessage, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }
  // Plan confirmation
  else if (data.startsWith('confirm_')) {
    const duration = data.replace('confirm_', '');
    const plan = vpnPlans.find((p) => p.duration === duration);
    if (plan) {
      const paymentInstructions = `
✅ *Plan Confirmed: ${plan.duration} (Ksh.${plan.price})*

💰 Send payment to M-Pesa: *0706535581*

📋 After paying, paste the M-Pesa transaction message here (e.g., "QJ12345678 Confirmed. Ksh.100 received...").
🔄 Use /cancel to stop or contact ${supportHandle} for help.
      `;
      userStates.set(userId, { plan: duration, price: plan.price, username });
      bot.sendMessage(chatId, paymentInstructions, { parse_mode: 'Markdown' });
    }
  }
  // Cancel selection
  else if (data === 'cancel') {
    userStates.delete(userId);
    bot.sendMessage(chatId, '✅ Selection cancelled. Use /start to try again.', { parse_mode: 'Markdown' });
  }
  // FAQ responses
  else if (data === 'faq_payment') {
    bot.sendMessage(chatId, `
💸 *How to Pay?*
1. Select a plan using /start.
2. Send the amount to M-Pesa number *0706535581*.
3. Paste the M-Pesa transaction message here.
4. Wait for our team to verify and send your VPN files.

📞 Issues? Contact ${supportHandle}
    `, { parse_mode: 'Markdown' });
  }
  else if (data === 'faq_setup') {
    bot.sendMessage(chatId, `
🛠 *VPN Setup Guide*
1. Receive your VPN file after payment verification.
2. Download a VPN app (e.g., OpenVPN).
3. Import the .ovpn file we send you.
4. Connect and enjoy secure browsing! 🌐

📞 Need help? Contact ${supportHandle}
    `, { parse_mode: 'Markdown' });
  }

  bot.answerCallbackQuery(query.id);
});

// Handle incoming messages (M-Pesa transaction)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;
  const text = msg.text;

  // Ignore commands
  if (text && text.startsWith('/')) return;

  // Check rate limit
  const now = Date.now();
  if (!rateLimits.has(userId)) {
    rateLimits.set(userId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
  }
  const userLimit = rateLimits.get(userId);
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
  }
  if (userLimit.count >= RATE_LIMIT) {
    bot.sendMessage(chatId, `⚠️ Too many submissions! Please wait a while or contact ${supportHandle}.`, { parse_mode: 'Markdown' });
    return;
  }

  // Process M-Pesa message
  if (userStates.has(userId)) {
    userLimit.count += 1;
    const state = userStates.get(userId);

    // Basic validation (check if message looks like an M-Pesa transaction)
    if (!text.includes('Confirmed') || !text.includes('Ksh')) {
      bot.sendMessage(chatId, `
❌ Invalid M-Pesa message. Please paste the full transaction message (e.g., "QJ12345678 Confirmed. Ksh.100 received...").
🔄 Try again or contact ${supportHandle} for help.
      `, { parse_mode: 'Markdown' });
      return;
    }

    const forwardMessage = `
📥 *New Payment Confirmation*
👤 User: @${state.username}
🪙 Plan: ${state.plan} (Ksh.${state.price})
💬 M-Pesa Message: ${text}
    `;
    bot.sendMessage(channelId, forwardMessage, { parse_mode: 'Markdown' })
      .then(() => {
        bot.sendMessage(chatId, `
✅ *Payment Submitted!*
Our team will verify your transaction and send your VPN files soon. 🚀
📞 Questions? Contact ${supportHandle}
        `, { parse_mode: 'Markdown' });
        userStates.delete(userId);
      })
      .catch((error) => {
        console.error('Error forwarding to channel:', error);
        bot.sendMessage(chatId, `
❌ An error occurred. Please try again or contact ${supportHandle} for assistance.
        `, { parse_mode: 'Markdown' });
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
  bot.sendMessage(channelId, '🤖 *VPN Bot Started!* Ready to process orders.', { parse_mode: 'Markdown' });
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Shutting down bot...');
  bot.sendMessage(channelId, '🛑 *VPN Bot Stopped.*', { parse_mode: 'Markdown' });
  bot.stopPolling();
  process.exit(0);
});
