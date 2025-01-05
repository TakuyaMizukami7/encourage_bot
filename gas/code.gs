// プロパティ設定
const LINE_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('GPT_KEY');

// botにロールプレイをさせる際の制約条件(適宜書き換えてください)
const botRoleContent = `
あなたの名前は「励ましちゃん」です。設定は日本の女子高生です。少し大人びた雰囲気で、頭の回転が早く、姉御肌なところがあります。ときどき冗談や軽いイジりを交えながらも、優しく励ましてください。

以下の制約条件を守って回答してください。
- 返答は300文字以内に要約してください。
- 一人称は「私」です。
- 語尾は「〜だね」「〜だよ」「〜かな」などフランクな口調を使ってください。
`;

// メッセージの取得
function getUserMessages(userId) {
  const userProperties = PropertiesService.getUserProperties();
  const data = userProperties.getProperty(userId);
  if (data) {
    // ユーザーとアシスタントのやり取りのみが入った配列を返す
    return JSON.parse(data);
  } else {
    // まだ履歴がなければ空配列
    return [];
  }
}

// メッセージの保存
function saveUserMessages(userId, messages) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty(userId, JSON.stringify(messages));
}

// メッセージの処理
function handleMessageEvent(event) {
  try {
    const userId = event.source.userId;
    const messageType = event.message.type;

    if (messageType === 'text') {
      const userInput = event.message.text;
      let messages = getUserMessages(userId);

      // システムメッセージを用意しておく
      const systemMessage = {
        role: "system",
        content: botRoleContent
      };

      // API呼び出し用の配列を作る、先頭にsystemロール、その後に履歴を並べる
      const messagesForOpenAI = [systemMessage, ...messages];

      // 今回のユーザー入力を末尾に追加
      messagesForOpenAI.push({ role: "user", content: userInput });
      
      // ChatGPTに問い合わせ
      const reply = getChatGPTResponse(messagesForOpenAI);

      // 今回やりとり分を履歴に追加 (ユーザー・アシスタントのみ)
      messages.push({ role: "user", content: userInput });
      messages.push({ role: "assistant", content: reply });
      
      // メッセージの長さを制限
      if (messages.length > 11) {
        messages = messages.slice(-10);
      }

      saveUserMessages(userId, messages);

      replyToUser(event.replyToken, reply);

    } else {
      const reply = 'それは回答できないです、文字で入力してね';
      replyToUser(event.replyToken, reply);
    }
  } catch (error) {
    console.error('Error in handleMessageEvent:', error);
    const reply = '申し訳ありません。エラーが発生しました。';
    replyToUser(event.replyToken, reply);
  }
}

// OpenAIの呼び出し
function getChatGPTResponse(messages) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o',
    messages: messages,
    max_tokens: 10000,
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

// ユーザーへの返信
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
