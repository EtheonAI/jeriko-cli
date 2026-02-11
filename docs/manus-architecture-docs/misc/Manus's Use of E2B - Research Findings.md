# Manus's Use of E2B - Research Findings

## Source
- **Primary Source**: E2B official blog post "How Manus Uses E2B to Provide Agents With Virtual Computers"
- **Date**: May 6, 2025
- **URL**: https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers
- **Quote from Tao Zhang (Co-founder at Manus)**: Direct confirmation of E2B usage

## What E2B Provides to Manus

### Core Infrastructure
- **Firecracker microVMs**: Ephemeral, lightweight virtual machines originally developed by AWS
- **Full virtual computers**: Not just code execution, but complete operating system environments
- **Self-hosted deployment**: Manus runs E2B on their own machines

### Key Capabilities
1. **Persistent sandbox sessions**: Can run for hours, with ability to pause and resume
2. **Data persistence**: For paid users, information can be saved in E2B sandbox for up to 14 days
3. **Multi-language support**: Python, JavaScript, Bash, and more
4. **Full OS functionality**: Can install apps, Python packages, etc.

### Tools Enabled by E2B
According to the blog post, Manus uses 27 different tools powered by E2B, including:
- **Browser automation**: Chromium browser to visit URLs, save images, scroll
- **Terminal access**: Execute shell commands
- **Filesystem operations**: Create, edit, delete files
- **Code execution**: Run Python, JavaScript, Bash scripts

### Technical Specifications
- **Spin-up speed**: ~150ms to start a new sandbox
- **Implementation time**: Manus deployed E2B in half a day
- **Scalability**: Each user gets a separate sandbox instance

## Why Manus Chose E2B

### Alternatives Considered
- **Docker**: Rejected because:
  - Too slow (10-20 seconds to spawn)
  - Lacks full OS functionality as a container solution
  - Cannot install apps or Python packages like a real OS

### Decision Factors
1. **Speed**: 150ms spin-up time
2. **Developer Experience**: Easy implementation
3. **Scalability**: Handles rapid user growth
4. **Self-hosting option**: Can run on their own infrastructure
5. **Future-proofing**: Plans to extend to Windows and Android environments

### Cost-Benefit
- Building this infrastructure themselves would have required 3-5 full-time infrastructure engineers
- Would have taken months of dedicated work
- E2B allowed Manus to focus on multi-agent orchestration instead

## Conclusion
**Manus absolutely uses E2B.** The entire sandbox environment—including shell access, file operations, browser automation, and code execution—runs on E2B's Firecracker microVM infrastructure. This is confirmed directly by Manus co-founder Tao Zhang and documented in E2B's official case study.
