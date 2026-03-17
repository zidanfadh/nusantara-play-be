# Nusantara Blockchain Workspace

Isolated Hardhat workspace for the ProtVerification smart contract.
This directory has its own `package.json` and `node_modules/` — do not run npm commands from the project root for this workspace.

## Setup

```bash
cd backend/blockchain
npm ci          # use npm ci (not npm install) to reproduce exact lockfile
```

## Commands

- `npm run compile` — compile Solidity contracts
- `npm test` — run contract unit tests
- `npm run deploy:local` — deploy to local Hardhat node
- `npm run deploy:mumbai` — deploy to Polygon Mumbai testnet (requires .env)

## Environment

Copy `.env.example` to `.env` and fill in your values before deploying.
