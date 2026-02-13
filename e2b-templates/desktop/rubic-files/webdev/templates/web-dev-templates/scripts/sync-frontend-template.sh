#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

# Define template list
TEMPLATES=(
    "web-db-user"
    "web-static"
)

# Directories to sync
SYNC_DIRS=(
    "client/src/components"
    "client/src/contexts"
    "client/src/hooks"
)

# Files to sync
SYNC_FILES=(
    "client/src/App.tsx"
    "client/src/index.css"
    "client/src/const.ts"
)

# Blacklist - files/directories to exclude from sync (relative paths from template root)
BLACKLIST=(
    "client/src/components/DashboardLayout.tsx"
)

# Function to check if a file/directory is in the blacklist
is_blacklisted() {
    local full_path="$1"
    local source_dir="$2"

    # Get relative path from source template root
    local rel_path="${full_path#$source_dir/}"

    for blacklisted in "${BLACKLIST[@]}"; do
        if [[ "$rel_path" == "$blacklisted" ]]; then
            return 0  # true, is blacklisted
        fi
    done
    return 1  # false, not blacklisted
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Frontend Template Sync Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Display template list for user selection
echo -e "${YELLOW}Select source template:${NC}"
for i in "${!TEMPLATES[@]}"; do
    echo "  $((i+1)). ${TEMPLATES[$i]}"
done
echo ""

# Read user input
read -p "Enter number (default: 1): " choice
choice=${choice:-1}

# Validate input
if ! [[ "$choice" =~ ^[1-4]$ ]]; then
    echo -e "${RED}Error: Invalid selection${NC}"
    exit 1
fi

# Get source template
SOURCE_TEMPLATE="${TEMPLATES[$((choice-1))]}"
SOURCE_DIR="$TEMPLATES_DIR/$SOURCE_TEMPLATE"

echo ""
echo -e "${GREEN}Selected: $SOURCE_TEMPLATE${NC}"
echo ""

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: Source directory does not exist: $SOURCE_DIR${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Starting sync...${NC}"
echo ""

# Sync to other templates
for template in "${TEMPLATES[@]}"; do
    if [ "$template" == "$SOURCE_TEMPLATE" ]; then
        continue
    fi

    TARGET_DIR="$TEMPLATES_DIR/$template"

    if [ ! -d "$TARGET_DIR" ]; then
        echo -e "${YELLOW}Skipped: $template (directory not found)${NC}"
        continue
    fi

    echo -e "${GREEN}Syncing to: $template${NC}"

    # Sync directories
    for dir in "${SYNC_DIRS[@]}"; do
        SOURCE_PATH="$SOURCE_DIR/$dir"
        TARGET_PATH="$TARGET_DIR/$dir"

        if [ -d "$SOURCE_PATH" ]; then
            echo "  - Syncing directory: $dir"

            # Create target directory if it doesn't exist
            mkdir -p "$TARGET_PATH"

            # Remove existing files in target (but we'll re-add non-blacklisted ones)
            rm -rf "$TARGET_PATH"
            mkdir -p "$TARGET_PATH"

            # Copy files, excluding blacklisted items
            for item in "$SOURCE_PATH"/*; do
                if [ -e "$item" ]; then
                    if is_blacklisted "$item" "$SOURCE_DIR"; then
                        echo -e "    ${YELLOW}✗ Skipped (blacklisted): $(basename "$item")${NC}"
                    else
                        cp -r "$item" "$TARGET_PATH/"
                    fi
                fi
            done
        else
            echo -e "  ${YELLOW}⚠ Source directory not found: $dir${NC}"
        fi
    done

    # Sync files
    for file in "${SYNC_FILES[@]}"; do
        SOURCE_PATH="$SOURCE_DIR/$file"
        TARGET_PATH="$TARGET_DIR/$file"

        if [ -f "$SOURCE_PATH" ]; then
            echo "  - Syncing file: $file"
            cp "$SOURCE_PATH" "$TARGET_PATH"
        else
            echo -e "  ${YELLOW}⚠ Source file not found: $file${NC}"
        fi
    done

    echo ""
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Sync completed!${NC}"
echo -e "${GREEN}========================================${NC}"
