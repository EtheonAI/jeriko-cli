#!/bin/bash
# scripts/__tests__/phase8-retirement-guards.test.sh
# Phase 8 retirement and rollback guard tests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS=0

echo "=== Phase 8 Retirement Guard Tests ==="
echo ""

# Test 1: Script exists and is executable
test_script_executable() {
  echo "[Test 1] Validate script exists and is executable..."
  if [ -x "$SCRIPT_DIR/../validate-rollback-gates.sh" ]; then
    echo "✓ validate-rollback-gates.sh is executable"
    return 0
  else
    echo "✗ validate-rollback-gates.sh not found or not executable"
    return 1
  fi
}

# Test 2: Script runs without errors (mock mode)
test_script_runs() {
  echo "[Test 2] Validate script runs without errors..."
  if "$SCRIPT_DIR/../validate-rollback-gates.sh" "24h" > /dev/null 2>&1; then
    echo "✓ Script runs successfully"
    return 0
  else
    echo "✗ Script failed to run"
    return 1
  fi
}

# Test 3: Script outputs expected gates
test_output_format() {
  echo "[Test 3] Validate output format..."
  OUTPUT=$("$SCRIPT_DIR/../validate-rollback-gates.sh" "24h")

  if echo "$OUTPUT" | grep -q "Tool error rate"; then
    echo "✓ Gate 1 (Tool error rate) present in output"
  else
    echo "✗ Gate 1 missing"
    return 1
  fi

  if echo "$OUTPUT" | grep -q "WS failures"; then
    echo "✓ Gate 2 (WS failures) present in output"
  else
    echo "✗ Gate 2 missing"
    return 1
  fi

  if echo "$OUTPUT" | grep -q "Timeline gaps"; then
    echo "✓ Gate 3 (Timeline gaps) present in output"
  else
    echo "✗ Gate 3 missing"
    return 1
  fi

  if echo "$OUTPUT" | grep -q "Credits errors"; then
    echo "✓ Gate 4 (Credits errors) present in output"
  else
    echo "✗ Gate 4 missing"
    return 1
  fi

  if echo "$OUTPUT" | grep -q "First token p95"; then
    echo "✓ Gate 5 (First token latency) present in output"
  else
    echo "✗ Gate 5 missing"
    return 1
  fi

  return 0
}

# Test 4: Script exits with success when gates clear
test_success_exit_code() {
  echo "[Test 4] Validate success exit code..."
  if "$SCRIPT_DIR/../validate-rollback-gates.sh" "24h" > /dev/null 2>&1; then
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      echo "✓ Script exits with code 0 on success"
      return 0
    else
      echo "✗ Script exits with code $EXIT_CODE (expected 0)"
      return 1
    fi
  else
    echo "✗ Script failed unexpectedly"
    return 1
  fi
}

# Test 5: Hot-standby script exists
test_hotstandby_exists() {
  echo "[Test 5] Validate hot-standby test script exists..."
  if [ -x "$SCRIPT_DIR/../test-hot-standby.sh" ]; then
    echo "✓ test-hot-standby.sh is executable"
    return 0
  else
    echo "✗ test-hot-standby.sh not found or not executable"
    return 1
  fi
}

# Test 6: Retirement scripts exist and are guarded
test_retirement_scripts_guarded() {
  echo "[Test 6] Validate retirement scripts exist and are guarded..."

  if [ -x "$SCRIPT_DIR/../retire-python-agent.sh" ]; then
    echo "✓ retire-python-agent.sh exists"

    # Test dry-run confirmation path when preconditions are satisfied
    RETIRE_OUTPUT=$(env HOLD_WINDOW_COMPLETE=true TECH_LEAD_APPROVAL=true "$SCRIPT_DIR/../retire-python-agent.sh" 2>&1 || true)
    if echo "$RETIRE_OUTPUT" | grep -q "DRY-RUN MODE"; then
      echo "✓ retire-python-agent.sh requires --confirm flag"
    else
      echo "✗ retire-python-agent.sh missing confirmation guard"
      return 1
    fi
  else
    echo "✗ retire-python-agent.sh not found"
    return 1
  fi

  if [ -x "$SCRIPT_DIR/../retire-sandbox-service.sh" ]; then
    echo "✓ retire-sandbox-service.sh exists"

    # Test that script requires --confirm
    SANDBOX_RETIRE_OUTPUT=$("$SCRIPT_DIR/../retire-sandbox-service.sh" 2>&1 || true)
    if echo "$SANDBOX_RETIRE_OUTPUT" | grep -q "FINAL CONFIRMATION REQUIRED"; then
      echo "✓ retire-sandbox-service.sh requires --confirm flag"
    else
      echo "✗ retire-sandbox-service.sh missing confirmation guard"
      return 1
    fi
  else
    echo "✗ retire-sandbox-service.sh not found"
    return 1
  fi

  return 0
}

# Test 7: Retirement preconditions enforced
test_retirement_preconditions() {
  echo "[Test 7] Validate retirement preconditions enforced..."

  # Test that retire-python-agent.sh fails without precondition markers
  RETIRE_CONFIRM_OUTPUT=$("$SCRIPT_DIR/../retire-python-agent.sh" --confirm 2>&1 || true)
  if echo "$RETIRE_CONFIRM_OUTPUT" | grep -q "Hold window (14 days) not complete"; then
    echo "✓ retire-python-agent.sh enforces hold window completion"
  else
    echo "✗ retire-python-agent.sh missing hold window check"
    return 1
  fi

  return 0
}

# Run all tests
echo "Running tests..."
echo ""

test_script_executable || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

test_script_runs || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

test_output_format || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

test_success_exit_code || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

test_hotstandby_exists || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

test_retirement_scripts_guarded || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

test_retirement_preconditions || TEST_RESULTS=$((TEST_RESULTS + 1))
echo ""

# Summary
echo "=== Test Summary ==="
if [ $TEST_RESULTS -eq 0 ]; then
  echo "✓ All tests passed (7/7)"
  exit 0
else
  echo "✗ Some tests failed ($TEST_RESULTS failures)"
  exit 1
fi
