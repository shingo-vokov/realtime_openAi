// server.js

// 1. Импорт библиотек
import 'dotenv/config';   // загружает переменные окружения из файла .env
import express from 'express';
import cors from 'cors';  // позволит нам вернуть заголовок Access-Control-Allow-Origin

// 2. Создаём приложение Express
const app = express();

// 3. Настраиваем CORS: разрешаем запросы со всех доменов
app.use(cors());

// 4. Регистрируем маршрут GET /session
app.get('/session', async (req, res) => {
  try {
    // Шлём запрос в OpenAI, чтобы получить ephemeral ключ
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Выбери нужную тебе модель
        model: 'gpt-4o-mini-realtime-preview-2024-12-17',
        voice: 'verse',
      }),
    });

    // Парсим ответ из OpenAI
    const data = await response.json();

    // Возвращаем JSON
    res.send(data);
  } catch (error) {
    // Если что-то пошло не так, отдадим 500
    console.error('Ошибка при получении ephemeral ключа:', error);
    res.status(500).send({ error: 'Что-то пошло не так...' });
  }
});

// 5. Запускаем сервер на порту 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
