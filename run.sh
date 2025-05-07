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

    echo -e "\n${YELLOW}Starting app containers (local/dev mode) ...${NORMAL}\n"
    kill -9 $(lsof -t -i:3000 2>/dev/null)
    docker-compose -f docker-compose.yml up -d

    echo -e "\n${YELLOW}Installing frontend dependencies ...${NORMAL}\n"
    cd frontend && npm i
    cd - >/dev/null

    echo -e "\n${YELLOW}Installing backend dependencies ...${NORMAL}\n"
    cd backend && npm i
    cd - >/dev/null
}

function app_run_production() {
    echo -e "\n${YELLOW}Stopping app containers ...${NORMAL}\n"
    docker-compose -f docker-compose.yml down

    echo -e "\n${YELLOW}Building images ...${NORMAL}\n"
    docker-compose -f docker-compose.yml build --no-cache

    echo -e "\n${YELLOW}Starting app containers (production mode) ...${NORMAL}\n"
    docker-compose -f docker-compose.yml up -d --remove-orphans

    echo -e "\n${GREEN}Production containers are up and running!${NORMAL}\n"
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
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
else
    echo -e "${CYAN}Action:${GREEN} $choice${NORMAL}"
    $choice
fi