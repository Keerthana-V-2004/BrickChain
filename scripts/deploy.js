const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, seller, buyer, inspector, lender] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = hre.network.config.chainId || (await hre.ethers.provider.getNetwork()).chainId;

  console.log(`Deploying to network: ${network} (chainId ${chainId})`);
  console.log("Seller:", seller.address);

  // --- Deploy RealEstate NFT contract ---
  const RealEstate = await hre.ethers.getContractFactory("RealEstate");
  const realEstate = await RealEstate.deploy();
  await realEstate.waitForDeployment();
  const realEstateAddress = await realEstate.getAddress();
  console.log("RealEstate deployed to:", realEstateAddress);

  // --- Mint sample properties (metadata) ---
  // Use IPFS URLs for real deployments. When deploying locally, point to
  // the frontend's served metadata so the app can fetch token metadata.
    const propertyIds = [1, 2, 3, 4, 5, 6];
  let properties = [
      ...propertyIds.map((id) => `https://ipfs.io/ipfs/QmYourHashHere/${id}.json`),
  ];

  // If we're on a local Hardhat network, use the frontend's local metadata
  // files so the UI can load property cards without uploading to IPFS.
  // Allow overriding the frontend origin via environment variable `FRONTEND_ORIGIN`.
  // Default to the port currently used by the local Next.js app (3001 when 3000 is busy).
  if (network === 'localhost' || chainId === 31337) {
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
    properties = propertyIds.map((id) => `${frontendOrigin}/metadata/${id}.json`);
  }

  for (let i = 0; i < properties.length; i++) {
    const submitTx = await realEstate.connect(seller).submitProperty(properties[i]);
    await submitTx.wait();

    const submissionId = i + 1;
    const verifyTx = await realEstate.connect(deployer).verifyProperty(submissionId);
    await verifyTx.wait();

    const mintTx = await realEstate.connect(seller).mintVerifiedProperty(submissionId);
    await mintTx.wait();
  }
  console.log(`Minted ${properties.length} properties to seller`);

  // --- Deploy Escrow contract ---
  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(
    realEstateAddress,
    seller.address,
    inspector.address,
    lender.address
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Escrow deployed to:", escrowAddress);

  // --- Seller approves escrow to transfer each NFT ---
  for (let i = 0; i < properties.length; i++) {
    const tx = await realEstate.connect(seller).approve(escrowAddress, i + 1);
    await tx.wait();
  }
  console.log("Escrow approved to transfer all minted properties");

    for (let i = 0; i < 3; i++) {
      const metadataPath = path.join(__dirname, "..", "metadata", `${i + 1}.json`);
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      const purchasePrice = hre.ethers.parseEther(metadata.attributes[0].value);
      const earnestAmount = purchasePrice / 10n;
      const tx = await escrow.connect(seller).list(
        i + 1,
        buyer.address,
        purchasePrice,
        earnestAmount
      );
      await tx.wait();
    }
    console.log("Listed the first 3 properties for the demo buyer");

  // --- Write addresses + chainId to frontend/config.json ---
  const configPath = path.join(__dirname, "..", "frontend", "config.json");
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  config[chainId.toString()] = {
    realEstate: { address: realEstateAddress },
    escrow: { address: escrowAddress },
    accounts: {
      admin: deployer.address,
      seller: seller.address,
      buyer: buyer.address,
      inspector: inspector.address,
      lender: lender.address,
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Wrote addresses to ${configPath}`);

  console.log("\nDeployment finished. Roles for local testing:");
  console.log("  seller:   ", seller.address);
  console.log("  admin:    ", deployer.address);
  console.log("  buyer:    ", buyer.address);
  console.log("  inspector:", inspector.address);
  console.log("  lender:   ", lender.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
