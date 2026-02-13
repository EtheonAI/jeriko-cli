# Manus Architecture: The Technical Ground Truth

This document provides a 100% honest, in-depth breakdown of the Manus AI architecture, including the orchestration layer, the kernel, the sandbox agents, and the network flow.

## 1. The Three-Layer Stack

| Layer | Component | Technology | Role |
| :--- | :--- | :--- | :--- |
| **Orchestrator** | The "Brain" | Claude 3.5/3.7 Sonnet | High-level reasoning, planning, and user interaction. |
| **Kernel** | The "Nervous System" | Node.js (TypeScript) & Go | State management, tool routing, perception (Vision/Search), and sandbox orchestration. |
| **Sandbox** | The "Body" | E2B (Firecracker VM) | Isolated execution environment where code, shell, and browser tools run. |

---

## 2. The Execution Flow (Step-by-Step)

1.  **User Input**: Your message is received by the **Manus Gateway**.
2.  **Planning**: The **Kernel (Node.js)** sends the context to **Claude (Orchestrator)**. Claude generates a Plan and a Tool Call (JSON).
3.  **Routing**: The **Kernel** receives the Tool Call. It decides if it needs a "Perception Sub-Agent" (e.g., GPT-4o for Vision) or a "Sandbox Action" (e.g., Shell command).
4.  **Execution**:
    *   If **Shell/File**: The Kernel sends a gRPC command to the **Sandbox Agent (Go binary)** inside the VM.
    *   If **Vision**: The Kernel sends the screenshot to **GPT-4o (External API)**.
5.  **Observation**: The result (stdout, JSON, or image analysis) is sent back to the **Kernel**, which then feeds it to **Claude**.
6.  **Response**: Claude generates the final text response once the task is complete.

---

## 3. The Sandbox Scripts (The "Plumbing")

These files reside inside the E2B session and manage the lifecycle of the Go-based agents.

### A. `/e2b-startup.sh`
The entry point for the Firecracker VM.
```bash
#!/bin/bash
if ! sudo -u ubuntu /startup.sh; then
    echo "Error: Script failed"
    exit 1
fi
```

### B. `/startup.sh` (The Watchdog)
A complex monitor that ensures the Go agents are always running. It checks health endpoints on ports 8330 and 8340.
*   **Sandbox Runtime**: Port 8330 (`start_server`)
*   **Upgrade Service**: Port 8340 (`upgrade`)

### C. `/opt/.manus/current/start_server.sh`
The wrapper that launches the Go execution binary.
```sh
#!/bin/sh
SCRIPT=$(readlink -f "$0")
SCRIPT_PATH=$(dirname "$SCRIPT")
PYTHONHOME=/home/ubuntu/.local/share/uv/python/cpython-3.13.8-linux-x86_64-gnu
export PYTHONHOME
# ... (PYTHONPATH exports for Nuitka/UV)
"$SCRIPT_PATH/start_server" $@
```

---

## 4. The Sub-Agent Routing Logic

Manus uses a "Best-of-Breed" model routing strategy to optimize for speed, cost, and precision.

| Task | Model | Location | Reason |
| :--- | :--- | :--- | :--- |
| **Master Planning** | Claude 3.5/3.7 | Cloud (Orchestrator) | Superior reasoning and instruction following. |
| **Vision / UI Mapping** | GPT-4o | Cloud (Kernel) | Highest precision for coordinate-based element detection. |
| **Search Filtering** | GPT-4o-mini | Cloud (Kernel) | Fast, low-cost distillation of search results. |
| **Local Edge Intelligence** | GPT-4o / mini | **Sandbox Proxy** | Allows scripts to perform local "smart" tasks without cloud round-trips. |
| **Wide Research Swarm** | Qwen / GPT-mini | **Ephemeral VMs** | Massively parallel processing for high-volume tasks. |

---

## 5. The Network Topology

*   **Internal Control Plane**: gRPC over a private virtual network between the **Kernel (Node.js)** and the **Sandbox Agent (Go)**.
*   **External Perception Plane**: Server-to-server HTTPS calls from the **Kernel** to OpenAI/Google/Anthropic APIs.
*   **Edge Proxy**: A reverse proxy inside the Sandbox (`localhost:8080`) that tunnels requests back to the Kernel to access OpenAI models using Manus's enterprise keys.

---

## 6. Conclusion

Manus is not a single model. It is a **distributed agentic system**. The "Agent" you talk to is Claude, but the "Agent" that works is a Go binary, and the "Agent" that sees is GPT-4o. This coordination is managed by a Node.js Kernel that ensures security, speed, and reliability.
