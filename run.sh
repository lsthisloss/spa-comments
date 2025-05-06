# filepath: /home/dev/spa-comments/run.sh
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NORMAL='\033[0m'

function app_run_local() {
    echo -e "\n${YELLOW}Stopping app containier ...${NORMAL}\n"
    if [ -f .env.example ] && [ ! -f .env ]; then
    mv .env.example .env
    fi
    docker-compose -f docker-compose.yml down

    echo -e "\n${YELLOW}Starting app containier ...${NORMAL}\n"
    kill -9 $(lsof -t -i:3000)
    docker-compose -f docker-compose.yml up -d

    echo -e "\n${YELLOW}Installing frontend dependencies ...${NORMAL}\n"
    cd frontend && npm i
    cd - >/dev/null # вернёмся в корень

    echo -e "\n${YELLOW}Installing backend dependencies ...${NORMAL}\n"
    cd backend && npm i 
    cd - >/dev/null
}

while getopts c:t: flag; do
    case "${flag}" in
    c) choice=${OPTARG} ;;
    esac
done

#or take first argument
if [ ! $choice ] && [ $1 ]; then
    echo ">>>>$1"
    choice=$1
fi

if [ -z $choice ]; then
    echo -e "  ----------------------------------------------------------------------  "
    echo "  -                        Deployment Menu                             -  "
    echo "  ----------------------------------------------------------------------  "
    echo "         1 - Run Local"
    echo "  ----------------------------------------------------------------------  "
    echo -e "${NORMAL}"
    echo -e "${CYAN}Input action number > ${NORMAL} "

    read -p "" choice
    case "$choice" in
    1)
        app_run_local
        app_logs
        ;;
    *) echo -e "\n${RED}Invalid action number${NORMAL}\n" ;;
    esac
else
    echo -e "${CYAN}Action:${GREEN} $choice${NORMAL}"
    $choice
fi
