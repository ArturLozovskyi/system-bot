const CreditBot = require('./CreditBot');
const token = process.env.TOKEN;
const adminPass = process.env.ADMIN_PASS;
const bot = new CreditBot(token);

const COMMON_COMMANDS = {
  take_survey: '/take_survey',
  start: '/start',
  help: '/help',
  admin_login: '/admin_login',
}

const ADMIN_COMMANDS = {
  create_entity: '/create_entity',
  delete_entity: '/delete_entity',
  list_entities: '/list_entities',
  create_rule: '/create_rule',
  view_rule: '/view_rule',
  admin_logout: '/admin_logout',
  help: '/help'
}

const ADMIN_STATES = {
  STATE_CREATE_ENTITY_NAME: 0,
  STATE_CREATE_ENTITY_QUESTION: 1,
  STATE_CREATE_ENTITY_TYPE: 2,
  NEUTRAL: 3,
  WRITING_RULE: 4,
  STATE_DELETE_ENTITY: 5,
};

const COMMON_STATES = {
  ANSWERING_QUESTIONS: 0,
  NEUTRAL: 1,
  ENTERING_ADMIN_PASS: 2
};

const ENTITIES_TYPE = {
  NUMERIC: 'Numeric',
  BOOLEAN: 'Boolean'
};

const adminList = {};
const usersState = {};
const entities = {
  "СемейноеПоложение" : {
    name: "СемейноеПоложение",
    message: "Вы состоите в браке?",
    type: ENTITIES_TYPE.BOOLEAN
  },
  "Доход" : {
    name: "Доход",
    message: "Каков Ваш официальный доход?",
    type: ENTITIES_TYPE.NUMERIC
  },
  "СуммаКредита" : {
    name: "СуммаКредита",
    message: "Какую сумму Вы хотите взять в кредит?",
    type: ENTITIES_TYPE.NUMERIC
  },
  "Машина" : {
    name: "Машина",
    message: "Есть ли у Вас машина?",
    type: ENTITIES_TYPE.BOOLEAN
  },
  "Гражданство" : {
    name: "Гражданство",
    message: "Являетесь ли Вы гражданином Украины?",
    type: ENTITIES_TYPE.BOOLEAN
  },
  "Возраст" : {
    name: "Возраст",
    message: "Каков Ваш возраст?",
    type: ENTITIES_TYPE.NUMERIC
  },
};

const usersCurrentEntity = {};
const usersCurrentNumberOfQuestion = {};
const usersAnswers = {};
let rule = `(Гражданство == true) && (Возраст >= 21) && ((СуммаКредита <= Доход * 3 && Машина == false)
    || (СуммаКредита <= Доход * 6 && (Машина == true) && (СемейноеПоложение == true)))`;


bot.registerErrorHandler((err) => console.error(err));
bot.registerMessageHandler((msg) => {
  if (adminList[msg.from.id]) {
    adminMessageHandler(msg);
  } else {
    commonUserMessageHandler(msg);
  }
});

function adminMessageHandler(msg) {
  const chatId = msg.from.id;
  switch(usersState[chatId]) {
    case ADMIN_STATES.STATE_CREATE_ENTITY_NAME:
      const entityName = msg.text;
      entities[entityName] = {
        name: entityName,
        message: '',
        type: null
      };

      usersState[chatId] = ADMIN_STATES.STATE_CREATE_ENTITY_QUESTION;
      usersCurrentEntity[chatId] = entityName;
      bot.sendMessage(chatId, 'Напишите вопрос для этой сущности, который будет показан пользователю при прохождении опроса');
      return;
  
    case ADMIN_STATES.STATE_CREATE_ENTITY_QUESTION:
      entities[usersCurrentEntity[chatId]].message = msg.text;
      usersState[chatId] = ADMIN_STATES.STATE_CREATE_ENTITY_TYPE;
      bot.sendMessage(chatId, 'Напишите тип сущности', [[ENTITIES_TYPE.NUMERIC], [ENTITIES_TYPE.BOOLEAN]]);
      return;
  
    case ADMIN_STATES.STATE_CREATE_ENTITY_TYPE:
      entities[usersCurrentEntity[chatId]].type = msg.text;
      usersState[chatId] = ADMIN_STATES.NEUTRAL;
      bot.sendMessage(chatId, 'Сущность создана', Object.values(ADMIN_COMMANDS).map((el) => [el]));
      return;
  
    case ADMIN_STATES.STATE_DELETE_ENTITY:
      delete entities[msg.text];
      usersState[chatId] = ADMIN_STATES.NEUTRAL;
      let messageToSend = 'Сущность удалена';
      if(rule.indexOf(msg.text) !== -1) {
        rule = '';
        messageToSend+= '. \nУдаленная сущность использовалась в правиле и правило было удалено. Создайте правило заново';
      }
  
      bot.sendMessage(chatId, messageToSend, Object.values(ADMIN_COMMANDS).map((el) => [el]));
      return;
  
    case ADMIN_STATES.WRITING_RULE:
      rule = msg.text;
      try {
        eval(`with(entities) { ${rule.replace(/&&/g, '&').replace(/\|\|/g, '&')} }`);
        usersState[chatId] = ADMIN_STATES.NEUTRAL;
        bot.sendMessage(chatId, 'Правило успешно записано', Object.values(ADMIN_COMMANDS).map((el) => [el]));
      } catch (error) {
        rule = '';
        if (error instanceof SyntaxError) {
          bot.sendMessage(chatId, 'Правило задано с ошибкой, попробуйте еще раз: неправильный синтаксис');
        } else if (error instanceof ReferenceError) {
          const key = error.message.split(' ')[0];
          bot.sendMessage(chatId, `Правило задано с ошибкой, попробуйте еще раз: сущность с ${key} не найдена`);
        }
      }
      return;
  }

  switch(msg.text) {
    case ADMIN_COMMANDS.create_entity: 
      usersState[chatId] = ADMIN_STATES.STATE_CREATE_ENTITY_NAME;
      bot.sendMessage(chatId, 'Напишите название сущности');
      return;

    case ADMIN_COMMANDS.list_entities: 
      const message = createListOfEntities(entities).length > 0 ? createListOfEntities(entities) : 'Сущности еще не созданы';
      bot.sendMessage(chatId, message, Object.values(ADMIN_COMMANDS).map((el) => [el]), {parse_mode: 'HTML'});
      return;

    case ADMIN_COMMANDS.create_rule:
      if(Object.keys(entities).length === 0) {
        bot.sendMessage(chatId, 'Сначала создайте сущности');
        return;
      }
      usersState[chatId] = ADMIN_STATES.WRITING_RULE;
      bot.sendMessage(chatId, 'Запишите правило');
      return;

    case ADMIN_COMMANDS.delete_entity:
      if(Object.values(entities).length === 0) {
        usersState[chatId] = ADMIN_STATES.NEUTRAL;
        bot.sendMessage(chatId, 'Созданных сущностей нет');
        return;
      }

      usersState[chatId] = ADMIN_STATES.STATE_DELETE_ENTITY;
      bot.sendMessage(chatId, 'Выберите название сущности, которую нужно удалить',
        Object.keys(entities).map((el) => [el]));
      return;

    case ADMIN_COMMANDS.help:
      bot.sendMessage(chatId, `Команды стартового меню:
      <b>create_entity</b> - добавить в описываемую модель новый параметр, который пользователь должен будет  задать. Параметр может быть численный или формата да/нет. Также надо будет ввести вопрос для пользователя.
      <b>delete_entity</b> - удалить параметр по имени.
      <b>list_entities</b> - вывести список параметров и их вопросов.
      <b>create_rule</b> - создать правило, которое будет учитывать ответы на все вопросы, и по ним определять решение о выдаче кредита. Правило - это булевая функция, в которой можно использовать имена созданных параметров, арифметические операции +-/*; логические операции: && (и), || (или), >, &lt;, >=, &lt;=, "ИмяПараметра" == true/false. Пример правила: "Машина == true && Зарплата > 25000 || (Дети > 1 && Жены == 2)".
      <b>view_rule</b> - просмотреть созданное правило.`,
        Object.values(ADMIN_COMMANDS).map((el) => [el]), {parse_mode: 'HTML'});
      return;

    case ADMIN_COMMANDS.admin_logout:
      adminList[chatId] = false;
      usersState[chatId] = COMMON_STATES.NEUTRAL;
      bot.sendMessage(chatId, "Вы успешно перешли в режим пользователя.");
      return;

    case ADMIN_COMMANDS.view_rule:
      bot.sendMessage(chatId, rule.length !== 0 ? rule : "Правило не создано",
        Object.values(ADMIN_COMMANDS).map((el) => [el]));
      return;
  }

  bot.sendMessage(chatId, "Мне не удалось распознать вашу команду", Object.values(ADMIN_COMMANDS).map((el) => [el]));
}

function commonUserMessageHandler(msg) {
  const chatId = msg.from.id;
  switch(usersState[chatId]) {
    case COMMON_STATES.ANSWERING_QUESTIONS:
      const entitiesKeys = Object.keys(entities);
      const currentKey = entitiesKeys[usersCurrentNumberOfQuestion[chatId]];
      usersAnswers[chatId][currentKey] = msg.text;
      usersCurrentNumberOfQuestion[chatId]++;
  
      if(entitiesKeys.length === usersCurrentNumberOfQuestion[chatId]) {
        normilizeAnswers(usersAnswers[chatId]);
        try {
          const result = checkAnswers(usersAnswers[chatId]);
          const message = result === true ? 'Одобрено!' : 'Не одобрено!';
          bot.sendMessage(chatId, 'Спасибо за Ваши ответы!\n' + message);
        } catch(error) {
          rule = '';
          bot.sendMessage(chatId, 'Правило введено с ошибкой и удалено');
        }
  
        usersState[chatId] = COMMON_STATES.NEUTRAL;
        usersCurrentNumberOfQuestion[chatId] = 0;
        usersAnswers[chatId] = {};
        return;
      }
  
      const nextKey = entitiesKeys[usersCurrentNumberOfQuestion[chatId]];
      const question = entities[nextKey].message;
      const entityType = entities[nextKey].type;
      const keyboard = entityType === ENTITIES_TYPE.BOOLEAN ? [['True'], ['False']] : null;
      bot.sendMessage(chatId, question, keyboard);
      return;
    case COMMON_STATES.ENTERING_ADMIN_PASS:
      if (msg.text === adminPass) {
        adminList[chatId] = true;
        usersState[chatId] = ADMIN_STATES.NEUTRAL;
        bot.sendMessage(chatId, "Вы успешно авторизовались в роли эксперта-администратора",
          Object.values(ADMIN_COMMANDS).map((el) => [el]));
      } else {
        usersState[chatId] = COMMON_STATES.NEUTRAL;
        bot.sendMessage(chatId, "Nope.");
      }
      return;
  }

  switch(msg.text) {
    case COMMON_COMMANDS.take_survey:
      if (rule.length === 0) {
        bot.sendMessage(chatId, 'Сначала создайте правило для одобрения кредита');
        return;
      }

      usersState[chatId] = COMMON_STATES.ANSWERING_QUESTIONS;
      usersCurrentNumberOfQuestion[chatId] = 0;

      const entitiesKeys = Object.keys(entities);
      const currentKey = entitiesKeys[0];
      const question = entities[currentKey].message;
      const keyboard = entities[currentKey].type === ENTITIES_TYPE.BOOLEAN ?
        [['True'], ['False']] : null;
  
      usersAnswers[chatId] = {};
      bot.sendMessage(chatId, question, keyboard);
      return;

    case COMMON_COMMANDS.start:
      bot.sendMessage(chatId, `Привет, ${msg.from.first_name}! Напиши команду /help для более детальной информации`);
      return;

    case COMMON_COMMANDS.help:
      bot.sendMessage(chatId, `Команды стартового меню:
      <b>take_survey</b> - пройти опрос. Будут заданы все вопросы, на которые надо будет ответить. После этого будет применено правило и вынесен вердикт.
      <b>admin_login</b> - авторизоваться как администратор-эксперт.`,
        null, {parse_mode: 'HTML'});
      return;

    case COMMON_COMMANDS.admin_login:
      usersState[chatId] = COMMON_STATES.ENTERING_ADMIN_PASS;
      bot.sendMessage(chatId, "Введите пароль администратора");
      return;
  }

  bot.sendMessage(chatId, "Мне не удалось распознать вашу команду");
}

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