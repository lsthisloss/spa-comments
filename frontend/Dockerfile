# Используем Node.js 22
FROM node:22

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы
COPY . .

# Копируем .env файл
COPY .env .env

# Запускаем приложение
CMD ["npm", "run", "dev"]