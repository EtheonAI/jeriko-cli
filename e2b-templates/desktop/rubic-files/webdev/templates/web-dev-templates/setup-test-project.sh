#!/bin/bash

# 设置测试项目以便手动运行和浏览器测试
# 用法: ./setup-test-project.sh <template_name> [project_name]
# 示例: ./setup-test-project.sh web-static my-test

set -e

TEMPLATE_NAME="${1:-web-static}"
PROJECT_NAME="${2:-test-${TEMPLATE_NAME}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="${SCRIPT_DIR}/templates"
TEMPLATE_PATH="${TEMPLATES_DIR}/${TEMPLATE_NAME}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查模板是否存在
if [ ! -d "$TEMPLATE_PATH" ]; then
    echo "❌ Template '$TEMPLATE_NAME' not found at $TEMPLATE_PATH"
    echo ""
    echo "Available templates:"
    ls -1 "$TEMPLATES_DIR"
    exit 1
fi

# 创建测试项目目录
TEST_BASE="/tmp/template-test-projects"
PROJECT_DIR="${TEST_BASE}/${PROJECT_NAME}"

# 如果项目已存在，询问是否覆盖
if [ -d "$PROJECT_DIR" ]; then
    log_warn "Project directory already exists: $PROJECT_DIR"
    read -p "Do you want to delete it and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$PROJECT_DIR"
        log_info "Deleted existing project"
    else
        log_info "Using existing project directory"
        cd "$PROJECT_DIR"
        
        echo ""
        echo "═══════════════════════════════════════════════════"
        echo "📂 Project location: $PROJECT_DIR"
        echo "═══════════════════════════════════════════════════"
        echo ""
        echo "To start development:"
        echo "  cd $PROJECT_DIR"
        echo "  pnpm dev"
        echo ""
        exit 0
    fi
fi

# 创建目录
mkdir -p "$TEST_BASE"

log_step "1/3 Copying template '$TEMPLATE_NAME' to test directory..."
cp -r "$TEMPLATE_PATH" "$PROJECT_DIR"
log_info "✓ Template copied"

cd "$PROJECT_DIR"

log_step "2/3 Installing dependencies with pnpm..."
if pnpm install; then
    log_info "✓ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

log_step "3/3 Setup complete!"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Test project ready!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "📂 Project location:"
echo "   $PROJECT_DIR"
echo ""
echo "🚀 To start development server:"
echo "   cd $PROJECT_DIR"
echo "   pnpm dev"
echo ""
echo "🌐 The dev server will typically run on:"
echo "   http://localhost:5173"
echo ""
echo "📝 Other useful commands:"
echo "   pnpm build     - Build for production"
echo "   pnpm check     - Run TypeScript type checking"
echo ""
echo "🗑️  To clean up when done:"
echo "   rm -rf $PROJECT_DIR"
echo ""

