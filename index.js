const TelegramBot = require('node-telegram-bot-api');
const token = require('./token');
const bot = new TelegramBot(token.url, { polling: true });

const STATES = {
  CREATE_ENTITY_FIRST_QUESTION: "CREATE_ENTITY_FIRST_QUESTION",
  CREATE_ENTITY_SECOND_QUESTION: "CREATE_ENTITY_SECOND_QUESTION",
  CREATED: "CREATED",
  ANSWERING_QUESTIONS: "ANSWERING_QUESTIONS",
  FINISH_ANSWERING_QUESTIONS: 'FINISH_ANSWERING_QUESTIONS',
  WRITING_RULE: 'WRITING_RULE'
};

const usersState = {};
const entities = {};
const usersCurrentEntity = {};
const usersCurrentNumberOfQuestion = {};
const usersAnswers = {};
let rule = '';

entities.Age = {
  name: 'Age',
  message: 'How old are you?'
};

entities.Car = {
  name: 'Car',
  message: 'Do you have a car?'
};

bot.onText(/\/help/, msg => {
  const chatId = msg.chat.id
  bot.sendMessage(chatId, 'Я умею показывать расписание, чтобы посмотреть его введи сообщение, которое содержит "расписание", а также отвечаю на некоторые сообщения) ')
});

///////////////////////////////////////////////////////////////////////


bot.onText(/\/tasks/, msg => {
  const chatId = msg.from.id;

  bot.sendMessage(chatId, 'Что нужно сделать?', {
    reply_markup:{
      keyboard: [
        ['Создать элемент'],
        ['Посмотреть элементы'],
        ['Пройти опрос'],
        ['Записать правило'],
        ['Закрыть']
      ]
    }
  })
});
  



///////////////////////////////////////////////////////////////////////

  bot.on('message', msg => {
    const chatId = msg.from.id;
      
    switch(usersState[chatId]) {
    case STATES.CREATE_ENTITY_FIRST_QUESTION:

      const entityName = msg.text;
      entities[entityName] = {
        name: entityName,
        message: ''
      };
      usersState[chatId] = STATES.CREATE_ENTITY_SECOND_QUESTION;
      usersCurrentEntity[chatId] = entityName;

      bot.sendMessage(chatId, 'Напишите вопрос для этого элемента', {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;

    case STATES.CREATE_ENTITY_SECOND_QUESTION:
      
      entities[usersCurrentEntity[chatId]].message = msg.text;
      usersState[chatId] = STATES.CREATED;

      bot.sendMessage(chatId, 'Спасибо за создание элемента', {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;

    case STATES.ANSWERING_QUESTIONS:

      const entitiesKeys = Object.keys(entities);
      console.log(entitiesKeys);
      const currentKey = entitiesKeys[usersCurrentNumberOfQuestion[chatId]];
      console.log(currentKey);
      usersAnswers[chatId][currentKey] = msg.text;


      usersCurrentNumberOfQuestion[chatId]++;

      if(entitiesKeys.length === usersCurrentNumberOfQuestion[chatId]) {
        const answers = JSON.stringify(usersAnswers[chatId]);
        normilizeAnswers(usersAnswers[chatId]);
        const result = checkAnswers(usersAnswers[chatId]);
        console.log(usersAnswers[chatId]);
        bot.sendMessage(chatId, 'Спасибо за Ваши ответы' + answers + result, {
          reply_markup:{
            remove_keyboard: true
          }
        });
        
        
        usersState[chatId] = STATES.FINISH_ANSWERING_QUESTIONS;
        usersCurrentNumberOfQuestion[chatId] = 0;
        usersAnswers[chatId] = {};
        return;
      }

    
      const nextKey = entitiesKeys[usersCurrentNumberOfQuestion[chatId]];
      const question = entities[nextKey].message;
      
      bot.sendMessage(chatId, question, {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;

    case STATES.WRITING_RULE:
      rule = msg.text;
      try {
        eval(`with(entities) { ${rule.replace(/&&/g, '&').replace(/\|\|/g, '&')} }`);
        usersState[chatId] = STATES.CREATED;
        bot.sendMessage(chatId, 'Правило успешно записано', {
          reply_markup:{
            remove_keyboard: true
          }
        });
      } catch (error) {
        rule = '';
        if (error instanceof SyntaxError) {
          bot.sendMessage(chatId, 'Правило задано с ошибкой, попробуйте еще раз: неправильный синтаксис', {
            reply_markup:{
              remove_keyboard: true
            }
          });
        } else if (error instanceof ReferenceError) {
          const key = error.message.split(' ')[0];
          bot.sendMessage(chatId, `Правило задано с ошибкой, попробуйте еще раз: элемента с ключом ${key} не найдено`, {
            reply_markup:{
              remove_keyboard: true
            }
          });
        }
      }
  }

  if (msg.text === 'Создать элемент') {
    console.log('element');
    const chatId = msg.from.id;
    usersState[chatId] = STATES.CREATE_ENTITY_FIRST_QUESTION;
    bot.sendMessage(chatId, 'Напишите название элемента', {
      reply_markup:{
        remove_keyboard: true
      }
    });
    return;
    }

    if(msg.text === 'Посмотреть элементы') {
      const message = createListOfEntities(entities).length > 0 ? createListOfEntities(entities) : 'Элементы еще не созданы';
      bot.sendMessage(chatId, message, {
        reply_markup:{
          remove_keyboard: true
        },
        parse_mode: 'HTML'
      });
      return;
    }

    if(msg.text === 'Пройти опрос') {
      if(rule.length === 0) {
        bot.sendMessage(chatId, 'Сначала создайте правило', {
          reply_markup:{
            remove_keyboard: true
          }
        });
        return;
      }
      usersState[chatId] = STATES.ANSWERING_QUESTIONS;
      usersCurrentNumberOfQuestion[chatId] = 0;

      ///////////////////////////////////////////////////

      const entitiesKeys = Object.keys(entities);

      const currentKey = entitiesKeys[usersCurrentNumberOfQuestion[chatId]];
      const question = entities[currentKey].message;
      usersAnswers[chatId] = {};
      bot.sendMessage(chatId, question, {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;



      ///////////////////////////////////////////////////


      return;
    }

    if(msg.text === 'Записать правило') {
      if(Object.keys(entities).length === 0) {
        bot.sendMessage(chatId, 'Сначала создайте элементы', {
          reply_markup:{
            remove_keyboard: true
          }
        });
        return;
      }
      usersState[chatId] = STATES.WRITING_RULE;
      bot.sendMessage(chatId, 'Запишите правило', {
        reply_markup:{
          remove_keyboard: true
        }
      });
    }

  });

bot.on("polling_error", (err) => console.log(err));

function createListOfEntities(entities) {
  let message = '';
  let index = 0;
  for(const key in entities) {
    index++;
    message+= `${index}. Название элемента: ${entities[key].name}\nВопрос для элемента: ${entities[key].message}\n\n`;
  }
  return message;
}

function normilizeAnswers (answers) {
  for(const key in answers) {
    if(isNaN(parseInt(answers[key], 10))) {
      if(answers[key] === 'Да') {
        answers[key] = true;
      }
      if(answers[key] === 'Нет') {
        answers[key] = false;
      }
    } else {
      answers[key] = parseInt(answers[key]);
    }
  }
}

function checkAnswers(answers) {
  return eval(`with(answers) { ${rule} }`);
}