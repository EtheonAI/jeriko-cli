/**
 * E2B Code Interpreter Template — Rubic Python Sandbox
 *
 * Ubuntu 22.04 + Python 3.11 + Jupyter + Data Science Libraries.
 * Optimized for code execution with popular ML/Data Science packages.
 *
 * Build: npx tsx build.ts
 * Usage: E2BSandbox.create({ template: 'code-interpreter-v1' })
 *
 * Pre-installed packages:
 *   - NumPy, Pandas, Matplotlib, Seaborn
 *   - SciPy, Scikit-learn
 *   - Requests, BeautifulSoup4
 *   - Jupyter, IPython
 *
 * Use cases:
 *   - code_execute tool
 *   - Data analysis and visualization
 *   - Scientific computing
 *   - Web scraping
 */

import { Template } from "e2b";

export const template = Template()
  .fromUbuntuImage("22.04")
  // System utilities
  .runCmd([
    "apt-get update",
    "DEBIAN_FRONTEND=noninteractive apt-get install -y " +
      "build-essential curl git wget " +
      "util-linux sudo ca-certificates " +
      "vim nano less " +
      "python3-pip python3-venv python3-dev " +
      "libpq-dev libssl-dev libffi-dev " +
      "graphviz",
    "apt-get clean",
    "rm -rf /var/lib/apt/lists/*",
  ])
  // Install Python data science stack
  .runCmd([
    "pip3 install --no-cache-dir " +
      "numpy pandas matplotlib seaborn plotly " +
      "scipy scikit-learn " +
      "jupyter ipython ipykernel " +
      "requests httpx beautifulsoup4 lxml " +
      "python-dotenv pydantic " +
      "pillow opencv-python-headless " +
      "sympy statsmodels " +
      "openpyxl xlrd",
  ])
  // Set up Jupyter kernel
  .runCmd("python3 -m ipykernel install --user --name python3")
  // Set working directory
  .runCmd("mkdir -p /home/user && chown -R 1000:1000 /home/user")
  .setStartCmd("tail -f /dev/null");
