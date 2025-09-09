#!/bin/bash

PORT=3007
echo "Checking if port $PORT is in use..."

# 查找使用端口3007的所有进程
PIDS=$(lsof -ti:$PORT)

if [ -n "$PIDS" ]; then
    echo "Found processes using port $PORT: $PIDS"
    echo "Killing all processes..."
    # 强制杀死所有使用该端口的进程
    echo $PIDS | xargs kill -9
    echo "Processes killed successfully."
    
    # 等待端口释放
    echo "Waiting for port to be released..."
    sleep 2
    
    # 再次检查端口是否释放
    REMAINING=$(lsof -ti:$PORT)
    if [ -n "$REMAINING" ]; then
        echo "Still found processes: $REMAINING. Killing again..."
        echo $REMAINING | xargs kill -9
        sleep 2
    fi
else
    echo "Port $PORT is not in use."
fi

echo "Starting development server..."
npm run start:dev