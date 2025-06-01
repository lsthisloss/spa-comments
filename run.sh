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

function app_build_frontend_dev() {
    echo -e "\n${YELLOW}Building frontend for development...${NORMAL}\n"
    
    cd frontend
    
    echo -e "${CYAN}Installing dependencies...${NORMAL}"
    npm install
    
    echo -e "${CYAN}Creating development environment...${NORMAL}"
    cat > .env << EOF
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
NODE_ENV=development
EOF
    
    echo -e "${CYAN}Building frontend...${NORMAL}"
    npm run build
    
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

function app_build_frontend_prod() {
    echo -e "\n${YELLOW}Building frontend for production...${NORMAL}\n"
    
    cd frontend
    
    echo -e "${CYAN}Installing dependencies...${NORMAL}"
    npm install
    
    echo -e "${CYAN}Creating production environment...${NORMAL}"
    cat > .env.production << EOF
VITE_API_URL=https://sk8.pw
VITE_WS_URL=wss://sk8.pw
VITE_SOCKET_URL=https://sk8.pw
NODE_ENV=production
EOF
    
    echo -e "${CYAN}Building frontend for production...${NORMAL}"
    NODE_ENV=production npm run build
    
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
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
else
    echo -e "${CYAN}Action:${GREEN} $choice${NORMAL}"
    $choice
fi