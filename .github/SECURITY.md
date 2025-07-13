# Security Policy

## Project Status

**⚠️ Alpha Software:** This project is in early alpha development. Use at your own risk and avoid storing sensitive data.

## Reporting Security Issues

For security vulnerabilities, please **do not** open public GitHub issues.

**Preferred method:** Open a [GitHub Security Advisory](https://github.com/[username]/eddoapp/security/advisories/new) or email the maintainer.

**Response time:** Best effort, typically within a week for high-severity issues.

## Current Security Measures

This project includes automated security scanning:
- Dependency vulnerability detection
- Secrets scanning  
- License compliance checking
- Static code analysis

## Security Considerations for Alpha Software

**Data Safety:** 
- Avoid storing production or sensitive data
- Local PouchDB storage is unencrypted by default
- Telegram bot tokens should be kept secure

**Deployment:**
- Intended for development/testing only
- No production deployment security has been implemented
- Database connections use basic authentication

---

*This security policy will be expanded as the project matures toward production readiness.*