#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NORMAL='\033[0m'

function app_run_dev() {
    echo -e "\n${YELLOW}Starting development environment with frontend in Docker...${NORMAL}\n"
    if [ -f .env.example ] && [ ! -f .env ]; then
        mv .env.example .env
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
    if [ -f .env.example ] && [ ! -f .env ]; then
        mv .env.example .env
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

function app_run_production() {
    echo -e "\n${YELLOW}Stopping app containers ...${NORMAL}\n"
    docker-compose -f docker-compose.prod.yml down

    echo -e "\n${YELLOW}Building images ...${NORMAL}\n"
    docker-compose -f docker-compose.prod.yml build --no-cache

    echo -e "\n${YELLOW}Starting app containers (production mode) ...${NORMAL}\n"
    docker-compose -f docker-compose.prod.yml up --remove-orphans

    echo -e "\n${GREEN}Production containers are up and running!${NORMAL}\n"
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

function app_create_superadmin() {
    echo -e "\n${YELLOW}Creating superadmin user...${NORMAL}\n"
    
    cd backend
    
    if [ ! -f "src/scripts/create-superadmin.ts" ]; then
        echo -e "${RED}create-superadmin.ts script not found!${NORMAL}"
        cd ..
        exit 1
    fi
    
    echo -e "${CYAN}Running superadmin creation script...${NORMAL}"
    npm run create-superadmin:local
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Superadmin created successfully!${NORMAL}"
    else
        echo -e "${RED}❌ Failed to create superadmin${NORMAL}"
    fi
    
    cd ..
}

function app_create_superadmin() {
    echo -e "\n${YELLOW}Creating superadmin user...${NORMAL}\n"
    
    # Проверяем, что сервисы запущены
    if ! docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
        echo -e "${CYAN}Starting database first...${NORMAL}"
        docker-compose -f docker-compose.prod.yml up -d postgres
        echo -e "${CYAN}Waiting for database to be ready...${NORMAL}"
        sleep 15
    fi
    
    # Вариант 1: Запуск через Docker Compose
    echo -e "${CYAN}🔧 Running superadmin script...${NORMAL}"
    if docker-compose -f docker-compose.prod.yml run --rm backend npm run create-superadmin; then
        echo -e "${GREEN}✅ SuperAdmin created successfully!${NORMAL}"
        return 0
    fi
    
    # Вариант 2: С кастомными данными
    echo -e "\n${YELLOW}Enter custom SuperAdmin details:${NORMAL}"
    
    read -p "Email (default: admin@sk8.pw): " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@sk8.pw}
    
    read -p "Username (default: Admin): " ADMIN_USERNAME  
    ADMIN_USERNAME=${ADMIN_USERNAME:-Admin}
    
    read -s -p "Password (leave empty for auto-generated): " ADMIN_PASSWORD
    echo
    
    docker-compose -f docker-compose.prod.yml run --rm \
        -e ADMIN_EMAIL="$ADMIN_EMAIL" \
        -e ADMIN_USERNAME="$ADMIN_USERNAME" \
        ${ADMIN_PASSWORD:+-e ADMIN_PASSWORD="$ADMIN_PASSWORD"} \
        backend npm run create-superadmin
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
        
        if [ $FILES_COUNT -gt 0 ]; then
            echo -e "${YELLOW}⚠️  This will delete ALL uploaded files (avatars, images, documents)${NORMAL}"
            echo -e "${RED}⚠️  This action cannot be undone!${NORMAL}"
            echo -n -e "${CYAN}Are you sure? (y/N): ${NORMAL}"
            read -r CONFIRM
            
            if [[ $CONFIRM =~ ^[Yy]$ ]]; then
                echo -e "${CYAN}Removing uploads directory...${NORMAL}"
                
                # Пробуем удалить без sudo
                if rm -rf backend/uploads/* 2>/dev/null; then
                    echo -e "${GREEN}✅ Uploads cleaned successfully!${NORMAL}"
                else
                    echo -e "${YELLOW}Need elevated permissions...${NORMAL}"
                    # Пробуем с sudo
                    if sudo rm -rf backend/uploads/* 2>/dev/null; then
                        echo -e "${GREEN}✅ Uploads cleaned successfully with sudo!${NORMAL}"
                    else
                        echo -e "${RED}❌ Failed to clean uploads. Trying to fix permissions...${NORMAL}"
                        
                        # Даем права на папку и пробуем снова
                        sudo chown -R $(whoami):$(whoami) backend/uploads/ 2>/dev/null || true
                        sudo chmod -R 755 backend/uploads/ 2>/dev/null || true
                        
                        if rm -rf backend/uploads/* 2>/dev/null; then
                            echo -e "${GREEN}✅ Uploads cleaned after fixing permissions!${NORMAL}"
                        else
                            echo -e "${RED}❌ Still failed. Manual cleanup required.${NORMAL}"
                            echo -e "${CYAN}Try: sudo rm -rf backend/uploads/*${NORMAL}"
                        fi
                    fi
                fi
                
                # Пересоздаем структуру папок
                echo -e "${CYAN}Recreating uploads structure...${NORMAL}"
                mkdir -p backend/uploads/avatars 2>/dev/null || sudo mkdir -p backend/uploads/avatars
                mkdir -p backend/uploads/images 2>/dev/null || sudo mkdir -p backend/uploads/images
                mkdir -p backend/uploads/files 2>/dev/null || sudo mkdir -p backend/uploads/files
                
                # Даем правильные права
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
    echo "         10 - Create Superadmin User"
    echo "         11 - Fix Memory Issues"
    echo "         12 - Clean Uploads Directory"
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
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
fi