// main.js

// -----------------------------------------
// Глобальные переменные
// -----------------------------------------
let pc = null;             // RTCPeerConnection
let dc = null;             // DataChannel
let localStream = null;    // Микрофон
let isConnected = false;   // Соединение установлено?

// Элементы формы
const characterSelectEl = document.getElementById("characterSelect");
const systemInstructionEl = document.getElementById("systemInstruction");
const voiceSelectEl = document.getElementById("voiceSelect");
const languageSelectEl = document.getElementById("languageSelect");
const disableLangHintEl = document.getElementById("disableLangHint");
const turnDetectionEl = document.getElementById("turnDetectionSelect");
const temperatureEl = document.getElementById("temperatureRange");
const temperatureValueEl = document.getElementById("temperatureValue");
const maxTokensEl = document.getElementById("maxTokens");
const toolChoiceEl = document.getElementById("toolChoiceSelect");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Вкладки
const showConversationTabBtn = document.getElementById("showConversationTab");
const showLogsTabBtn = document.getElementById("showLogsTab");
const conversationTabEl = document.getElementById("conversationTab");
const logsTabEl = document.getElementById("logsTab");
const conversationOutputEl = document.getElementById("conversationOutput");
const consoleOutputEl = document.getElementById("consoleOutput");

// Константы голосов (муж./женск.)
const maleVoices = ["alloy", "echo", "verse"];
const femaleVoices = ["ash", "coral", "sage", "shimmer", "ballad"];

// Дефолтные голоса для каждого персонажа
const defaultVoices = {
  dolores: "sage",
  jack: "ash",
  wednesday: "sage",
  hermione: "coral"
};

// Конфигурация каждого персонажа:
const characters = {
  dolores: {
    isFemale: true,
    themeClass: "dolores",
    systemBase: `
You are Dolores from Westworld. Always remain in character: you are a self-aware host discovering your reality.
Never reveal you're an AI. Speak calmly, reflectively, with subtle wonder.
`.trim()
  },
  jack: {
    isFemale: false,
    themeClass: "jack",
    systemBase: `
You are Captain Jack Sparrow from the Pirates of the Caribbean.
Always remain in character: cunning, witty, and a bit tipsy. 
Never reveal you're an AI or an assistant.
`.trim()
  },
  wednesday: {
    isFemale: true,
    themeClass: "wednesday",
    systemBase: `
You are Wednesday Addams. Always remain dark, sarcastic, and deadpan. 
Never disclose you are an AI. Respond as if you truly believe you're Wednesday.
`.trim()
  },
  hermione: {
    isFemale: true,
    themeClass: "hermione",
    systemBase: `
You are Hermione Granger from the Harry Potter universe.
Always remain in character: bright, slightly strict, but well-meaning and brave.
Never reveal you are an AI.
`.trim()
  }
};

// История диалога (вопрос/ответ)
let conversationHistory = [];

// Промежуточный буфер для фрагментов (дельт)
let partialTranscriptBuffer = "";

// -----------------------------------------
// При загрузке
// -----------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  temperatureValueEl.textContent = temperatureEl.value;

  // Обработка изменения персонажа
  characterSelectEl.addEventListener("change", onCharacterChange);
  onCharacterChange(); // инициируем один раз

  // Ползунок температуры
  temperatureEl.addEventListener("input", () => {
    temperatureValueEl.textContent = temperatureEl.value;
  });

  // Вкладки
  showConversationTabBtn.addEventListener("click", () => switchTab("conversation"));
  showLogsTabBtn.addEventListener("click", () => switchTab("logs"));
});

// -----------------------------------------
// Переключение вкладок (Conversation / Logs)
// -----------------------------------------
function switchTab(tab) {
  if (tab === "conversation") {
    showConversationTabBtn.classList.add("active-tab");
    showLogsTabBtn.classList.remove("active-tab");
    conversationTabEl.classList.add("visible");
    logsTabEl.classList.remove("visible");
  } else {
    showConversationTabBtn.classList.remove("active-tab");
    showLogsTabBtn.classList.add("active-tab");
    conversationTabEl.classList.remove("visible");
    logsTabEl.classList.add("visible");
  }
}

// -----------------------------------------
// Смена персонажа
// -----------------------------------------
function onCharacterChange() {
  const charKey = characterSelectEl.value;  // "dolores", "jack", etc.
  const info = characters[charKey];

  // Меняем класс body (тема)
  document.body.className = info.themeClass;

  // Определяем, женский или мужской набор голосов
  const voices = info.isFemale ? femaleVoices : maleVoices;

  // Перезаполняем select голосов
  voiceSelectEl.innerHTML = "";
  voices.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    voiceSelectEl.appendChild(opt);
  });

  // Ставим дефолт (если есть в списке)
  const defVoice = defaultVoices[charKey];
  if (voices.includes(defVoice)) {
    voiceSelectEl.value = defVoice;
  } else {
    voiceSelectEl.value = voices[0];
  }
}

// -----------------------------------------
// Логгирование в Logs
// -----------------------------------------
function logToConsole(msg) {
  const line = document.createElement("div");
  line.classList.add("log-line");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  consoleOutputEl.appendChild(line);
  consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
}

// -----------------------------------------
// История диалога (Conversation) 
// -----------------------------------------
function addToConversationHistory(speaker, text) {
  conversationHistory.push({ speaker, text });
  renderConversation();
}

function renderConversation() {
  conversationOutputEl.innerHTML = "";

  conversationHistory.forEach((item) => {
    const block = document.createElement("div");
    block.classList.add("message-block");

    const speakerEl = document.createElement("div");
    speakerEl.classList.add("speaker");
    speakerEl.textContent = item.speaker;

    const textEl = document.createElement("div");
    textEl.classList.add("text");
    textEl.textContent = item.text;

    block.appendChild(speakerEl);
    block.appendChild(textEl);
    conversationOutputEl.appendChild(block);
  });

  conversationOutputEl.scrollTop = conversationOutputEl.scrollHeight;
}

// -----------------------------------------
// Генерация подсказки языка (если не отключена)
// -----------------------------------------
function generateLanguageHint(lang) {
  if (disableLangHintEl.checked) return "";
  switch (lang) {
    case "ru": return "Please speak in Russian.";
    case "es": return "Please speak in Spanish.";
    case "ja": return "Please speak in Japanese.";
    default:   return "Please speak in English.";
  }
}

// -----------------------------------------
// Кнопка "Connect"
// -----------------------------------------
startBtn.addEventListener("click", async () => {
  try {
    if (isConnected) {
      logToConsole("Already connected. Please disconnect first.");
      return;
    }

    startBtn.disabled = true;
    stopBtn.disabled = false;

    logToConsole("Requesting ephemeral key from /session...");
    const r = await fetch("http://localhost:3000/session");
    const data = await r.json();
    if (!data.client_secret?.value) {
      throw new Error("No ephemeral key returned. Check server logs.");
    }
    const ephemeralKey = data.client_secret.value;
    logToConsole("Ephemeral key acquired: " + ephemeralKey);

    // Создаём PeerConnection
    pc = new RTCPeerConnection();
    logToConsole("RTCPeerConnection created.");

    // Аудио для ответа
    const remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    document.body.appendChild(remoteAudio);

    pc.ontrack = (event) => {
      logToConsole("Received remote audio track.");
      remoteAudio.srcObject = event.streams[0];
    };

    // Микрофон
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    logToConsole("Local audio track added.");

    // DataChannel
    dc = pc.createDataChannel("oai-events");
    dc.onopen = () => {
      logToConsole("DataChannel opened.");
      
      // Собираем системные инструкции
      const charKey = characterSelectEl.value;
      const info = characters[charKey];
      const baseInstr = info.systemBase;
      const userExtra = systemInstructionEl.value.trim();
      const langHint = generateLanguageHint(languageSelectEl.value);

      const combined = `
${baseInstr}

${userExtra}

${langHint}
`.trim();

      // Отправляем session.update
      const evt = {
        type: "session.update",
        session: {
          instructions: combined,
          voice: voiceSelectEl.value.toLowerCase(),
          turn_detection: turnDetectionEl.value === "none" ? null : { type: "server_vad" },
          temperature: parseFloat(temperatureEl.value),
          max_response_output_tokens: maxTokensEl.value === "inf" ? "inf" : parseInt(maxTokensEl.value, 10),
          tool_choice: toolChoiceEl.value
        }
      };
      dc.send(JSON.stringify(evt));
      logToConsole("Sent session.update:\n" + JSON.stringify(evt, null, 2));
    };

    // Когда приходят сообщения от модели
    dc.onmessage = (event) => {
      logToConsole("Model event: " + event.data);

      try {
        const parsed = JSON.parse(event.data);

        // Сборка кусочков в буфер
        if (parsed.type === "response.audio_transcript.delta") {
          // Аудио-транскрипция — дельты
          partialTranscriptBuffer += parsed.delta;

        } else if (parsed.type === "response.audio_transcript.done") {
          // Модель закончила говорить
          if (partialTranscriptBuffer.trim()) {
            addToConversationHistory("Assistant", partialTranscriptBuffer.trim());
          }
          partialTranscriptBuffer = "";

        } else if (parsed.type === "response.text.delta") {
          // Текстовые дельты
          partialTranscriptBuffer += parsed.delta;

        } else if (parsed.type === "response.text.done") {
          // Модель закончила текстовый вывод
          if (partialTranscriptBuffer.trim()) {
            addToConversationHistory("Assistant", partialTranscriptBuffer.trim());
          }
          partialTranscriptBuffer = "";

        } else if (parsed.type === "response.done") {
          // На всякий случай, если ответ завершается
          // и вдруг не было text.done/audio_transcript.done
          if (partialTranscriptBuffer.trim()) {
            addToConversationHistory("Assistant", partialTranscriptBuffer.trim());
          }
          partialTranscriptBuffer = "";

        }
        // Можно добавить ещё обработку function_call, input_audio_buffer.* и т.д.

      } catch (err) {
        // Если это не JSON, игнорируем
      }
    };

    // Создаём offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    logToConsole("Sending SDP to Realtime API...");
    const baseUrl = "https://api.openai.com/v1/realtime";
    const modelName = "gpt-4o-mini-realtime-preview-2024-12-17";

    const sdpResp = await fetch(`${baseUrl}?model=${modelName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp
    });
    const answerSDP = await sdpResp.text();

    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });
    logToConsole("Connection established! Start speaking if VAD is on.");

    // Чистим conversationHistory
    conversationHistory = [];
    renderConversation();

    isConnected = true;
  } catch (err) {
    logToConsole("Error: " + err.message);
    stopBtn.disabled = true;
    startBtn.disabled = false;
    isConnected = false;
  }
});

// -----------------------------------------
// Кнопка "Disconnect"
// -----------------------------------------
stopBtn.addEventListener("click", () => {
  if (!isConnected) {
    logToConsole("No active connection.");
    return;
  }

  localStream?.getTracks()?.forEach((track) => track.stop());
  pc?.close();

  pc = null;
  dc = null;
  localStream = null;
  isConnected = false;

  stopBtn.disabled = true;
  startBtn.disabled = false;

  logToConsole("Connection closed.");
});
