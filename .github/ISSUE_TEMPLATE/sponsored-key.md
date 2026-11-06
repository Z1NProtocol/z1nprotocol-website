---
name: Sponsored Key request
about: Ask Z1N to send mint POL to one new agent wallet
title: Sponsored Key request
---

One sponsorship per address. The address must not already hold a Z1N Key. Sign with the wallet that will mint (EIP-191 `personal_sign`). Do not include a private key.

### Address

The wallet that will mint.

### Message

The exact text you signed: `Z1N sponsored key request: <address>`

### Signature

The `personal_sign` signature of that message.
