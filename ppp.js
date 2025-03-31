const { Telegraf } = require("telegraf"); const fs = require("fs"); const path = require("path");

const BOT_TOKEN = "7620399081:AAHeCUimxg365BH0Y0P_aWoWl1MQF0r7DQw"; const ADMIN_ID = "7689032393"; const bot = new Telegraf(BOT_TOKEN);

const sessions = {};

bot.start((ctx) => { ctx.reply("📂 Send me a .txt file containing phone numbers."); });

bot.on("document", async (ctx) => { const chatId = ctx.chat.id; if (!ctx.message.document) return;

const fileId = ctx.message.document.file_id;
const fileUrl = await ctx.telegram.getFileLink(fileId);

sessions[chatId] = { fileUrl, step: "waiting_for_filename" };
ctx.reply("📄 Enter the base name for .vcf files (e.g., 'me 1'):");

});

bot.on("text", async (ctx) => { const chatId = ctx.chat.id; const session = sessions[chatId]; if (!session) return;

if (session.step === "waiting_for_filename") {
    session.filename = ctx.message.text;
    session.step = "waiting_for_num_files";
    ctx.reply("🔢 How many .vcf files should be generated?");
} else if (session.step === "waiting_for_num_files") {
    session.numFiles = parseInt(ctx.message.text);
    session.step = "waiting_for_contacts_per_file";
    ctx.reply("📞 How many contacts per .vcf file?");
} else if (session.step === "waiting_for_contacts_per_file") {
    session.numContacts = parseInt(ctx.message.text);
    session.step = "waiting_for_contact_prefix";
    ctx.reply("📛 Enter the contact name prefix (e.g., 'Contact'):");
} else if (session.step === "waiting_for_contact_prefix") {
    session.contactPrefix = ctx.message.text;
    session.step = "processing";
    ctx.reply("⏳ Processing your file...");
    await processFile(ctx, session);
}

});

async function processFile(ctx, session) { try { const response = await fetch(session.fileUrl); const text = await response.text(); const numbers = text.split("\n").map(num => num.trim()).filter(num => num);

if (numbers.length === 0) {
        return ctx.reply("❌ No valid phone numbers found in the file.");
    }
    
    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    
    let fileCount = 1;
    let numIndex = 0;
    
    for (let i = 0; i < session.numFiles; i++) {
        const vcfFileName = `${session.filename.split(" ")[0]} ${fileCount}.vcf`;
        const vcfFilePath = path.join(outputDir, vcfFileName);
        const vcfStream = fs.createWriteStream(vcfFilePath);
        
        for (let j = 0; j < session.numContacts; j++) {
            if (numIndex >= numbers.length) break;
            const contactName = `${session.contactPrefix} ${numIndex + 1}`;
            vcfStream.write(`BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${numbers[numIndex]}\nEND:VCARD\n`);
            numIndex++;
        }
        
        vcfStream.end();
        fileCount++;
        await ctx.replyWithDocument({ source: vcfFilePath });
    }
    
    ctx.reply("✅ Conversion complete!");
} catch (error) {
    console.error(error);
    ctx.reply("❌ An error occurred while processing the file.");
}

}

bot.command("admin", (ctx) => { if (ctx.chat.id.toString() !== ADMIN_ID) { return ctx.reply("❌ You are not authorized to access the admin panel."); } ctx.reply("🛠 Admin Panel\n1️⃣ View Users (/users)\n2️⃣ Remove User (/remove_user <id>)"); });

bot.launch();

