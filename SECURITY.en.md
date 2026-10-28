<p align="right">
  <a href="SECURITY.md">简体中文</a> · <strong>English</strong>
</p>

# Security Policy

Do not disclose unpatched security vulnerabilities, credentials, tokens, or
directly exploitable details in public issues, pull requests, discussions, or
chat.

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository ("Report a
vulnerability" on the repository's Security tab).

<!-- owner: enable on GitHub -->

If reproduction materials contain sensitive information, say so in the report
and wait for the maintainer to provide an appropriate secure transfer method.
Do not send sensitive materials through a public channel.

## What to include

Please provide as much of the following as possible:

- affected version, commit, or distribution channel;
- affected platform, component, and configuration;
- reproduction steps, a minimal PoC, or logs, after removing credentials and
  personal data;
- potential impact, exploitation requirements, and any suggested mitigation.

## Response process

We will acknowledge the report, reproduce it, assess its impact, and update the
report when a fix or mitigation can be disclosed. The maintainer answers on a
best-effort basis. Confirmed vulnerabilities follow a **90-day coordinated
disclosure window** (adjustable in coordination with the reporter). If you hear
nothing for more than 7 days, please add a comment to the report.

<!-- owner: confirm -->

## Contributor notes

- Do not put real user data, access tokens, private keys, or internal endpoints
  in issues, test fixtures, or commits.
- If you accidentally commit sensitive information, report it privately
  immediately. Deleting the file from the working tree does not invalidate
  secrets that may exist in Git history.
- Use public issues for ordinary bugs, documentation problems, and feature
  requests. Do not use the security channel for those topics.
