# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported |
|---------|-----------|
| Latest  | ✅ Yes    |
| Previous| ✅ Yes    |
| Older   | ❌ No     |

## Reporting a Vulnerability

We take security seriously. If you believe you have found a security vulnerability, please report it responsibly.

### Do NOT
- Do not disclose the vulnerability publicly
- Do not attempt to exploit the vulnerability
- Do not access data beyond what is necessary to report

### Do
- Report the vulnerability privately
- Include a detailed description
- Provide steps to reproduce (if possible)
- Include your contact information

### How to Report

Send an email to: security@example.com

Or use GitHub's private vulnerability reporting:
1. Go to the repository
2. Click "Security" tab
3. Click "Report a vulnerability"

## Security Features

### Data Protection
- All financial data is encrypted at rest
- API communications use TLS 1.2+
- Passwords are hashed using bcrypt

### Multi-Tenancy
- PostgreSQL Row Level Security (RLS) policies enforce tenant isolation
- Application-level tenant context validation

### Authentication
- JWT-based authentication
- Session expiration
- Secure token storage

## Dependencies Security

We use the following tools to maintain dependency security:
- Trivy for container scanning
- npm audit for package vulnerabilities
- Dependabot for automated updates

## Compliance

This software follows security best practices for:
- OWASP Top 10
- PCI-DSS (for payment handling)
- GDPR (for data privacy)
