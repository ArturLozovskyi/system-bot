const TelegramBot = require('node-telegram-bot-api');
const token = require('./token');
const bot = new TelegramBot(token.url, { polling: true });

const STATES = {
  STATE_CREATE_ENTITY_NAME: 0,
  STATE_CREATE_ENTITY_QUESTION: 1,
  STATE_CREATE_ENTITY_TYPE: 2,
  CREATED: 3,
  ANSWERING_QUESTIONS: 4,
  FINISH_ANSWERING_QUESTIONS: 5,
  WRITING_RULE: 6,
  STATE_DELETE_ENTITY: 7
};

const ENTITIES_TYPE = {
  NUMERIC: 'Numeric',
  BOOLEAN: 'Boolean'
};

const usersState = {};
const entities = {};
const usersCurrentEntity = {};
const usersCurrentNumberOfQuestion = {};
const usersAnswers = {};
let rule = '';

entities.Age = {
  name: 'Age',
  message: 'How old are you?',
  type: ENTITIES_TYPE.NUMERIC
};

entities.Car = {
  name: 'Car',
  message: 'Do you have a car?',
  type: ENTITIES_TYPE.BOOLEAN
};


  



///////////////////////////////////////////////////////////////////////

  bot.on('message', msg => {
    const chatId = msg.from.id;
      
    switch(usersState[chatId]) {
    case STATES.STATE_CREATE_ENTITY_NAME:

      const entityName = msg.text;
      entities[entityName] = {
        name: entityName,
        message: '',
        type: null
      };
      usersState[chatId] = STATES.STATE_CREATE_ENTITY_QUESTION;
      usersCurrentEntity[chatId] = entityName;

      bot.sendMessage(chatId, 'Напишите вопрос для этого элемента', {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;

    case STATES.STATE_CREATE_ENTITY_QUESTION:
      
      entities[usersCurrentEntity[chatId]].message = msg.text;
      usersState[chatId] = STATES.STATE_CREATE_ENTITY_TYPE;

      bot.sendMessage(chatId, 'Напишите тип элемента', {
        reply_markup:{
          keyboard: [
            [ENTITIES_TYPE.NUMERIC],
            [ENTITIES_TYPE.BOOLEAN],
          ]
        }
      });
      return;

    case STATES.STATE_CREATE_ENTITY_TYPE:

      entities[usersCurrentEntity[chatId]].type = msg.text;
      usersState[chatId] = STATES.CREATED;
      bot.sendMessage(chatId, 'Спасибо за создание элемента', {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;

    case STATES.STATE_DELETE_ENTITY:
      
      delete entities[msg.text];
      usersState[chatId] = STATES.CREATED;
      bot.sendMessage(chatId, 'Элемент удален', {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;

    case STATES.ANSWERING_QUESTIONS:

      const entitiesKeys = Object.keys(entities);
      const currentKey = entitiesKeys[usersCurrentNumberOfQuestion[chatId]];
      usersAnswers[chatId][currentKey] = msg.text;


      usersCurrentNumberOfQuestion[chatId]++;

      if(entitiesKeys.length === usersCurrentNumberOfQuestion[chatId]) {
        normilizeAnswers(usersAnswers[chatId]);
        const result = checkAnswers(usersAnswers[chatId]);
        const message = result === true ? 'Одобрено!' : 'Не одобрено!';
        bot.sendMessage(chatId, 'Спасибо за Ваши ответы!\n' + message, {
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
      const entityType = entities[nextKey].type;
      
      if(entityType === ENTITIES_TYPE.BOOLEAN) {
        bot.sendMessage(chatId, question, {
          reply_markup:{
            keyboard: [
              ['True'],
              ['False']
            ]
          }
        });
      } else {
        bot.sendMessage(chatId, question, {
          reply_markup:{
            remove_keyboard: true
          }
        });
      }
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
    usersState[chatId] = STATES.STATE_CREATE_ENTITY_NAME;
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
      const entityType = entities[currentKey].type;
      const messageOptions = {};

      usersAnswers[chatId] = {};
      if(entityType === ENTITIES_TYPE.BOOLEAN) {
        messageOptions.reply_markup = {
          keyboard: [
            ['True'],
            ['False']
          ]
        };          
      } else {
        messageOptions.reply_markup = {
          remove_keyboard: true
        }; 
      }
      bot.sendMessage(chatId, question, messageOptions);
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

    if(msg.text === 'Удалить элемент') {
      usersState[chatId] = STATES.STATE_DELETE_ENTITY;
      bot.sendMessage(chatId, 'Выберите название элемента, который нужно удалить', {
        reply_markup:{
          keyboard: [
            Object.keys(entities)
          ]
        }
      });
      return;

    }

    if (msg.text === '/help') {
      bot.sendMessage(chatId, 'Hello World!');
    }

    if (msg.text === '/tasks') {
      bot.sendMessage(chatId, 'Что нужно сделать?', {
        reply_markup:{
          keyboard: [
            ['Создать элемент'],
            ['Посмотреть элементы'],
            ['Пройти опрос'],
            ['Записать правило'],
            ['Удалить элемент'],
            ['Закрыть']
          ]
        }
      });
    }

  });

bot.on("polling_error", (err) => console.log(err));

function createListOfEntities(entities) {
  let message = '';
  let index = 0;
  for(const entity of Object.values(entities)) {
    index++;
    message += `${index}. Название элемента: ${entity.name}\n`;
    message += `Вопрос для элемента: ${entity.message}\n`;
    message += `Тип элемента: ${entity.type}\n`;
  }
  return message;
}

function normilizeAnswers (answers) {
  for(const key in answers) {
    if(isNaN(parseInt(answers[key], 10))) {
      if(answers[key] === 'True') {
        answers[key] = true;
      }
      if(answers[key] === 'False') {
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