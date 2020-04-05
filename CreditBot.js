const TelegramBot = require('node-telegram-bot-api');

class CreditBot {
    constructor(token) {
      this.botImpl = new TelegramBot(token, { polling: true })
    }

    registerMessageHandler(msgHandler) {
      this.botImpl.on("message", msgHandler);
    }

    registerErrorHandler(errHandler) {
      this.botImpl.on("polling_error", (err) => errHandler(err));
    }

    sendMessage(chatId, message, keyboardItems, additionalArgs) {
      const reply = {};
      const replyMarkup = {};
      if (keyboardItems == null)
      {
        replyMarkup.remove_keyboard = true;
      }
      else
      {
        replyMarkup.keyboard = keyboardItems;
      }

      reply.reply_markup = replyMarkup;
      this.botImpl.sendMessage(chatId, message, {...reply, ...additionalArgs});
    }
}

module.exports = CreditBot;
