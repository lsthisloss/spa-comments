#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m' 
NORMAL='\033[0m'

function app_run_dev() {
    echo -e "\n${YELLOW}Starting development environment (Docker only)...${NORMAL}\n"
    
    # Копируем .env файлы
    if [ -f .env.example ] && [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${CYAN}Copied .env.example to .env for frontend${NORMAL}"
    fi

    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo -e "${CYAN}Copied backend/.env.example to backend/.env${NORMAL}"
    fi

    echo -e "${CYAN}Preparing Docker environment...${NORMAL}"
    
    # Останавливаем старые контейнеры
    docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    
    # Очищаем Docker builder cache
    echo -e "${CYAN}Cleaning Docker build cache...${NORMAL}"
    docker builder prune -f 2>/dev/null || true
    
    echo -e "${CYAN}Building development images...${NORMAL}"
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}Error building Docker images.${NORMAL}"
        echo -e "${YELLOW}Check Dockerfiles and try again.${NORMAL}"
        exit 1
    fi

    echo -e "${CYAN}Starting development containers...${NORMAL}"
    docker-compose -f docker-compose.dev.yml up -d
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}✅ Development environment ready!${NORMAL}"
        echo -e "${CYAN}🐳 Frontend: http://localhost:3000${NORMAL}"
        echo -e "${CYAN}🐳 Backend: http://localhost:3001${NORMAL}"
        echo -e "${CYAN}🐳 RabbitMQ: http://localhost:15672${NORMAL}"
        echo -e "${CYAN}🐳 Elasticsearch: http://localhost:9200${NORMAL}"
        
        # Показываем статус контейнеров
        echo -e "\n${CYAN}Docker services:${NORMAL}"
        docker-compose -f docker-compose.dev.yml ps
        
        # Показываем последние логи
        echo -e "\n${CYAN}Recent container logs:${NORMAL}"
        docker-compose -f docker-compose.dev.yml logs --tail=10
        
    else
        echo -e "\n${RED}Docker startup failed${NORMAL}"
        echo -e "${CYAN}Check logs: docker-compose -f docker-compose.dev.yml logs${NORMAL}"
    fi
}

function app_setup_local_dev() {
    echo -e "\n${YELLOW}Installing local development dependencies...${NORMAL}\n"
    
    # Копируем .env файлы
    if [ -f .env.example ] && [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${CYAN}Copied .env.example to .env for frontend${NORMAL}"
    fi

    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo -e "${CYAN}Copied backend/.env.example to backend/.env${NORMAL}"
    fi
    
    # === BACKEND ===
    echo -e "${CYAN}Installing backend dependencies...${NORMAL}"
    cd backend
    
    # Очищаем старые зависимости
    echo -e "${CYAN}Cleaning backend directory...${NORMAL}"
    rm -rf node_modules package-lock.json dist 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    
    # Создаем dist с правильными правами
    mkdir -p dist
    chmod 755 dist 2>/dev/null || true
    
    export NODE_OPTIONS="--max-old-space-size=2048"
    npm install --loglevel=warn --progress=false
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend dependencies installed${NORMAL}"
        
        echo -e "${CYAN}Building backend...${NORMAL}"
        npm run build
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Backend built successfully${NORMAL}"
        else
            echo -e "${YELLOW}⚠️  Build failed, but dependencies are installed${NORMAL}"
        fi
    else
        echo -e "${RED}❌ Backend dependencies installation failed${NORMAL}"
    fi
    cd ..
    
    # === FRONTEND ===
    echo -e "${CYAN}Installing frontend dependencies...${NORMAL}"
    cd frontend
    
    # Очищаем старые зависимости
    echo -e "${CYAN}Cleaning frontend directory...${NORMAL}"
    rm -rf node_modules package-lock.json dist .vite build 2>/dev/null || true
    npm cache clean --force 2>/dev/null || true
    
    export NODE_OPTIONS="--max-old-space-size=2048"
    npm install --prefer-offline --progress=false --loglevel=warn
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend dependencies installed${NORMAL}"
    else
        echo -e "${RED}❌ Frontend dependencies installation failed${NORMAL}"
    fi
    cd ..
    
    echo -e "\n${GREEN}✅ Local development dependencies installed!${NORMAL}"
}

function app_dev_logs() {
    echo -e "\n${YELLOW}Showing recent development logs...${NORMAL}\n"
    
    echo -e "${CYAN}Available services:${NORMAL}"
    docker-compose -f docker-compose.dev.yml ps --services 2>/dev/null || echo "No services running"
    
    echo -e "\n${CYAN}Recent logs (last 50 lines):${NORMAL}"
    docker-compose -f docker-compose.dev.yml logs --tail=50
}

function app_run_production() {
    echo -e "\n${YELLOW}Starting production environment...${NORMAL}\n"
    
    # Используем production .env файл для backend
    if [ -f "backend/.env.example" ] && [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        echo -e "${CYAN}Copied backend/.env.example to backend/.env${NORMAL}"
    fi
    
    echo -e "${CYAN}Stopping any running containers...${NORMAL}"
    docker-compose -f docker-compose.prod.yml down --remove-orphans
    
    echo -e "${CYAN}Building backend production image...${NORMAL}"
    # Собираем только backend сервисы (без frontend)
    docker-compose -f docker-compose.prod.yml build --no-cache backend postgres rabbitmq elasticsearch
    
    echo -e "${CYAN}Starting backend production containers...${NORMAL}"
    # Запускаем только backend сервисы
    docker-compose -f docker-compose.prod.yml up -d postgres rabbitmq elasticsearch backend
    
    echo -e "${GREEN}✅ Backend production environment started!${NORMAL}"
    echo -e "${CYAN}Backend API: http://localhost:3001${NORMAL}"
    echo -e "${CYAN}RabbitMQ: http://localhost:15672${NORMAL}"
    echo -e "${CYAN}Elasticsearch: http://localhost:9200${NORMAL}"
    
    # Показываем статус только backend сервисов
    echo -e "\n${CYAN}Backend services status:${NORMAL}"
    docker-compose -f docker-compose.prod.yml ps
}

function app_build_frontend_prod() {
    echo -e "\n${YELLOW}Building frontend for production...${NORMAL}\n"
    
    cd frontend
    
    # Увеличиваем лимит памяти для Node.js
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    echo -e "${CYAN}Clearing npm cache...${NORMAL}"
    npm cache clean --force
    
    # Очищаем все временные файлы
    echo -e "${CYAN}Cleaning temporary files...${NORMAL}"
    rm -rf package-lock.json node_modules dist .vite tsconfig.tsbuildinfo
    
    echo -e "${CYAN}Installing dependencies...${NORMAL}"
    npm install --no-optional --prefer-offline --progress=false --loglevel=silent --maxsockets=1
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies.${NORMAL}"
        cd ..
        exit 1
    fi
    
    echo -e "${CYAN}Creating production environment...${NORMAL}"
    cat > .env.production << EOF
VITE_API_URL=https://sk8.pw
VITE_WS_URL=wss://sk8.pw
VITE_SOCKET_URL=https://sk8.pw
NODE_ENV=production
EOF
    
    echo -e "${CYAN}Building frontend for production...${NORMAL}"
    NODE_ENV=production timeout 1200 npx tsc -b
    NODE_ENV=production NODE_OPTIONS="--max-old-space-size=2048" timeout 1800 npx vite build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Build failed.${NORMAL}"
        cd ..
        exit 1
    fi
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}dist directory not found!${NORMAL}"
        cd ..
        exit 1
    fi
    
    echo -e "${CYAN}Deploying to web directory...${NORMAL}"
    sudo mkdir -p /var/www/sk8.pw
    sudo cp -r dist/* /var/www/sk8.pw/
    sudo chown -R www-data:www-data /var/www/sk8.pw/
    sudo chmod -R 755 /var/www/sk8.pw/
    
    echo -e "${GREEN}✅ Production frontend built and deployed!${NORMAL}"
    echo -e "${CYAN}📁 Location: /var/www/sk8.pw/${NORMAL}"
    echo -e "${CYAN}🌐 URL: https://sk8.pw${NORMAL}"
    
    cd ..
}

function app_clean_all() {
    echo -e "\n${RED}Останавливаю и удаляю все контейнеры, образы и volume'ы...${NORMAL}\n"
    
    # Принудительно останавливаем все контейнеры
    echo -e "${YELLOW}Stopping all containers...${NORMAL}"
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    # Удаляем контейнеры с таймаутом
    echo -e "${YELLOW}Removing containers...${NORMAL}"
    docker-compose -f docker-compose.dev.yml down --timeout 10 -v --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down --timeout 10 -v --remove-orphans 2>/dev/null || true
    
    # Принудительно удаляем все контейнеры
    echo -e "${YELLOW}Force removing all containers...${NORMAL}"
    docker rm -f $(docker ps -aq) 2>/dev/null || true
    
    # Удаляем образы
    echo -e "${YELLOW}Removing images...${NORMAL}"
    docker rmi -f $(docker images -q) 2>/dev/null || true
    
    # Удаляем volume'ы
    echo -e "${YELLOW}Removing volumes...${NORMAL}"
    docker volume rm $(docker volume ls -q) 2>/dev/null || true
    
    # Финальная очистка системы
    echo -e "${YELLOW}Final system cleanup...${NORMAL}"
    docker system prune -af --volumes 2>/dev/null || true
    
    echo -e "\n${GREEN}Всё очищено!${NORMAL}\n"
}

function app_stop_all() {
    echo -e "\n${YELLOW}Stopping all containers...${NORMAL}\n"
    
    # Быстрая остановка всех контейнеров
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    # Остановка через docker-compose
    docker-compose -f docker-compose.dev.yml down --timeout 5 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down --timeout 5 2>/dev/null || true
    
    echo -e "${GREEN}All containers stopped!${NORMAL}"
    docker ps
}

function app_clean_orphans() {
    echo -e "\n${YELLOW}Cleaning orphan containers...${NORMAL}\n"
    
    echo -e "${CYAN}Stopping all services...${NORMAL}"
    docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    
    echo -e "${CYAN}Removing orphan containers...${NORMAL}"
    docker container prune -f
    
    echo -e "${CYAN}Removing unused networks...${NORMAL}"
    docker network prune -f
    
    echo -e "${GREEN}✅ Orphan containers cleaned!${NORMAL}"
    docker ps -a
}

function app_clean_uploads() {
    echo -e "\n${YELLOW}Cleaning uploads directory...${NORMAL}\n"
    
    # Показываем размер папки uploads
    if [ -d "backend/uploads" ]; then
        UPLOADS_SIZE=$(du -sh backend/uploads 2>/dev/null | cut -f1)
        echo -e "${CYAN}Current uploads size: ${UPLOADS_SIZE}${NORMAL}"
        
        # Показываем количество файлов
        FILES_COUNT=$(find backend/uploads -type f 2>/dev/null | wc -l)
        echo -e "${CYAN}Total files: ${FILES_COUNT}${NORMAL}"
        
        if [ "$FILES_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  This will delete ALL uploaded files (avatars, images, documents)${NORMAL}"
            echo -e "${RED}⚠️  This action cannot be undone!${NORMAL}"
            echo -n -e "${CYAN}Are you sure? (y/N): ${NORMAL}"
            read -r CONFIRM
            
            if [[ $CONFIRM =~ ^[Yy]$ ]]; then
                echo -e "${CYAN}Removing all files in uploads directory...${NORMAL}"
                
                # Удаляем все файлы и пустые папки через find
                if find backend/uploads -type f -delete 2>/dev/null; then
                    # Удаляем пустые папки, кроме самой uploads
                    find backend/uploads -type d ! -path 'backend/uploads' -empty -delete 2>/dev/null
                    echo -e "${GREEN}✅ Uploads cleaned successfully!${NORMAL}"
                else
                    echo -e "${YELLOW}Need elevated permissions...${NORMAL}"
                    if sudo find backend/uploads -type f -delete 2>/dev/null; then
                        sudo find backend/uploads -type d ! -path 'backend/uploads' -empty -delete 2>/dev/null
                        echo -e "${GREEN}✅ Uploads cleaned successfully with sudo!${NORMAL}"
                    else
                        echo -e "${RED}❌ Still failed. Manual cleanup required.${NORMAL}"
                        return 1
                    fi
                fi
                
                # Пересоздаем структуру папок
                echo -e "${CYAN}Recreating uploads structure...${NORMAL}"
                mkdir -p backend/uploads/avatars backend/uploads/images backend/uploads/files 2>/dev/null || sudo mkdir -p backend/uploads/avatars backend/uploads/images backend/uploads/files
                
                echo -e "${GREEN}✅ Uploads directory structure recreated!${NORMAL}"
            else
                echo -e "${YELLOW}Operation cancelled.${NORMAL}"
            fi
        else
            echo -e "${GREEN}Uploads directory is already empty.${NORMAL}"
        fi
    else
        echo -e "${YELLOW}Uploads directory does not exist. Creating...${NORMAL}"
        mkdir -p backend/uploads/avatars backend/uploads/images backend/uploads/files
        echo -e "${GREEN}✅ Uploads directory created!${NORMAL}"
    fi
}

# Основное меню
while getopts c:t: flag; do
    case "${flag}" in
    c) choice=${OPTARG} ;;
    esac
done

if [ ! $choice ] && [ $1 ]; then
    choice=$1
fi

if [ -z $choice ]; then
    echo -e "  --------------------------------------------------  "
    echo "  -                Deployment Menu                 -  "
    echo "  --------------------------------------------------  "
    echo "  1 - Start Development (Docker only)"
    echo "  2 - Install Local Dependencies (npm install)"  
    echo "  3 - Show Development Logs"
    echo "  4 - Start Production (backend services)"
    echo "  5 - Build Frontend for Production"
    echo "  6 - Clean All (containers, images, volumes)"
    echo "  7 - Stop All Containers"
    echo "  8 - Clean Orphan Containers"
    echo "  9 - Clean Uploads Directory"
    echo "  --------------------------------------------------  "
    echo -e "${CYAN}Input action number > ${NORMAL}"

    read -p "" choice

    case "$choice" in
    1) app_run_dev ;;
    2) app_setup_local_dev ;;
    3) app_dev_logs ;;
    4) app_run_production ;;
    5) app_build_frontend_prod ;;
    6) app_clean_all ;;
    7) app_stop_all ;;
    8) app_clean_orphans ;;
    9) app_clean_uploads ;;
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
fi