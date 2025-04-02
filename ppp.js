const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const request = require('request');

// Replace with your actual Telegram bot token
const token = '7951430892:AAEYIQBazB2smsBwTvFjc-K82oAP7JBKwbI';

const bot = new TelegramBot(token, { polling: true });

const adminId = 7689032393;
let userState = {}; // To store user progress
let premiumUsers = {}; // Store user subscription details
let redeemCodes = {}; // Store generated redeem codes

// Save and load data
const saveData = () => fs.writeFileSync('subscriptions.json', JSON.stringify(premiumUsers, null, 2));
const loadData = () => {
    if (fs.existsSync('subscriptions.json')) {
        premiumUsers = JSON.parse(fs.readFileSync('subscriptions.json'));
    }
};

// Load existing subscription data on startup
loadData();

// Admin panel access
bot.onText(/\/abiyet/, (msg) => {
    if (msg.chat.id !== adminId) return;
    bot.sendMessage(adminId, "🛠 Admin Panel\n\nCommands:\n/generatecode <days> - Create a premium code\n/subscribers - View active users\n/resetuser <userId> - Reset user subscription");
});

// Generate redeem codes
bot.onText(/\/generatecode (\d+)/, (msg, match) => {
    if (msg.chat.id !== adminId) return;
    const days = parseInt(match[1]);
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    redeemCodes[code] = { days, used: false };
    bot.sendMessage(adminId, `✅ Generated Code: ${code}\nValid for: ${days} days`);
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

// Reset user subscription (admin function)
bot.onText(/\/resetuser (\d+)/, (msg, match) => {
    if (msg.chat.id !== adminId) return;
    const userId = match[1];
    if (premiumUsers[userId]) {
        delete premiumUsers[userId];
        saveData();
        bot.sendMessage(adminId, `✅ User ${userId}'s subscription has been reset.`);
    } else {
        bot.sendMessage(adminId, `❌ User ${userId} does not have an active subscription.`);
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

// Start bot
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (isPremium(chatId)) {
        bot.sendMessage(chatId, "📂 Convert your TXT files effortlessly into VCF format!");
    } else {
        bot.sendMessage(chatId, "🚀 Introducing the Ultimate TXT to VCF Converter Bot! 📂➡️📇\n\n✅ Convert .txt files into .vcf contacts instantly!\n✅ Customize file names and contact details with ease!\n✅ Premium Subscription Plans Available\n🔹 3 Days – $2\n🔹 7 Days – $5\n🔹 14 Days – $9\n🔹 1 Months Days – $15\n✅ Redeem Code System – Get premium access with special codes!\n✅ Join @VCFUPDATESS to Access the Bot!\n\n🎯 How to Start?\n1️⃣ Join this channel (@VCFUPDATESS)\n2️⃣ Start the bot\n3️⃣ Convert your TXT files effortlessly!");
    }
});

// File conversion process (only for premium users)
bot.on('document', (msg) => {
    const chatId = msg.chat.id;

    if (!isPremium(chatId)) {
        bot.sendMessage(chatId, "🔒 You need a premium subscription to use this feature. Use /redeem <code>.");
        return;
    }

    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name;

    if (!fileName.endsWith('.txt')) {
        bot.sendMessage(chatId, "⚠️ Please upload a valid .txt file.");
        return;
    }

    userState[chatId] = { step: 1, fileId, fileName };
    bot.sendMessage(chatId, "📂 Please provide the initial file name (e.g., file 1).");
    userState[chatId].step = 2;
});

// Handle file processing (same logic as your original)
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (!userState[chatId]) return;
    const user = userState[chatId];

    switch (user.step) {
        case 2:
            user.fileName = msg.text;
            bot.sendMessage(chatId, "📁 How many .vcf files should I create?");
            user.step = 3;
            break;

        case 3:
            const numFiles = parseInt(msg.text);
            if (isNaN(numFiles) || numFiles <= 0) {
                bot.sendMessage(chatId, "⚠️ Please enter a valid number.");
                return;
            }
            user.numFiles = numFiles;
            bot.sendMessage(chatId, "📇 How many numbers should be in each file?");
            user.step = 4;
            break;

        case 4:
            const numbersPerFile = parseInt(msg.text);
            if (isNaN(numbersPerFile) || numbersPerFile <= 0) {
                bot.sendMessage(chatId, "⚠️ Please enter a valid number.");
                return;
            }
            user.numbersPerFile = numbersPerFile;
            bot.sendMessage(chatId, "📛 Please provide the contact name prefix (e.g., Contact 1).");
            user.step = 5;
            break;

        case 5:
            user.contactPrefix = msg.text;
            bot.sendMessage(chatId, "⏳ Processing file...");

            bot.getFileLink(user.fileId).then((fileLink) => {
                const fileStream = fs.createWriteStream('temp.txt');
                request(fileLink).pipe(fileStream);

                fileStream.on('finish', () => {
                    fs.readFile('temp.txt', 'utf8', (err, data) => {
                        if (err) return bot.sendMessage(chatId, "❌ Error reading file.");
                        
                        const lines = data.split('\n');
                        let contactIndex = 1;

                        for (let i = 0; i < user.numFiles; i++) {
                            let vcfContent = '';
                            for (let j = 0; j < user.numbersPerFile && contactIndex <= lines.length; j++) {
                                const contact = lines[contactIndex - 1].trim();
                                if (contact) {
                                    vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${user.contactPrefix} ${contactIndex}\nTEL:${contact}\nEND:VCARD\n`;
                                }
                                contactIndex++;
                            }

                            fs.writeFile(`${user.fileName} ${i + 1}.vcf`, vcfContent, (err) => {
                                if (!err) bot.sendDocument(chatId, `${user.fileName} ${i + 1}.vcf`);
                            });
                        }
                        userState[chatId] = null;
                    });
                });
            });
            break;
    }
});
