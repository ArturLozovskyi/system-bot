const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

const COMMANDS = {
  create_entity: '/create_entity',
  delete_entity: '/delete_entity',
  list_entities: '/list_entities',
  create_rule: '/create_rule',
  take_survey: '/take_survey',
  start: '/start',
  help: '/help'
}

const STATES = {
  STATE_CREATE_ENTITY_NAME: 0,
  STATE_CREATE_ENTITY_QUESTION: 1,
  STATE_CREATE_ENTITY_TYPE: 2,
  CREATED: 3,
  ANSWERING_QUESTIONS: 4,
  FINISH_ANSWERING_QUESTIONS: 5,
  WRITING_RULE: 6,
  STATE_DELETE_ENTITY: 7,
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

    bot.sendMessage(chatId, 'Напишите вопрос для этой сущности, который будет показан пользователю при прохождении опроса', {
      reply_markup:{
        remove_keyboard: true
      }
    });
    return;

  case STATES.STATE_CREATE_ENTITY_QUESTION:
    
    entities[usersCurrentEntity[chatId]].message = msg.text;
    usersState[chatId] = STATES.STATE_CREATE_ENTITY_TYPE;

    bot.sendMessage(chatId, 'Напишите тип сущности', {
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
    bot.sendMessage(chatId, 'Сущность создана', {
      reply_markup:{
        remove_keyboard: true
      }
    });
    return;

  case STATES.STATE_DELETE_ENTITY:
    delete entities[msg.text];
    usersState[chatId] = STATES.CREATED;
    let messageToSend = 'Сущность удалена';
    if(rule.indexOf(msg.text) !== -1) {
      rule = '';
      messageToSend+= '. \nУдаленная сущность использовалась в правиле и правило было удалено. Создайте правило заново';
    }
    bot.sendMessage(chatId, messageToSend, {
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
        bot.sendMessage(chatId, `Правило задано с ошибкой, попробуйте еще раз: сущность с ${key} не найдена`, {
          reply_markup:{
            remove_keyboard: true
          }
        });
      }
    }
    return;
  }
  
  switch(msg.text) {
  case COMMANDS.create_entity: 
    usersState[chatId] = STATES.STATE_CREATE_ENTITY_NAME;
    bot.sendMessage(chatId, 'Напишите название сущности', {
      reply_markup:{
        remove_keyboard: true
      }
    });
    return;

  case COMMANDS.list_entities: 
    const message = createListOfEntities(entities).length > 0 ? createListOfEntities(entities) : 'Сущности еще не созданы';
    bot.sendMessage(chatId, message, {
      reply_markup:{
        remove_keyboard: true
      },
      parse_mode: 'HTML'
    });
    return;

  case COMMANDS.take_survey:
    if(rule.length === 0) {
      bot.sendMessage(chatId, 'Сначала создайте правило для одобрения кредита', {
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

    
  case COMMANDS.create_rule:
    if(Object.keys(entities).length === 0) {
      bot.sendMessage(chatId, 'Сначала создайте сущности', {
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
    return;

  case COMMANDS.delete_entity:

    if(Object.values(entities).length === 0) {
      usersState[chatId] = STATES.CREATED;
      bot.sendMessage(chatId, 'Созданных сущностей нет', {
        reply_markup:{
          remove_keyboard: true
        }
      });
      return;
    }

    usersState[chatId] = STATES.STATE_DELETE_ENTITY;
    bot.sendMessage(chatId, 'Выберите название сущности, которую нужно удалить', {
      reply_markup:{
        keyboard: Object.keys(entities).map((el) => [el])
      }
    });
    return;

  case COMMANDS.start:
    bot.sendMessage(chatId, `Привет, ${msg.from.first_name}! Напиши команду /help для более детальной информации`, {
      reply_markup:{
        remove_keyboard: true
      }
    });
    return;

  case COMMANDS.help:
    bot.sendMessage(chatId, `Команды стартового меню:
    <b>create_entity</b> - добавить в описываемую модель новый параметр, который пользователь должен будет  задать. Параметр может быть численный или формата да/нет. Также надо будет ввести вопрос для пользователя.
    <b>delete_entity</b> - удалить параметр по имени.
    <b>list_entities</b> - вывести список параметров и их вопросов.
    <b>create_rule</b> - создать правило, которое будет учитывать ответы на все вопросы, и по ним определять решение о выдаче кредита. Правило - это булевая функция, в которой можно использовать имена созданных параметров, арифметические операции +-/*; логические операции: && (и), || (или), >, &lt;, >=, &gt;=, "ИмяПараметра" == true/false. Пример правила: "Машина == true && Зарплата > 25000 || (Дети > 1 && Жены == 2)".
    <b>take_survey</b> - пройти опрос. Будут заданы все вопросы, на которые надо будет ответить. После этого будет применено правило и вынесен вердикт.`, {
      reply_markup:{
        remove_keyboard: true
      },
      parse_mode: 'HTML'
    });
    return;
  }

});

bot.on("polling_error", (err) => console.log(err));

function createListOfEntities(entities) {
  let message = '';
  let index = 0;
  for(const entity of Object.values(entities)) {
    index++;
    message += `${index}. Название сущности: ${entity.name}\n`;
    message += `Вопрос для сущности: ${entity.message}\n`;
    message += `Тип сущности: ${entity.type}\n`;
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