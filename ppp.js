const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const request = require('request');

// Replace with your actual Telegram bot token
const token = '7951430892:AAEYIQBazB2smsBwTvFjc-K82oAP7JBKwbI';

const bot = new TelegramBot(token, { polling: true });

const adminId = 7689032393;
let userState = {}; 
let premiumUsers = {}; 
let redeemCodes = {}; 

// Save and load data
const saveData = () => fs.writeFileSync('subscriptions.json', JSON.stringify(premiumUsers, null, 2));
const loadData = () => {
    if (fs.existsSync('subscriptions.json')) {
        premiumUsers = JSON.parse(fs.readFileSync('subscriptions.json'));
    }
    if (fs.existsSync('codes.json')) {
        redeemCodes = JSON.parse(fs.readFileSync('codes.json'));
    }
};

// Load existing subscription data on startup
loadData();

// Admin panel access
bot.onText(/\/abiyet/, (msg) => {
    if (msg.chat.id !== adminId) return;
    bot.sendMessage(adminId, "🛠 Admin Panel\n\nCommands:\n/generatecode <days> - Create a premium code\n/subscribers - View active users\n/deleteuser <user_id> - Remove a user\n/listcodes - Show all available codes\n/resetcodes - Delete all unused codes");
});

// Generate redeem codes
bot.onText(/\/generatecode (\d+)/, (msg, match) => {
    if (msg.chat.id !== adminId) return;
    const days = parseInt(match[1]);
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    redeemCodes[code] = { days, used: false };
    saveData();
    bot.sendMessage(adminId, `✅ Generated Code: ${code}\nValid for: ${days} days`);
});

// List all generated codes
bot.onText(/\/listcodes/, (msg) => {
    if (msg.chat.id !== adminId) return;
    let codesList = "🎟 Available Codes:\n";
    for (const [code, details] of Object.entries(redeemCodes)) {
        if (!details.used) codesList += `🔹 ${code} - ${details.days} days\n`;
    }
    bot.sendMessage(adminId, codesList || "No available codes.");
});

// Reset all unused codes
bot.onText(/\/resetcodes/, (msg) => {
    if (msg.chat.id !== adminId) return;
    redeemCodes = {};
    saveData();
    bot.sendMessage(adminId, "🗑 All unused codes have been deleted.");
});

// View active subscriptions
bot.onText(/\/subscribers/, (msg) => {
    if (msg.chat.id !== adminId) return;
    let response = "📋 Active Subscribers:\n";
    for (const [userId, details] of Object.entries(premiumUsers)) {
        response += `👤 ${userId} - Expires: ${new Date(details.expires).toLocaleString()}\n`;
    }
    bot.sendMessage(adminId, response || "No active subscribers.");
});

// Remove a user’s subscription
bot.onText(/\/deleteuser (\d+)/, (msg, match) => {
    if (msg.chat.id !== adminId) return;
    const userId = match[1];
    if (premiumUsers[userId]) {
        delete premiumUsers[userId];
        saveData();
        bot.sendMessage(adminId, `❌ Removed premium access for user ${userId}.`);
    } else {
        bot.sendMessage(adminId, "⚠️ User not found.");
    }
});

// User redeeming a code
bot.onText(/\/redeem (\w+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const code = match[1];

    if (!redeemCodes[code]) {
        bot.sendMessage(chatId, "❌ Invalid code.");
        return;
    }
    if (redeemCodes[code].used) {
        bot.sendMessage(chatId, "⚠️ Code already used.");
        return;
    }

    const days = redeemCodes[code].days;
    const expires = Date.now() + days * 24 * 60 * 60 * 1000;
    premiumUsers[chatId] = { expires };
    redeemCodes[code].used = true;
    
    saveData();
    bot.sendMessage(chatId, `🎉 You are now premium for ${days} days!`);
});

// Check if user is premium
const isPremium = (chatId) => premiumUsers[chatId] && premiumUsers[chatId].expires > Date.now();

// Start bot (hide intro message for premium users)
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (isPremium(chatId)) {
        bot.sendMessage(chatId, "✅ Welcome back! You are already a premium user.");
        return;
    }

    bot.sendMessage(chatId, "🚀 Introducing the Ultimate TXT to VCF Converter Bot! 📂➡️📇\n\n✅ Convert .txt files into .vcf contacts instantly!\n✅ Customize file names and contact details with ease!\n✅ Premium Subscription Plans Available\n🔹 3 Days – $3\n🔹 5 Days – $6\n🔹 14 Days – $12\n✅ Redeem Code System – Get premium access with special codes!\n✅ Join @VCFUPDATESS to Access the Bot!\n\n🎯 How to Start?\n1️⃣ Join this channel (@VCFUPDATESS)\n2️⃣ Start the bot\n3️⃣ Convert your TXT files effortlessly!");
});
