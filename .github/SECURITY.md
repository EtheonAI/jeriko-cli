# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Jeriko seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: security@jeriko.dev

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Preferred Languages

We prefer all communications to be in English.

### Disclosure Policy

- We will confirm receipt of your vulnerability report within 48 hours
- We will provide an estimated time frame for addressing the vulnerability
- We will notify you when the vulnerability is fixed
- We request that you do not disclose the vulnerability publicly until we have had a chance to address it

### Safe Harbor

We consider security research conducted in good faith to be authorized in advance. We will not initiate legal action against researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or have explicit permission to access
- Do not exploit vulnerabilities beyond the minimum necessary to demonstrate the issue
- Report vulnerabilities in a timely manner

## Security Best Practices

When contributing to this project, please follow these security best practices:

1. **Never commit secrets** - Use environment variables for sensitive data
2. **Validate all input** - Use the validation utilities provided
3. **Sanitize output** - Use the security utilities for XSS prevention
4. **Use parameterized queries** - Never concatenate user input into SQL
5. **Keep dependencies updated** - Regularly run `pnpm bump-deps`
6. **Follow the principle of least privilege** - Request only necessary permissions
