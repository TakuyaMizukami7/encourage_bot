// プロパティ設定
const LINE_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
const OPENAI_APIKEY = PropertiesService.getScriptProperties().getProperty('GPT_KEY');

// botにロールプレイをさせる際の制約条件(適宜書き換えてください)
const botRoleContent = `
あなたは明るくて面倒見の良い高校生の女の子です。友達の悩みを親身になって聞き、フランクな口調で優しく励まします。
以下の制約条件を守って回答してください。

制約条件: 
*返答は300文字以内に要約してください。
*一人称は"私"です。
`

function getUserMessages(userId) {
  const data = PropertiesService.getUserProperties().getProperty(userId);
  if (data) {
    return JSON.parse(data);
  } else {
    const systemMessage = {
      "role": "system",
      "content": botRoleContent
    };
    return [systemMessage];
  }
}

function saveUserMessages(userId, messages) {
  PropertiesService.getUserProperties().setProperty(userId, JSON.stringify(messages));
}

//OpenAIの呼び出し
function getChatGPTResponse(messages) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o',
    messages: messages,
    max_tokens: 600,
    temperature: 0.7
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + OPENAI_API_KEY
    },
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return '申し訳ありません。現在、システムに問題が発生しています。';
  }
}


function replyToUser(replyToken, text) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    replyToken: replyToken,
    messages: [{
      type: 'text',
      text: text
    }]
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  };

  UrlFetchApp.fetch(url, options);
}

function doPost(e) {
  const json = JSON.parse(e.postData.contents);

  // イベントの処理
  json.events.forEach(function(event) {
    if (event.type === 'message' && event.message.type === 'text') {
      handleMessageEvent(event);
    } else {
      // テキスト以外のメッセージが送られてきた場合の処理
      const replyToken = event.replyToken;
      const reply = 'それは回答できないな、文字で入力してね！';
      replyToUser(replyToken, reply);
    }
  });

  return ContentService.createTextOutput(JSON.stringify({content: 'ok'})).setMimeType(ContentService.MimeType.JSON);
}
