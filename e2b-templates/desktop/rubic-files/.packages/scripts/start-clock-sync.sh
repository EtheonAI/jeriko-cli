#!/bin/bash

# Resolve clock synchronization issues when sandbox is first created

# Synchronization threshold (in seconds)
THRESHOLD=1
# Minimum running time (in seconds)
MIN_DURATION=60

START_TIME=$(date +%s)

while true; do
  phc_time=$(sudo /usr/sbin/phc_ctl /dev/ptp0 get | cut -d' ' -f5) # Get hardware clock time
  if [[ -z "$phc_time" ]]; then
    echo "Error: Unable to get PHC time from /dev/ptp0"
    exit 1
  fi

  # Get current system time (seconds.nanoseconds)
  sys_time=$(date +%s.%N)

  # Calculate absolute time difference
  diff=$(echo "scale=3; $phc_time - $sys_time" | bc | awk '{print ($1 < 0) ? -$1 : $1}')

  # Calculate elapsed running time of script
  current_time=$(date +%s)
  elapsed_time=$((current_time - START_TIME))

  # Output current time difference
  echo "PHC time: $phc_time | System time: $sys_time | Diff: ${diff}s | Elapsed: ${elapsed_time}s"

  # Stop if time diff <= threshold AND running time >= MIN_DURATION (both clocks might be old initially)
  if (( $(echo "$diff <= $THRESHOLD" | bc -l) )) && (( elapsed_time >= MIN_DURATION )); then
    echo "Condition met: time diff <=${THRESHOLD}s and running >=${MIN_DURATION}s, stopping sync"
    exit 0
  elif (( $(echo "$diff <= $THRESHOLD" | bc -l) )); then
    echo "Time diff <=${THRESHOLD}s but running time <${MIN_DURATION}s, continuing to monitor..."
  fi

  # Synchronize time and display result
  sudo date -s "@$phc_time" # Sync hardware clock to system clock

   # Wait 1 second
  sleep 1
done