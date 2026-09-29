const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow", () => {
  let realEstate, escrow;
  let seller, buyer, inspector, lender;
  const tokenId = 1;
  const purchasePrice = ethers.parseEther("10");
  const escrowAmount = ethers.parseEther("2");

  beforeEach(async () => {
    [seller, buyer, inspector, lender] = await ethers.getSigners();

    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();
    await realEstate.connect(seller).mint("https://example.com/1.json");

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
