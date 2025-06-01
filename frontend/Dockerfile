FROM node:18-alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Экспонируем порт
EXPOSE 3000

# Запускаем в режиме разработки
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]