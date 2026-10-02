const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow", () => {
  let realEstate, escrow;
  let admin, seller, buyer, inspector, lender;
  const tokenId = 1;
  const purchasePrice = ethers.parseEther("10");
  const escrowAmount = ethers.parseEther("2");

  beforeEach(async () => {
    [admin, seller, buyer, inspector, lender] = await ethers.getSigners();

    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();
    await realEstate.connect(seller).submitProperty("https://example.com/1.json");
    await realEstate.connect(admin).verifyProperty(1);
    await realEstate.connect(seller).mintVerifiedProperty(1);

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(
      await realEstate.getAddress(),
      seller.address,
      inspector.address,
      lender.address
    );

    await realEstate.connect(seller).approve(await escrow.getAddress(), tokenId);
    await escrow.connect(seller).list(tokenId, buyer.address, purchasePrice, escrowAmount);
  });

  it("lists the property and transfers the NFT into escrow", async () => {
    expect(await realEstate.ownerOf(tokenId)).to.equal(await escrow.getAddress());
    expect(await escrow.isListed(tokenId)).to.equal(true);
  });

  it("accepts the buyer's earnest deposit", async () => {
    await escrow.connect(buyer).depositEarnest(tokenId, { value: escrowAmount });
    expect(await escrow.getBalance()).to.equal(escrowAmount);
  });

  it("records the inspection result", async () => {
    await escrow.connect(inspector).updateInspectionStatus(tokenId, true);
    expect(await escrow.inspectionPassed(tokenId)).to.equal(true);
  });

  it("finalizes the sale once everyone has approved and funds are in", async () => {
    await escrow.connect(buyer).depositEarnest(tokenId, { value: escrowAmount });
    await escrow.connect(inspector).updateInspectionStatus(tokenId, true);
    await escrow.connect(buyer).approveSale(tokenId);
    await escrow.connect(seller).approveSale(tokenId);
    await escrow.connect(lender).approveSale(tokenId);

    const remaining = purchasePrice - escrowAmount;
    await lender.sendTransaction({ to: await escrow.getAddress(), value: remaining });

    await expect(escrow.connect(seller).finalizeSale(tokenId)).to.not.be.reverted;
    expect(await realEstate.ownerOf(tokenId)).to.equal(buyer.address);
  });

  it("refunds the buyer on cancel if inspection failed", async () => {
    await escrow.connect(buyer).depositEarnest(tokenId, { value: escrowAmount });
    await escrow.connect(inspector).updateInspectionStatus(tokenId, false);

    await expect(
      escrow.connect(seller).cancelSale(tokenId)
    ).to.changeEtherBalances([escrow, buyer], [-escrowAmount, escrowAmount]);
  });
});

describe("RealEstate verification workflow", () => {
  let realEstate;
  let admin, seller, buyer;

  beforeEach(async () => {
    [admin, seller, buyer] = await ethers.getSigners();
    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();
    await realEstate.connect(seller).submitProperty("https://example.com/pending.json");
  });

  it("prevents non-admins from verifying a submission", async () => {
    await expect(realEstate.connect(buyer).verifyProperty(1)).to.be.reverted;
  });

  it("prevents the seller from minting before verification", async () => {
    await expect(realEstate.connect(seller).mintVerifiedProperty(1)).to.be.revertedWith(
      "property not verified"
    );
    expect(await realEstate.totalSupply()).to.equal(0);
  });

  it("stores the IPFS metadata URI when a verified seller mints", async () => {
    const metadataUri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh3v2c4n7j2j4j4y3j4j4j4j4j4j4j4";
    await realEstate.connect(seller).submitProperty(metadataUri);
    await realEstate.connect(admin).verifyProperty(2);
    await realEstate.connect(seller).mintVerifiedProperty(2);

    expect(await realEstate.tokenURI(1)).to.equal(metadataUri);
    expect(await realEstate.ownerOf(1)).to.equal(seller.address);
  });
});
