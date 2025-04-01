const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const request = require('request');

// Replace with your actual Telegram bot token
const token = '7951430892:AAEYIQBazB2smsBwTvFjc-K82oAP7JBKwbI';

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

let userState = {}; // To store the user progress

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Please send me a .txt file to convert.');
});

// Handling document uploads
bot.on('document', (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  // Ensure the uploaded file is a .txt file
  if (!fileName.endsWith('.txt')) {
    bot.sendMessage(chatId, "Please upload a valid .txt file.");
    return;
  }

  // Initialize user state
  if (!userState[chatId]) {
    userState[chatId] = { step: 1, fileId: fileId, fileName: fileName, fileData: null };
  } else {
    userState[chatId].fileId = fileId;
    userState[chatId].fileName = fileName;
  }

  // Start asking questions
  bot.sendMessage(chatId, "Please provide the initial file name (e.g., file 1).");
  userState[chatId].step = 2;
});

// Handling user responses
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!userState[chatId]) return; // Ignore if user is not in progress

  const user = userState[chatId];

  switch (user.step) {
    case 2: // Ask for initial file name
      user.fileName = msg.text;
      bot.sendMessage(chatId, "How many .vcf files should I create?");
      user.step = 3;
      break;

    case 3: // Ask for number of files
      const numFiles = parseInt(msg.text);
      if (isNaN(numFiles) || numFiles <= 0) {
        bot.sendMessage(chatId, "Please provide a valid number of files.");
        return;
      }
      user.numFiles = numFiles;
      bot.sendMessage(chatId, "How many numbers should be in each .vcf file?");
      user.step = 4;
      break;

    case 4: // Ask for numbers per file
      const numbersPerFile = parseInt(msg.text);
      if (isNaN(numbersPerFile) || numbersPerFile <= 0) {
        bot.sendMessage(chatId, "Please provide a valid number of contacts per file.");
        return;
      }
      user.numbersPerFile = numbersPerFile;
      bot.sendMessage(chatId, "Please provide the contact name prefix (e.g., contact 1).");
      user.step = 5;
      break;

    case 5: // Ask for contact name prefix
      user.contactPrefix = msg.text;
      bot.sendMessage(chatId, "I am processing the file now. Please wait...");

      // Proceed to download and process the .txt file
      bot.getFileLink(user.fileId).then((fileLink) => {
        const fileStream = fs.createWriteStream('temp.txt');
        request(fileLink).pipe(fileStream);

        fileStream.on('finish', () => {
          fs.readFile('temp.txt', 'utf8', (err, data) => {
            if (err) {
              bot.sendMessage(chatId, "Sorry, something went wrong with the file.");
              return;
            }

            const lines = data.split('\n');
            let contactIndex = 1;

            // Loop through the number of files to create
            for (let i = 0; i < user.numFiles; i++) {
              let vcfContent = '';
              for (let j = 0; j < user.numbersPerFile && contactIndex <= lines.length; j++) {
                const contact = lines[contactIndex - 1].trim();
                if (contact) {
                  vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${user.contactPrefix} ${contactIndex}\nTEL:${contact}\nEND:VCARD\n`;
                }
                contactIndex++;
              }

              // Save each .vcf file with the incremented file name (e.g., "file 1.vcf", "file 2.vcf")
              fs.writeFile(`${user.fileName} ${i + 1}.vcf`, vcfContent, (err) => {
                if (err) {
                  bot.sendMessage(chatId, "Sorry, I couldn't save the VCF file.");
                  return;
                }

                // Send the .vcf file to the user
                bot.sendDocument(chatId, `${user.fileName} ${i + 1}.vcf`);
              });
            }

            // Reset the user state after processing
            userState[chatId] = null;
          });
        });
      }).catch((error) => {
        console.log('Error fetching file:', error);
        bot.sendMessage(chatId, "Sorry, I couldn't retrieve the file.");
      });
      break;

    default:
      // In case of unexpected behavior, restart the process
      bot.sendMessage(chatId, "Something went wrong. Please start over by typing /start.");
      userState[chatId] = null;
      break;
  }
});
