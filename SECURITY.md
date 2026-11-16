# Security Policy

## Reporting a vulnerability

Please do not publish credentials, access tokens, personal data, database records, or a working exploit in a public issue or pull request.

If GitHub's **Private vulnerability reporting** feature is enabled for this repository, use it to send a report privately. Otherwise, contact the repository owner through a private channel available from the GitHub profile.

A useful report includes:

- A concise description of the issue and its potential impact
- The affected file, component, or workflow
- Reproduction steps or a minimal proof of concept, with real user data and secrets removed
- Any suggested mitigation

Please allow reasonable time for investigation and a fix before publicly disclosing the issue.

## Safe handling

- Never commit real API keys, service-role keys, passwords, access tokens, or production environment files.
- Treat database exports, logs, screenshots, and user records as potentially sensitive.
- Do not test vulnerabilities against other users' accounts or data.
- Use a separate development environment for security testing whenever possible.
