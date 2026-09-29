# EstateHub dApp

A full-stack decentralized app for listing and buying real estate as NFTs,
with an on-chain escrow that coordinates buyer, seller, inspector, and lender.

- **Solidity** — `RealEstate.sol` (ERC-721 property NFTs) + `Escrow.sol` (sale workflow)
- **Hardhat** — compile, test, deploy
- **Next.js + ethers.js** — frontend
- **MetaMask** — wallet connection & transaction signing
- Deployable to **any EVM chain** (local Hardhat network, Ethereum testnets, Polygon, BNB Chain, etc.)

## Project structure

```
real-estate-dapp/
├── contracts/
│   ├── RealEstate.sol      # ERC-721 property NFT
│   └── Escrow.sol          # buyer/seller/inspector/lender escrow logic
├── scripts/deploy.js        # mints sample properties, deploys Escrow, writes config
├── test/Escrow.js           # Hardhat/Chai test suite
├── metadata/*.json          # sample NFT metadata (upload to IPFS, e.g. via Pinata)
├── hardhat.config.js
└── frontend/                # Next.js app
    ├── pages/index.js
    ├── components/{Navigation,Search,Home}.js
    ├── abis/                # put compiled ABIs here (see abis/README.md)
    └── config.json          # contract addresses per chainId (auto-filled by deploy.js)
```

## 1. Install dependencies

```bash
# backend (contracts)
npm install

# frontend
cd frontend && npm install && cd ..
```

## 2. Compile & test the contracts

```bash
npx hardhat compile
npx hardhat test
```

After compiling, copy the ABIs into the frontend (see `frontend/abis/README.md`):

```bash
cp artifacts/contracts/RealEstate.sol/RealEstate.json frontend/abis/
cp artifacts/contracts/Escrow.sol/Escrow.json frontend/abis/
```

## 3. Run locally

Terminal 1 — start a local blockchain:
```bash
npx hardhat node
```

Terminal 2 — deploy contracts (mints 6 sample properties, lists the first 3,
and writes addresses into `frontend/config.json` automatically):
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Terminal 3 — start the frontend:
```bash
cd frontend
npm run dev
```

Then in MetaMask:
1. Add a network: RPC URL `http://127.0.0.1:8545`, Chain ID `31337`.
2. Import one of the private keys Hardhat prints when you start `hardhat node`
   (the first account is the seller who owns the minted properties).
3. Open `http://localhost:3000` and click **Connect Wallet**.

Seller listing access uses a wallet signature challenge and an eight-hour
HttpOnly session cookie. Copy `frontend/.env.example` to `frontend/.env.local`
and set `SESSION_SECRET` to a unique random value of at least 32 characters
before production deployment. Set server-only `SITE_URL` to the exact public
origin. No password or personal identity data is collected; property ownership
and transactions recorded on-chain are public.

## 4. Deploy to any blockchain

`hardhat.config.js` already includes network entries for Sepolia, Polygon,
Polygon Amoy, and BNB Chain — add more the same way. To deploy to one:

1. Copy `.env.example` to `.env` and fill in an RPC URL (e.g. from Alchemy or
   Infura) and a funded wallet's private key for that chain.
2. Run:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   # or: --network polygon / --network bsc / etc.
   ```
3. `frontend/config.json` will get a new entry keyed by that chain's ID —
   the frontend automatically picks the right addresses based on whichever
   network MetaMask is connected to.
4. Have MetaMask switch to that network and reload the app.

To add a brand-new chain (e.g. Avalanche, Arbitrum, Base): add a `networks`
entry in `hardhat.config.js` with its RPC URL and chain ID, add the matching
env vars to `.env`, then deploy the same way.

## 5. Property metadata & images

The sample metadata in `metadata/*.json` follows the OpenSea-style schema.
Upload your property photos and these JSON files to IPFS (e.g. via
[Pinata](https://pinata.cloud) or [nft.storage](https://nft.storage)), then
update the `properties` array in `scripts/deploy.js` with your own IPFS URIs
before minting.

## How the sale flow works (Escrow.sol)

1. **Seller** lists a property (`list`) — the NFT moves into the Escrow contract.
2. **Buyer** deposits earnest money (`depositEarnest`) and approves the sale.
3. **Inspector** marks the inspection result (`updateInspectionStatus`).
4. **Lender** sends the remaining funds and approves the sale.
5. **Seller** approves and calls `finalizeSale` — funds go to the seller, the
   NFT transfers to the buyer, atomically.
6. If inspection fails, either party can call `cancelSale` to refund the buyer.

The frontend's property modal (`components/Home.js`) shows the right button
for whichever role the connected MetaMask account belongs to (buyer, seller,
inspector, or lender).
