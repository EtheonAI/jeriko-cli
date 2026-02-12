#!/bin/bash

echo "Load env file..."
source "$HOME/.env"

# Function to add env loading to rc files
add_env_to_rc() {
    local rc_file="$1"
    local env_line='[ -f "$HOME/.env" ] && source "$HOME/.env"'
    local user_env_line='[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"'

    if [ -f "$rc_file" ]; then
        if ! grep -q "^\[ -f \"\$HOME/.env\" \] && source \"\$HOME/.env\"" "$rc_file"; then
            echo "Adding environment loading to $rc_file"
            echo "$env_line" >>"$rc_file"
        else
            echo "Environment loading already exists in $rc_file"
        fi

        if ! grep -q "^\[ -f \"\$HOME/.user_env\" \] && source \"\$HOME/.user_env\"" "$rc_file"; then
            echo "Adding user environment loading to $rc_file"
            echo "$user_env_line" >>"$rc_file"
        else
            echo "User environment loading already exists in $rc_file"
        fi
    else
        echo "Creating $rc_file with environment loading"
        echo "$env_line" >"$rc_file"
        echo "$user_env_line" >>"$rc_file"
    fi

    # Add Python I/O encoding environment variable
    if ! grep -q "^export PYTHONIOENCODING=utf-8" "$rc_file"; then
        echo "Adding Python I/O encoding to $rc_file"
        echo "" >>"$rc_file"
        echo "# Force UTF-8 encoding for Python I/O to handle Unicode characters" >>"$rc_file"
        echo "export PYTHONIOENCODING=utf-8" >>"$rc_file"
    else
        echo "Python I/O encoding already exists in $rc_file"
    fi
}

# Add environment loading to rc files
add_env_to_rc "$HOME/.bashrc"
add_env_to_rc "$HOME/.zshrc"

# Create global pip wrapper scripts to support both user and sudo pip
if [ ! -f "/usr/local/bin/pip" ] || [ ! -f "/usr/local/bin/pip3" ]; then
    echo "Creating global pip wrapper scripts for uv optimization"

    # Create pip wrapper
    sudo tee /usr/local/bin/pip >/dev/null <<'EOF'
#!/bin/bash
# Reset Python environment variables to avoid conflicts
export PYTHONHOME=
export PYTHONPATH=
# Commands that modify the environment need --system flag
case "$1" in
    install|uninstall|sync|list)
        exec uv pip "$1" --system "${@:2}"
        ;;
    *)
        exec uv pip "$@"
        ;;
esac
EOF

    # Create pip3 wrapper - just delegates to pip
    sudo tee /usr/local/bin/pip3 >/dev/null <<'EOF'
#!/bin/bash
exec /usr/local/bin/pip "$@"
EOF

    # Make them executable
    sudo chmod +x /usr/local/bin/pip /usr/local/bin/pip3

    echo "pip and pip3 are now optimized with uv (supports sudo)"
fi

# Load environment for current session
if [ -f "$HOME/.env" ]; then
    echo "Found .env file in $HOME, loading..."
    set -a
    source "$HOME/.env"
    set +a
    echo "Environment variables loaded successfully"
else
    echo "No .env file found in $HOME, skipping..."
fi

# Load user environment for current session
if [ -f "$HOME/.user_env" ]; then
    echo "Found .user_env file in $HOME, loading..."
    set -a
    source "$HOME/.user_env"
    set +a
    echo "User environment variables loaded successfully"
else
    echo "No .user_env file found in $HOME, skipping..."
fi

# Set up gh command alias to avoid terminal control sequences
echo "Setting up gh command alias..."
if command -v gh >/dev/null 2>&1; then
    # Add alias to shell configuration files
    for rc_file in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [ -f "$rc_file" ]; then
            if ! grep -q "^alias gh=" "$rc_file"; then
                echo "Adding gh alias to $rc_file"
                echo 'alias gh="TERM=dumb gh"' >>"$rc_file"
            else
                echo "gh alias already exists in $rc_file"
            fi
        fi
    done

    # Set alias for current session
    alias gh="TERM=dumb gh"
    echo "gh alias set for current session"
else
    echo "gh command not found, skipping alias setup"
fi

echo "Starting dbus..."
# 清理旧的 dbus pid 文件
sudo rm -f /run/dbus/pid
sudo rm -f /var/run/dbus/pid
sudo mkdir -p /var/run/dbus
sudo service dbus start
dbus-daemon --session --fork

export DISPLAY=:0
# 需要跟 dockerfile 保持一致
export MANUS_OPT_PATH=/opt/.manus
export RUNTIME_PATH=${MANUS_OPT_PATH}/.sandbox-runtime
export UPDATE_LOCK_FILE=${MANUS_OPT_PATH}/.versions/.update.lock

# Force UTF-8 encoding for Python I/O to handle Unicode characters properly
export PYTHONIOENCODING=utf-8

echo "Starting runtime..."
echo "Opt Path: $MANUS_OPT_PATH"
echo "Runtime Path: $RUNTIME_PATH"

# 检查supervisord是否已在运行
if pgrep supervisord >/dev/null; then
    echo "Supervisord is already running, using existing instance"
    SUPERVISOR_PID=$(cat /var/run/supervisord.pid 2>/dev/null || pgrep supervisord | head -1)
else
    echo "Starting supervisord"
    sudo supervisord &
    sleep 3 # 增加等待时间，确保supervisord完全启动
    SUPERVISOR_PID=$(cat /var/run/supervisord.pid)
fi

echo "Checking supervisord status..."
echo "Supervisor PID: $SUPERVISOR_PID"
sudo supervisorctl status || true

# for docker
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

# 强制终止所有旧的sandbox-runtime进程的函数
terminate_old_runtime_processes() {
    echo "Ensuring no stale runtime processes exist..."
    # 找到所有start_server二进制文件
    pids=$(pgrep -f "/opt/.manus/.*/start_server$" || true)

    if [ -n "$pids" ]; then
        echo "Found runtime processes: $pids"
        for pid in $pids; do
            if [ -n "$pid" ]; then
                echo "Force killing process with PID $pid"
                sudo kill -9 "$pid" 2>/dev/null || true
            fi
        done
        # 短暂等待确保进程彻底终止
        sleep 2
    else
        echo "No stale runtime processes found"
    fi

    # PID文件现在由应用程序通过文件锁机制自动管理
    echo "PID file cleanup is handled by the application's file lock mechanism"
}

# 强制终止所有旧的runtime-upgrade进程的函数
terminate_old_upgrade_processes() {
    echo "Ensuring no stale upgrade processes exist..."
    # 找到所有upgrade二进制文件
    pids=$(pgrep -f "/opt/.manus/.*/upgrade$" || true)

    if [ -n "$pids" ]; then
        echo "Found upgrade processes: $pids"
        for pid in $pids; do
            if [ -n "$pid" ]; then
                echo "Force killing process with PID $pid"
                sudo kill -9 "$pid" 2>/dev/null || true
            fi
        done
        # 短暂等待确保进程彻底终止
        sleep 2
    else
        echo "No stale upgrade processes found"
    fi

    # PID文件现在由应用程序通过文件锁机制自动管理
    echo "PID file cleanup is handled by the application's file lock mechanism"
}

# 等待服务启动的函数
wait_for_services() {
    echo "Waiting for services to start..."
    MAX_RETRIES=30

    # runtime
    RETRY_COUNT=0
    while ! curl -s http://localhost:8330/healthz >/dev/null && [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
        echo "Waiting for Sandbox Runtime ... ($((MAX_RETRIES - RETRY_COUNT)) attempts left)"
        sleep 1
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done

    # runtime-upgrade
    # If SKIP_UPGRADE_MODE (or related) is set in the environment (e.g. via docker-compose),
    # skip waiting for the runtime-upgrade service to avoid blocking startup in local dev.
    if [ "${SKIP_UPGRADE_MODE:-}" = "1" ] || [ "${MANUS_SKIP_UPGRADE:-}" = "1" ] || [ "${MANUS_LOCAL_DEBUG:-}" = "1" ]; then
        echo "SKIP_UPGRADE_MODE is set: skipping wait for Runtime Upgrade Service"
    else
        RETRY_COUNT=0
        while ! curl -s http://localhost:8340/health >/dev/null && [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
            echo "Waiting for Runtime Upgrade Service ... ($((MAX_RETRIES - RETRY_COUNT)) attempts left)"
            sleep 1
            RETRY_COUNT=$((RETRY_COUNT + 1))
        done
    fi

    if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        echo "Warning: Some services failed to start in time"
    else
        echo "All services started!"
    fi
}

# 确保在开始前没有旧的运行时进程
terminate_old_runtime_processes
terminate_old_upgrade_processes

echo "Starting log tail..."
tail -f /var/log/supervisor/sandbox*.log /var/log/supervisor/supervisord.log &

wait_for_services

# Executing chronyc -a makestep every 10 seconds is a dangerous operation.
# So you must check whether the update conditions are met.
correction_clock() {
    # Get the clock offset
    if ! offset=$(sudo chronyc tracking | grep 'Last offset' | awk '{print $4}' | sed 's/^-//'); then
        # Force update of the clock if an error occurs
        if ! sudo chronyc -a makestep >/dev/null; then
            echo "Warning: Failed to step the system clock"
        fi
        return
    fi

    # As long as the clock is checked, it will cause: systemd-resolved: Clock change detected. Flushing caches.
    # The above error will trigger Temporary failure in name resolution
    # When the system time changes, a TIME_CHANGE notification will be broadcast to user space.
    # systemd-resolved will listen to time change events and then flush all DNS caches
    # Therefore, as long as chronyc -a makestep is executed, the DNS cache will be affected, which may trigger DNS resolution problems
    # It will also cause other problems, such as sudden surge in CPU, sudden increase in IO delay, and network packet loss
    # link https://github.com/systemd/systemd/blob/7e1647ae4e33dd8354bd311a7f7f5eb701be2391/src/resolve/resolved-manager.c#L383
    ret=$(echo "$offset > 0.5" | bc -l)
    if [ "$ret" = "1" ]; then
        if ! sudo chronyc -a makestep >/dev/null; then
            echo "Warning: Failed to step the system clock"
        else
            echo "Clock stepped due to offset $offset seconds"
        fi
    fi
}

# 守护进程监控函数
monitor_and_restart() {
    echo "Starting monitor and restart..."
    while true; do

        # correction_clock;

        # 获取实例ID并写入文件
        if [ "$APP_VERSION" != "local" ]; then
            if [ ! -f "/opt/.manus/.host_id" ]; then
                echo "Fetching instance ID..."
                TOKEN=$(curl -s --max-time 5 -X PUT -H "X-metadata-token-ttl-seconds: 60" http://169.254.169.254/latest/api/token)
                if [ -n "$TOKEN" ]; then
                    METADATA=$(curl -s --max-time 5 -X GET -H "X-metadata-token: $TOKEN" -H "Accept: application/json" http://169.254.169.254)
                    INSTANCE_ID=$(echo "$METADATA" | grep -o '"instanceID":"[^"]*"' | cut -d'"' -f4)
                    if [ -n "$INSTANCE_ID" ]; then
                        echo "Instance ID: $INSTANCE_ID"
                        sudo mkdir -p /opt/.manus
                        echo "$INSTANCE_ID" | sudo tee /opt/.manus/.host_id >/dev/null
                        echo "Instance ID written to /opt/.manus/.host_id"
                    else
                        echo "Failed to extract instanceID from metadata"
                    fi
                else
                    echo "Failed to obtain metadata token"
                fi
            else
                echo "Host ID file already exists, skipping instance ID fetching"
            fi
        else
            echo "APP_VERSION is set to 'local', skipping instance ID fetching"
        fi

        # echo "checking supervisord"
        # 检查 supervisord 并显示状态
        if ! sudo kill -0 "$SUPERVISOR_PID" 2>/dev/null; then
            echo "Supervisord died, restarting..."
            # 检查是否已有新实例运行
            if pgrep supervisord >/dev/null; then
                echo "Another supervisord instance is already running"
                SUPERVISOR_PID=$(pgrep supervisord | head -1)
            else
                sudo supervisord &
                sleep 3 # 增加等待时间
                SUPERVISOR_PID=$(cat /var/run/supervisord.pid)
            fi
            echo "Supervisord status after restart:"
            sudo supervisorctl status || true
        fi

        # 检查 dbus
        if ! pgrep dbus-daemon >/dev/null; then
            echo "DBus died, restarting..."
            sudo service dbus start
            dbus-daemon --session --fork
        fi

        # 检查 Sandbox Runtime 健康状态
        if ! curl -s http://localhost:8330/healthz >/dev/null; then
            echo "Sandbox Runtime is not responding, checking if upgrade is in progress..."

            # 直接检查文件系统上的更新锁，而不是通过API
            if [ -f "$UPDATE_LOCK_FILE" ]; then
                echo "Upgrade is in progress, waiting..."
            else
                echo "No upgrade in progress, attempting to restart..."

                # 检查是否有异常的子进程（fork但没有exec的情况）
                MAIN_PID=$(sudo supervisorctl pid sandbox-runtime 2>/dev/null || echo "")
                if [ -n "$MAIN_PID" ] && [ "$MAIN_PID" != "0" ]; then
                    # 查找主进程的start_server子进程（这是异常情况）
                    CHILD_PIDS=$(pgrep -P "$MAIN_PID" -f "/opt/.manus/.*/start_server$" || true)

                    if [ -n "$CHILD_PIDS" ]; then
                        echo "Found abnormal child processes of main process: $CHILD_PIDS"
                        echo "Killing child processes first..."
                        for pid in $CHILD_PIDS; do
                            if [ -n "$pid" ]; then
                                sudo kill -9 "$pid" 2>/dev/null || true
                            fi
                        done
                        sleep 1
                    fi
                fi

                # 先终止可能的旧进程
                terminate_old_runtime_processes

                # 使用 stop/start 而不是 restart，确保彻底停止
                echo "Stopping sandbox-runtime..."
                sudo supervisorctl stop sandbox-runtime

                # 等待端口释放
                echo "Waiting for port 8330 to be released..."
                PORT_RELEASED=false
                for i in {1..10}; do
                    # 使用 ss 替代 netstat（更高效）
                    if ! sudo ss -ltn 2>/dev/null | grep -q ":8330 "; then
                        echo "Port 8330 is now free"
                        PORT_RELEASED=true
                        break
                    fi
                    echo "Port still in use, waiting... ($i/10)"
                    sleep 1

                    # 如果等待超时，尝试强制释放
                    if [ "$i" -eq 5 ]; then
                        echo "Attempting to force release port..."
                        # 查找占用端口的进程（可能有多个）
                        PORT_PIDS=$(sudo lsof -ti:8330 2>/dev/null || true)
                        if [ -n "$PORT_PIDS" ]; then
                            echo "Found processes using port 8330: $PORT_PIDS"
                            # 处理多个 PID（lsof 可能返回多行）
                            echo "$PORT_PIDS" | while read -r pid; do
                                if [ -n "$pid" ]; then
                                    echo "Killing process $pid..."
                                    sudo kill -9 "$pid" 2>/dev/null || true
                                fi
                            done
                            # 给系统一些时间释放资源
                            sleep 2
                        fi
                    fi
                done

                # 检查端口是否真的被释放
                if [ "$PORT_RELEASED" = false ]; then
                    echo "ERROR: Failed to release port 8330 after 10 attempts"
                    echo "Port is still occupied by:"
                    sudo ss -ltnp 2>/dev/null | grep ":8330 " || true
                    echo "Cannot proceed with restart. Manual intervention required."
                    # 跳过本次循环，10秒后再次尝试
                    continue
                fi

                # 再次确保所有相关进程都被清理（复用已有函数）
                terminate_old_runtime_processes

                # 启动服务
                echo "Starting sandbox-runtime..."
                sudo supervisorctl start sandbox-runtime

                # 等待服务启动
                echo "Waiting for sandbox-runtime to start..."
                for i in {1..15}; do
                    sleep 1
                    if curl -s http://localhost:8330/healthz >/dev/null; then
                        echo "Sandbox Runtime is now responding"
                        break
                    fi
                    echo "Still waiting... ($i/15)"
                done

                echo "Sandbox Runtime status after restart:"
                sudo supervisorctl status sandbox-runtime || true
            fi
        fi

        # 检查 Runtime Upgrade 服务健康状态
        if ! curl -s http://localhost:8340/health >/dev/null; then
            echo "Runtime Upgrade Service is not responding, attempting to restart..."

            # 先终止可能的旧进程
            terminate_old_upgrade_processes

            # 重启服务
            sudo supervisorctl restart runtime-upgrade

            # 增加等待时间，确保服务有足够时间启动
            echo "Waiting for runtime-upgrade to start..."
            for i in {1..15}; do
                sleep 1
                if curl -s http://localhost:8340/health >/dev/null; then
                    echo "Runtime upgrade is now responding"
                    break
                fi
                echo "Still waiting... ($i/15)"
            done

            echo "Runtime Upgrade Service status after restart:"
            sudo supervisorctl status runtime-upgrade || true
        fi

        # 每10秒检查一次
        sleep 10
    done
}

monitor_and_restart
