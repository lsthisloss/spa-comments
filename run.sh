#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NORMAL='\033[0m'

function app_run_dev() {
    echo -e "\n${YELLOW}Starting development environment with frontend in Docker...${NORMAL}\n"
    
    # Копируем .env.example в .env для фронтенда (если нет .env)
    if [ -f .env.example ] && [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${CYAN}Copied .env.example to .env for frontend${NORMAL}"
    fi

    # Копируем .env.example в .env для бэкенда (если нет .env)
    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo -e "${CYAN}Copied backend/.env.example to backend/.env${NORMAL}"
    fi

    docker-compose -f docker-compose.dev.yml down
    
    echo -e "\n${YELLOW}Building development images...${NORMAL}\n"
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}Error building images. Please check the Dockerfiles and try again.${NORMAL}\n"
        exit 1
    fi

    echo -e "\n${YELLOW}Starting development containers...${NORMAL}\n"
    docker-compose -f docker-compose.dev.yml up
}

function app_run_local() {
    echo -e "\n${YELLOW}Stopping app containers ...${NORMAL}\n"
    
    # Копируем .env.example в .env для фронтенда (если нет .env)
    if [ -f .env.example ] && [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${CYAN}Copied .env.example to .env for frontend${NORMAL}"
    fi

    # Копируем .env.example в .env для бэкенда (если нет .env)
    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo -e "${CYAN}Copied backend/.env.example to backend/.env${NORMAL}"
    fi

    docker-compose -f docker-compose.dev.yml down

    echo -e "\n${YELLOW}Building images ...${NORMAL}\n"
    docker-compose -f docker-compose.dev.yml build --no-cache
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}Error building images. Please check the Dockerfile and try again.${NORMAL}\n"
        exit 1
    fi

    echo -e "\n${YELLOW}Starting app containers (backend only) ...${NORMAL}\n"
    # Only kill if a process is found
    if lsof -t -i:3000 >/dev/null 2>&1; then
        kill -9 $(lsof -t -i:3000)
    fi
    docker-compose -f docker-compose.dev.yml up
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


function app_create_superadmin() {
    echo -e "\n${YELLOW}Creating superadmin user...${NORMAL}\n"
    
    # Определяем файл композера и .env в зависимости от окружения
    local COMPOSE_FILE="docker-compose.dev.yml"
    local ENV_FILE=".env"
    
    if [ "$1" = "prod" ]; then
        COMPOSE_FILE="docker-compose.prod.yml"
        ENV_FILE=".env.prod"
        echo -e "${CYAN}Using production environment${NORMAL}"
        
        # Используем .env.prod для production
        if [ -f "$ENV_FILE" ]; then
            echo -e "${CYAN}Loading production environment variables${NORMAL}"
            export $(cat $ENV_FILE | grep -v '^#' | xargs)
        fi
    else
        echo -e "${CYAN}Using development environment${NORMAL}"
        
        # Используем стандартный .env для dev
        if [ -f "$ENV_FILE" ]; then
            echo -e "${CYAN}Loading development environment variables${NORMAL}"
            export $(cat $ENV_FILE | grep -v '^#' | xargs)
        fi
    fi
    
    # Проверяем, что backend контейнер запущен
    local BACKEND_CONTAINER=$(docker-compose -f $COMPOSE_FILE ps -q backend)
    
    if [ -z "$BACKEND_CONTAINER" ] || ! docker ps --format "table {{.Names}}" | grep -q "backend"; then
        echo -e "${YELLOW}Backend container not running. Starting required services...${NORMAL}"
        
        # Запускаем только необходимые сервисы
        docker-compose -f $COMPOSE_FILE up -d postgres rabbitmq elasticsearch backend
        
        # Ждем готовности сервисов
        echo -e "${CYAN}Waiting for services to be ready...${NORMAL}"
        sleep 15
        
        # Проверяем статус
        docker-compose -f $COMPOSE_FILE ps
    else
        echo -e "${GREEN}Backend container is already running${NORMAL}"
    fi
    
    # Выполняем команду в уже запущенном контейнере
    echo -e "${CYAN}🔧 Running superadmin script in existing container...${NORMAL}"
    
    if [ "$1" = "prod" ]; then
        docker-compose -f $COMPOSE_FILE exec backend npm run create-superadmin
    else
        docker-compose -f $COMPOSE_FILE exec backend npm run create-superadmin
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SuperAdmin created successfully!${NORMAL}"
        return 0
    fi
    
    # Fallback: если exec не сработал, пробуем run
    echo -e "\n${YELLOW}Exec failed, trying with run (will create new container)...${NORMAL}"
    
    if [ "$1" = "prod" ]; then
        docker-compose -f $COMPOSE_FILE --env-file=$ENV_FILE run --rm backend npm run create-superadmin
    else
        docker-compose -f $COMPOSE_FILE run --rm backend npm run create-superadmin
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SuperAdmin created successfully!${NORMAL}"
        return 0
    fi
    
    # Вариант с кастомными данными
    echo -e "\n${YELLOW}Script failed. Enter custom SuperAdmin details:${NORMAL}"
    
    if [ "$1" = "prod" ]; then
        read -p "Email (default: admin@sk8.dev): " ADMIN_EMAIL
        ADMIN_EMAIL=${ADMIN_EMAIL:-admin@sk8.dev}
        
        read -p "Username (default: sk8): " ADMIN_USERNAME  
        ADMIN_USERNAME=${ADMIN_USERNAME:-sk8}
    else
        read -p "Email (default: dev@example.com): " ADMIN_EMAIL
        ADMIN_EMAIL=${ADMIN_EMAIL:-dev@example.com}
        
        read -p "Username (default: DevAdmin): " ADMIN_USERNAME  
        ADMIN_USERNAME=${ADMIN_USERNAME:-DevAdmin}
    fi
    
    read -s -p "Password (leave empty for auto-generated): " ADMIN_PASSWORD
    echo
    
    # Пробуем с переменными окружения через exec
    echo -e "${CYAN}Trying with custom environment variables in running container...${NORMAL}"
    
    local ENV_VARS=""
    if [ ! -z "$ADMIN_EMAIL" ]; then
        ENV_VARS="SUPERADMIN_EMAIL=\"$ADMIN_EMAIL\""
    fi
    if [ ! -z "$ADMIN_USERNAME" ]; then
        ENV_VARS="$ENV_VARS SUPERADMIN_USERNAME=\"$ADMIN_USERNAME\""
    fi
    if [ ! -z "$ADMIN_PASSWORD" ]; then
        ENV_VARS="$ENV_VARS SUPERADMIN_PASSWORD=\"$ADMIN_PASSWORD\""
    fi
    
    if [ "$1" = "prod" ]; then
        ENV_VARS="$ENV_VARS NODE_ENV=production"
    else
        ENV_VARS="$ENV_VARS NODE_ENV=development"
    fi
    
    # Выполняем с переменными окружения в запущенном контейнере
    docker-compose -f $COMPOSE_FILE exec -e SUPERADMIN_EMAIL="$ADMIN_EMAIL" -e SUPERADMIN_USERNAME="$ADMIN_USERNAME" -e SUPERADMIN_PASSWORD="$ADMIN_PASSWORD" backend npm run create-superadmin
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SuperAdmin created with custom details!${NORMAL}"
    else
        echo -e "${RED}❌ Failed to create SuperAdmin. Check database connection.${NORMAL}"
        echo -e "${CYAN}Try running: docker-compose -f $COMPOSE_FILE logs backend${NORMAL}"
        echo -e "${CYAN}Or check database: docker-compose -f $COMPOSE_FILE logs postgres${NORMAL}"
    fi
}

function app_run_production() {
    echo -e "\n${YELLOW}Starting production environment...${NORMAL}\n"
    
    # Используем production .env файл
    if [ -f ".env.prod" ]; then
        echo -e "${CYAN}Using production environment variables${NORMAL}"
        export $(cat .env.prod | grep -v '^#' | xargs)
    fi
    
    echo -e "${CYAN}Stopping any running containers...${NORMAL}"
    docker-compose -f docker-compose.prod.yml down --remove-orphans
    
    echo -e "${CYAN}Building production images...${NORMAL}"
    docker-compose -f docker-compose.prod.yml --env-file=.env.prod build --no-cache
    
    echo -e "${CYAN}Starting production containers...${NORMAL}"
    docker-compose -f docker-compose.prod.yml --env-file=.env.prod up -d
    
    echo -e "${GREEN}✅ Production environment started!${NORMAL}"
    echo -e "${CYAN}Backend: http://localhost:3001${NORMAL}"
    echo -e "${CYAN}RabbitMQ: http://localhost:15672${NORMAL}"
    echo -e "${CYAN}Elasticsearch: http://localhost:9200${NORMAL}"
    
    # Показываем статус
    echo -e "\n${CYAN}Services status:${NORMAL}"
    docker-compose -f docker-compose.prod.yml ps
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
    docker-compose down --timeout 10 -v --remove-orphans 2>/dev/null || true
    
    # Принудительно удаляем все контейнеры
    echo -e "${YELLOW}Force removing all containers...${NORMAL}"
    docker rm -f $(docker ps -aq) 2>/dev/null || true
    
    # Удаляем образы по частям
    echo -e "${YELLOW}Removing images...${NORMAL}"
    docker rmi -f $(docker images -q) 2>/dev/null || true
    
    # Удаляем volume'ы
    echo -e "${YELLOW}Removing volumes...${NORMAL}"
    docker volume rm $(docker volume ls -q) 2>/dev/null || true
    
    # Удаляем сети
    echo -e "${YELLOW}Removing networks...${NORMAL}"
    docker network prune -f 2>/dev/null || true
    
    # Финальная очистка системы
    echo -e "${YELLOW}Final system cleanup...${NORMAL}"
    docker system prune -af --volumes 2>/dev/null || true
    
    echo -e "\n${GREEN}Всё очищено!${NORMAL}\n"
    
    # Показываем статус
    echo -e "${CYAN}Remaining containers:${NORMAL}"
    docker ps -a || echo "No containers"
    
    echo -e "${CYAN}Remaining images:${NORMAL}"
    docker images || echo "No images"
    
    echo -e "${CYAN}Remaining volumes:${NORMAL}"
    docker volume ls || echo "No volumes"
}
function app_stop_all() {
    echo -e "\n${YELLOW}Stopping all containers...${NORMAL}\n"
    
    # Быстрая остановка всех контейнеров
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    # Остановка через docker-compose
    docker-compose -f docker-compose.dev.yml down --timeout 5 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down --timeout 5 2>/dev/null || true
    docker-compose down --timeout 5 2>/dev/null || true
    
    echo -e "${GREEN}All containers stopped!${NORMAL}"
    docker ps
}
function app_run_backend() {
    echo -e "\n${YELLOW}Starting backend with docker-compose...${NORMAL}\n"
    docker-compose -f docker-compose.prod.yml up -d
    echo -e "\n${GREEN}Backend services started!${NORMAL}\n"
    docker-compose -f docker-compose.prod.yml ps
}

function app_build_frontend_prod() {
    echo -e "\n${YELLOW}Building frontend for production...${NORMAL}\n"
    
    cd frontend
    
    # Увеличиваем лимит памяти для Node.js (ТОЛЬКО валидные опции)
    export NODE_OPTIONS="--max-old-space-size=1536"
    
    echo -e "${CYAN}Clearing npm cache...${NORMAL}"
    npm cache clean --force
    
    # Очищаем все временные файлы
    echo -e "${CYAN}Cleaning temporary files...${NORMAL}"
    rm -rf package-lock.json node_modules dist .vite tsconfig.tsbuildinfo
    
    echo -e "${CYAN}Installing dependencies with minimal memory usage...${NORMAL}"
    # Устанавливаем пакеты с минимальным потреблением памяти
    npm install --no-optional --prefer-offline --progress=false --loglevel=silent --maxsockets=1
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies. Trying with optional dependencies...${NORMAL}"
        
        # Пробуем с optional dependencies для Rollup
        npm install --prefer-offline --progress=false --loglevel=silent --maxsockets=1
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to install dependencies. Trying minimal install...${NORMAL}"
            
            # Устанавливаем только самое необходимое
            npm install typescript vite @vitejs/plugin-react rollup --no-save --loglevel=silent
            
            if [ $? -ne 0 ]; then
                echo -e "${RED}Installation failed. Server memory too low.${NORMAL}"
                echo -e "${YELLOW}Creating swap space automatically...${NORMAL}"
                
                # Автоматически создаем swap если его нет
                if ! swapon --show | grep -q "/swapfile"; then
                    echo -e "${CYAN}Creating 2GB swap file...${NORMAL}"
                    sudo fallocate -l 2G /swapfile
                    sudo chmod 600 /swapfile
                    sudo mkswap /swapfile
                    sudo swapon /swapfile
                    
                    # Пробуем установить еще раз после создания swap
                    npm install --prefer-offline --progress=false --loglevel=silent --maxsockets=1
                    
                    if [ $? -ne 0 ]; then
                        echo -e "${RED}Installation still failed even with swap. Build locally.${NORMAL}"
                        cd ..
                        exit 1
                    fi
                else
                    echo -e "${RED}Swap exists but installation still failed. Build locally.${NORMAL}"
                    cd ..
                    exit 1
                fi
            fi
        fi
    fi
    
    # Проверяем что Rollup корректно установлен
    echo -e "${CYAN}Checking Rollup installation...${NORMAL}"
    if ! npx rollup --version >/dev/null 2>&1; then
        echo -e "${YELLOW}Rollup not working, reinstalling with optional dependencies...${NORMAL}"
        npm install rollup --force --loglevel=silent
    fi
    
    echo -e "${CYAN}Creating production environment...${NORMAL}"
    cat > .env.production << EOF
VITE_API_URL=https://sk8.pw
VITE_WS_URL=wss://sk8.pw
VITE_SOCKET_URL=https://sk8.pw
NODE_ENV=production
EOF
    
    # Освобождаем память перед компиляцией
    echo -e "${CYAN}Clearing system memory...${NORMAL}"
    sync && echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null 2>&1
    
    echo -e "${CYAN}Building frontend for production (with memory optimization)...${NORMAL}"
    # Компилируем TypeScript с оптимизацией памяти
    NODE_ENV=production timeout 1200 npx tsc -b
    
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}TypeScript compilation failed, trying without type checking...${NORMAL}"
        # Пробуем без проверки типов для экономии памяти
        NODE_ENV=production timeout 1200 npx tsc --build --force --skipLibCheck
        
        if [ $? -ne 0 ]; then
            echo -e "${YELLOW}TypeScript compilation failed, continuing with Vite build...${NORMAL}"
        fi
    fi
    
    # Очищаем память снова перед Vite build
    sync && echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null 2>&1
    
    echo -e "${CYAN}Running Vite build (memory optimized)...${NORMAL}"
    # Собираем с максимальной оптимизацией
    NODE_ENV=production NODE_OPTIONS="--max-old-space-size=1024" timeout 1800 npx vite build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Vite build failed. Trying with even more memory...${NORMAL}"
        
        # Увеличиваем лимит еще больше
        export NODE_OPTIONS="--max-old-space-size=2048"
        NODE_ENV=production timeout 2400 npx vite build
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}Build failed even with 2GB memory limit.${NORMAL}"
            echo -e "${YELLOW}Server memory insufficient. Please build locally and upload dist/ folder.${NORMAL}"
            cd ..
            exit 1
        fi
    fi
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}dist directory not found!${NORMAL}"
        cd ..
        exit 1
    fi
    
    echo -e "${CYAN}Copying to /var/www/sk8.pw/...${NORMAL}"
    sudo mkdir -p /var/www/sk8.pw
    sudo cp -r dist/* /var/www/sk8.pw/
    sudo chown -R www-data:www-data /var/www/sk8.pw/
    sudo chmod -R 755 /var/www/sk8.pw/
    
    echo -e "${GREEN}✅ Production frontend built and deployed!${NORMAL}"
    echo -e "${CYAN}📁 Location: /var/www/sk8.pw/${NORMAL}"
    echo -e "${CYAN}🔗 Configured for https://sk8.pw${NORMAL}"
    
    cd ..
}

function app_build_frontend_dev() {
    echo -e "\n${YELLOW}Building frontend for development...${NORMAL}\n"
    
    cd frontend
    
    # Увеличиваем лимит памяти (ТОЛЬКО валидные опции)
    export NODE_OPTIONS="--max-old-space-size=1536"
    
    echo -e "${CYAN}Clearing npm cache...${NORMAL}"
    npm cache clean --force
    
    # Удаляем package-lock.json и node_modules
    echo -e "${CYAN}Removing package-lock.json and node_modules to fix Rollup issue...${NORMAL}"
    rm -rf package-lock.json node_modules dist .vite tsconfig.tsbuildinfo
    
    echo -e "${CYAN}Installing dependencies with memory limits...${NORMAL}"
    npm install --no-optional --prefer-offline --progress=false --loglevel=silent --maxsockets=1
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies. Trying with optional dependencies...${NORMAL}"
        
        # Пробуем с optional dependencies для Rollup
        npm install --prefer-offline --progress=false --loglevel=silent --maxsockets=1
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to install dependencies. Trying alternative approach...${NORMAL}"
            # Устанавливаем TypeScript и Vite через npx для разового использования
            echo -e "${CYAN}Installing build tools...${NORMAL}"
            npm install typescript vite @vitejs/plugin-react rollup --no-save --loglevel=silent
            
            if [ $? -ne 0 ]; then
                echo -e "${RED}Installation failed. Server memory too low. Try building locally.${NORMAL}"
                cd ..
                exit 1
            fi
        fi
    fi
    
    # Проверяем что Rollup корректно установлен
    echo -e "${CYAN}Checking Rollup installation...${NORMAL}"
    if ! npx rollup --version >/dev/null 2>&1; then
        echo -e "${YELLOW}Rollup not working, reinstalling with optional dependencies...${NORMAL}"
        npm install rollup --force --loglevel=silent
    fi
    
    echo -e "${CYAN}Creating development environment...${NORMAL}"
    cat > .env << EOF
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
NODE_ENV=development
EOF
    
    # Очищаем память
    sync && echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null 2>&1
    
    echo -e "${CYAN}Building frontend...${NORMAL}"
    # Используем npx и добавляем timeout БЕЗ неправильных опций
    NODE_ENV=development timeout 1200 npx tsc -b
    if [ $? -ne 0 ]; then
        echo -e "${RED}TypeScript compilation failed!${NORMAL}"
        cd ..
        exit 1
    fi
    
    NODE_ENV=development timeout 1200 npx vite build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Vite build failed!${NORMAL}"
        cd ..
        exit 1
    fi
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}dist directory not found!${NORMAL}"
        cd ..
        exit 1
    fi
    
    echo -e "${CYAN}Copying to /var/www/sk8.pw/...${NORMAL}"
    sudo mkdir -p /var/www/sk8.pw
    sudo cp -r dist/* /var/www/sk8.pw/
    sudo chown -R www-data:www-data /var/www/sk8.pw/
    sudo chmod -R 755 /var/www/sk8.pw/
    
    echo -e "${GREEN}✅ Development frontend built and deployed!${NORMAL}"
    echo -e "${CYAN}📁 Location: /var/www/sk8.pw/${NORMAL}"
    echo -e "${CYAN}🔗 Configured for backend on localhost:3001${NORMAL}"
    
    cd ..
}

function app_setup_swap() {
    echo -e "\n${YELLOW}Setting up swap space for build process...${NORMAL}\n"
    
    # Проверяем есть ли уже swap
    if swapon --show | grep -q "/swapfile"; then
        echo -e "${GREEN}Swap already exists${NORMAL}"
        swapon --show
        return 0
    fi
    
    echo -e "${CYAN}Creating 2GB swap file...${NORMAL}"
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # Добавляем в fstab для постоянного использования
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    
    echo -e "${GREEN}✅ Swap space created successfully!${NORMAL}"
    echo -e "${CYAN}Memory status:${NORMAL}"
    free -h
}


function app_fix_memory_issues() {
    echo -e "\n${YELLOW}Fixing memory issues...${NORMAL}\n"
    
    # Остановить все контейнеры
    docker-compose -f docker-compose.prod.yml down
    
    # Создать swap если его нет
    if ! swapon --show | grep -q "/swapfile"; then
        echo -e "${CYAN}Creating swap space...${NORMAL}"
        app_setup_swap
    fi
    
    # Очистить системную память
    echo -e "${CYAN}Clearing system memory...${NORMAL}"
    sync && sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches' 2>/dev/null || true
    
    # Пересобрать с оптимизацией
    echo -e "${CYAN}Rebuilding with memory optimization...${NORMAL}"
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Запустить с новыми лимитами
    echo -e "${CYAN}Starting with optimized memory settings...${NORMAL}"
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}✅ Memory optimization complete!${NORMAL}"
    docker-compose -f docker-compose.prod.yml ps
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
                
                # Удаляем все файлы и пустые папки через find (без лимита на количество файлов)
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
                        echo -e "${CYAN}Try: sudo find backend/uploads -type f -delete${NORMAL}"
                        return 1
                    fi
                fi
                
                # Пересоздаем структуру папок
                echo -e "${CYAN}Recreating uploads structure...${NORMAL}"
                mkdir -p backend/uploads/avatars backend/uploads/images backend/uploads/files 2>/dev/null || sudo mkdir -p backend/uploads/avatars backend/uploads/images backend/uploads/files
                
                chmod 755 backend/uploads 2>/dev/null || sudo chmod 755 backend/uploads
                chmod 755 backend/uploads/* 2>/dev/null || sudo chmod 755 backend/uploads/*
                
                echo -e "${GREEN}✅ Uploads directory structure recreated!${NORMAL}"
                
                # Показываем финальный размер
                NEW_SIZE=$(du -sh backend/uploads 2>/dev/null | cut -f1)
                echo -e "${CYAN}New uploads size: ${NEW_SIZE}${NORMAL}"
            else
                echo -e "${YELLOW}Operation cancelled.${NORMAL}"
            fi
        else
            echo -e "${GREEN}Uploads directory is already empty.${NORMAL}"
        fi
    else
        echo -e "${YELLOW}Uploads directory does not exist. Creating...${NORMAL}"
        mkdir -p backend/uploads/avatars backend/uploads/images backend/uploads/files
        chmod 755 backend/uploads backend/uploads/*
        echo -e "${GREEN}✅ Uploads directory created!${NORMAL}"
    fi
}


# Добавляем dev функции
function app_dev_start() {
    echo -e "\n${YELLOW}Starting DEV environment...${NORMAL}\n"
    
    # Копируем .env.example в .env для фронтенда (если нет .env)
    if [ -f .env.example ] && [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${CYAN}Copied .env.example to .env for frontend${NORMAL}"
    fi

    # Копируем .env.example в .env для бэкенда (если нет .env)
    if [ -f backend/.env.example ] && [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        echo -e "${CYAN}Copied backend/.env.example to backend/.env${NORMAL}"
    fi
    
    # Очищаем orphans
    docker-compose -f docker-compose.dev.yml down --remove-orphans

    # Запускаем все сервисы
    echo -e "${CYAN}Starting all development services...${NORMAL}"
    docker-compose -f docker-compose.dev.yml up -d
    
    echo -e "${GREEN}✅ Development environment started!${NORMAL}"
    echo -e "${CYAN}Frontend: http://localhost:3000${NORMAL}"
    echo -e "${CYAN}Backend: http://localhost:3001${NORMAL}"
    echo -e "${CYAN}RabbitMQ: http://localhost:15672${NORMAL}"
    echo -e "${CYAN}Elasticsearch: http://localhost:9200${NORMAL}"
    
    # Показываем статус
    echo -e "\n${CYAN}Services status:${NORMAL}"
    docker-compose -f docker-compose.dev.yml ps
}

function app_dev_logs() {
    echo -e "\n${YELLOW}Showing development logs...${NORMAL}\n"
    docker-compose -f docker-compose.dev.yml logs -f --tail=100
}

function app_dev_stop() {
    echo -e "\n${YELLOW}Stopping DEV environment...${NORMAL}\n"
    docker-compose -f docker-compose.dev.yml down --remove-orphans
    echo -e "${GREEN}✅ Development environment stopped!${NORMAL}"
}

function app_create_superadmin_prod() {
    echo -e "\n${YELLOW}Creating superadmin user (PRODUCTION mode)...${NORMAL}\n"
    app_create_superadmin "prod"
}

while getopts c:t: flag; do
    case "${flag}" in
    c) choice=${OPTARG} ;;
    esac
done

if [ ! $choice ] && [ $1 ]; then
    choice=$1
fi

if [ -z $choice ]; then
    echo -e "  ----------------------------------------------------------------------  "
    echo "  -                        Deployment Menu                             -  "
    echo "  ----------------------------------------------------------------------  "
    echo "         1 - Run Development (frontend + backend in Docker)"
    echo "         2 - Run Local (backend only in Docker)"
    echo "         3 - Run Production" 
    echo "         4 - Clean ALL (containers, images, volumes, DB)"
    echo "         5 - Stop ALL (quick stop)"
    echo "         6 - Run Backend (docker-compose up)"
    echo "         7 - Build Frontend (Development)"
    echo "         8 - Build Frontend (Production)"
    echo "         9 - Setup Swap Space (for low memory servers)"
    echo "         10 - Create Superadmin User (DEV)"
    echo "         11 - Fix Memory Issues"
    echo "         12 - Clean Uploads Directory"
    echo "         13 - Start DEV Environment"
    echo "         14 - Show DEV Logs"
    echo "         15 - Stop DEV Environment"
    echo "         16 - Create Superadmin User (PROD)"
    echo "         17 - Clean Orphan Containers"
    echo "  ----------------------------------------------------------------------  "
    echo -e "${NORMAL}"
    echo -e "${CYAN}Input action number > ${NORMAL} "

    read -p "" choice
    case "$choice" in
    1) app_run_dev ;;
    2) app_run_local ;;
    3) app_run_production ;;
    4) app_clean_all ;;
    5) app_stop_all ;;
    6) app_run_backend ;;
    7) app_build_frontend_dev ;;
    8) app_build_frontend_prod ;;
    9) app_setup_swap ;;
    10) app_create_superadmin ;;
    11) app_fix_memory_issues ;;
    12) app_clean_uploads ;;
    13) app_dev_start ;;
    14) app_dev_logs ;;
    15) app_dev_stop ;;
    16) app_create_superadmin_prod ;;
    17) app_clean_orphans ;;
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
fi