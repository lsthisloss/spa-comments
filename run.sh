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

    docker-compose -f docker-compose.prod.yml down

    echo -e "\n${YELLOW}Building images ...${NORMAL}\n"
    docker-compose -f docker-compose.prod.yml build --no-cache
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}Error building images. Please check the Dockerfile and try again.${NORMAL}\n"
        exit 1
    fi

    echo -e "\n${YELLOW}Starting app containers (backend only) ...${NORMAL}\n"
    # Only kill if a process is found
    if lsof -t -i:3000 >/dev/null 2>&1; then
        kill -9 $(lsof -t -i:3000)
    fi
    docker-compose -f docker-compose.prod.yml up
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
    docker-compose -f docker-compose.dev.yml down -v --rmi all --remove-orphans 2>/dev/null
    docker-compose -f docker-compose.prod.yml down -v --rmi all --remove-orphans 2>/dev/null
    docker system prune -af --volumes
    echo -e "\n${GREEN}Всё очищено!${NORMAL}\n"
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
    echo "         5 - Run Backend (docker-compose up)"
    echo "         6 - Build Frontend (Development)"
    echo "         7 - Build Frontend (Production)"
    echo "         8 - Setup Swap Space (for low memory servers)"
    echo "  ----------------------------------------------------------------------  "
    echo -e "${NORMAL}"
    echo -e "${CYAN}Input action number > ${NORMAL} "

    read -p "" choice
    case "$choice" in
    1)
        app_run_dev
        ;;
    2)
        app_run_local
        ;;
    3)
        app_run_production
        ;;
    4)
        app_clean_all
        ;;
    5)
        app_run_backend
        ;;
    6)
        app_build_frontend_dev
        ;;
    7)
        app_build_frontend_prod
        ;;
    8)
        app_setup_swap
        ;;
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
else
    echo -e "${CYAN}Action:${GREEN} $choice${NORMAL}"
    $choice
fi