#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NORMAL='\033[0m'

function app_run_local() {
    echo -e "\n${YELLOW}Stopping app containers ...${NORMAL}\n"
    if [ -f .env.example ] && [ ! -f .env ]; then
        mv .env.example .env
    fi

    docker-compose -f docker-compose.yml down

    echo -e "\n${YELLOW}Building images ...${NORMAL}\n"
    docker-compose -f docker-compose.yml build
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}Error building images. Please check the Dockerfile and try again.${NORMAL}\n"
        exit 1
    fi

    echo -e "\n${YELLOW}Starting app containers (local/dev mode) ...${NORMAL}\n"
    # Only kill if a process is found
    if lsof -t -i:3000 >/dev/null 2>&1; then
        kill -9 $(lsof -t -i:3000)
    fi
    docker-compose -f docker-compose.yml up
}

function app_run_production() {
    echo -e "\n${YELLOW}Stopping app containers ...${NORMAL}\n"
    docker-compose -f docker-compose.yml down

    echo -e "\n${YELLOW}Building images ...${NORMAL}\n"
    docker-compose -f docker-compose.yml build --no-cache

    echo -e "\n${YELLOW}Starting app containers (production mode) ...${NORMAL}\n"
    docker-compose -f docker-compose.yml up --remove-orphans

    echo -e "\n${GREEN}Production containers are up and running!${NORMAL}\n"
}

function app_clean_all() {
    echo -e "\n${RED}Останавливаю и удаляю все контейнеры, образы и volume'ы...${NORMAL}\n"
    docker-compose -f docker-compose.yml down -v --rmi all --remove-orphans
    docker system prune -af --volumes
    echo -e "\n${GREEN}Всё очищено!${NORMAL}\n"
}

function app_run_frontend() {
    echo -e "\n${YELLOW}Building and starting frontend container ...${NORMAL}\n"
    docker-compose down frontend
    docker-compose -f docker-compose.yml build --no-cache frontend
    docker-compose -f docker-compose.yml up frontend
}

function app_run_backend() {
    echo -e "\n${YELLOW}Building and starting backend container ...${NORMAL}\n"
    docker-compose down backend
    docker-compose -f docker-compose.yml build --no-cache backend
    docker-compose -f docker-compose.yml up backend
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
    echo "         1 - Run Local (dev mode)"
    echo "         2 - Run Production"
    echo "         3 - Clean ALL (containers, images, volumes, DB)"
    echo "         4 - Run Frontend Only"
    echo "         5 - Run Backend Only"
    echo "  ----------------------------------------------------------------------  "
    echo -e "${NORMAL}"
    echo -e "${CYAN}Input action number > ${NORMAL} "

    read -p "" choice
    case "$choice" in
    1)
        app_run_local
        ;;
    2)
        app_run_production
        ;;
    3)
        app_clean_all
        ;;
    4)
        app_run_frontend
        ;;
    5)
        app_run_backend
        ;;
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
else
    echo -e "${CYAN}Action:${GREEN} $choice${NORMAL}"
    $choice
fi