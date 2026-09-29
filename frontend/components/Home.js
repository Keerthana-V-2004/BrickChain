import { useEffect, useState } from "react";
import { ethers } from "ethers";

export default function Home({
  home,
  provider,
  escrow,
  realEstate,
  account,
  isAuthenticated,
  defaultBuyer,
  onUpdated,
  togglePop,
}) {
  const [hasBought, setHasBought] = useState(false);
  const [hasLended, setHasLended] = useState(false);
  const [hasInspected, setHasInspected] = useState(false);
  const [hasSold, setHasSold] = useState(false);

  const [buyer, setBuyer] = useState(null);
  const [lender, setLender] = useState(null);
  const [inspector, setInspector] = useState(null);
  const [seller, setSeller] = useState(null);

  const [owner, setOwner] = useState(null);
  const [listBuyer, setListBuyer] = useState(defaultBuyer || "");
  const [listPrice, setListPrice] = useState(home.attributes?.[0]?.value || "");
  const [listDeposit, setListDeposit] = useState(
    String(Number(home.attributes?.[0]?.value || 0) / 10)
  );
  const [listingBusy, setListingBusy] = useState(false);
  const [listingError, setListingError] = useState("");

  useEffect(() => {
    fetchDetails();
    fetchOwner();
  }, [home, escrow, realEstate]);

  async function fetchDetails() {
    if (!escrow) return;
    const sellerAddress = await escrow.seller();
    setSeller(sellerAddress);

    if (!home.isListed) {
      setBuyer(null);
      setHasBought(false);
      setHasLended(false);
      setHasInspected(false);
      setHasSold(false);
      return;
    }

    const buyerAddress = await escrow.buyer(home.id);
    setBuyer(buyerAddress);
    setHasBought(await escrow.approval(home.id, buyerAddress));

    setHasSold(await escrow.approval(home.id, sellerAddress));

    const lenderAddress = await escrow.lender();
    setLender(lenderAddress);
    setHasLended(await escrow.approval(home.id, lenderAddress));

    const inspectorAddress = await escrow.inspector();
    setInspector(inspectorAddress);
    setHasInspected(await escrow.inspectionPassed(home.id));
  }

  async function fetchOwner() {
    if (!realEstate || home.isListed) {
      setOwner(null);
      return;
    }
    setOwner(await realEstate.ownerOf(home.id));
  }

  async function listHandler(event) {
    event.preventDefault();
    setListingError("");
    setListingBusy(true);

    try {
      const buyerAddress = ethers.getAddress(listBuyer.trim());
      const purchasePrice = ethers.parseEther(listPrice);
      const earnestAmount = ethers.parseEther(listDeposit);
      if (purchasePrice <= 0n || earnestAmount <= 0n || earnestAmount >= purchasePrice) {
        throw new Error("Enter a deposit greater than zero and lower than the price.");
      }

      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const escrowAddress = await escrow.getAddress();
      const approvedAddress = await realEstate.getApproved(home.id);
      const isApproved =
        approvedAddress.toLowerCase() === escrowAddress.toLowerCase() ||
        await realEstate.isApprovedForAll(signerAddress, escrowAddress);

      if (!isApproved) {
        const approvalTx = await realEstate.connect(signer).approve(escrowAddress, home.id);
        await approvalTx.wait();
      }

      const listingTx = await escrow.connect(signer).list(
        home.id,
        buyerAddress,
        purchasePrice,
        earnestAmount
      );
      await listingTx.wait();
      onUpdated?.();
    } catch (error) {
      setListingError(error.shortMessage || error.reason || error.message);
    } finally {
      setListingBusy(false);
    }
  }

  async function buyHandler() {
    const escrowAmount = await escrow.escrowAmount(home.id);
    const signer = await provider.getSigner();

    let tx = await escrow.connect(signer).depositEarnest(home.id, { value: escrowAmount });
    await tx.wait();

    tx = await escrow.connect(signer).approveSale(home.id);
    await tx.wait();

    setHasBought(true);
  }

  async function inspectHandler() {
    const signer = await provider.getSigner();
    const tx = await escrow.connect(signer).updateInspectionStatus(home.id, true);
    await tx.wait();
    setHasInspected(true);
  }

  async function lendHandler() {
    const signer = await provider.getSigner();

    let tx = await escrow.connect(signer).approveSale(home.id);
    await tx.wait();

    const purchasePrice = await escrow.purchasePrice(home.id);
    const escrowAmount = await escrow.escrowAmount(home.id);
    const lendAmount = purchasePrice - escrowAmount;

    await signer.sendTransaction({
      to: await escrow.getAddress(),
      value: lendAmount.toString(),
      gasLimit: 60000,
    });

    setHasLended(true);
  }

  async function sellHandler() {
    const signer = await provider.getSigner();

    let tx = await escrow.connect(signer).approveSale(home.id);
    await tx.wait();

    tx = await escrow.connect(signer).finalizeSale(home.id);
    await tx.wait();

    setHasSold(true);
  }

  return (
    <div className="home">
      <div className="home__details">
        <button className="home__close" onClick={togglePop}>✕</button>
        <div className="home__gallery">
          <img className="home__image" src={home.image} alt={home.name} />
        </div>
        <div className="home__content">
          <h2>{home.name}</h2>
          <p className="home__price">
            {ethers.formatEther(home.attributes[0].value.toString())
              ? `${home.attributes[0].value} ETH`
              : ""}
          </p>
          <p className="home__address">{home.address}</p>

        <div className="home__overview">
          <h3>Overview</h3>
          <ul>
            <li>{home.attributes[2].value} beds</li>
            <li>{home.attributes[3].value} baths</li>
            <li>{home.attributes[4].value} sqft</li>
            <li>Built {home.attributes[5].value}</li>
          </ul>
        </div>

        <div className="home__description">
          <h3>Description</h3>
          <p>{home.description}</p>
        </div>

        <div>
          {!home.isListed ? account?.toLowerCase() === seller?.toLowerCase() && provider && isAuthenticated ? (
            <form className="listing-form" onSubmit={listHandler}>
              <h3>List this property</h3>
              <label>
                Buyer wallet address
                <input
                  type="text"
                  required
                  value={listBuyer}
                  onChange={(event) => setListBuyer(event.target.value)}
                  placeholder="0x..."
                />
              </label>
              <div className="listing-form__amounts">
                <label>
                  Sale price (ETH)
                  <input
                    type="number"
                    min="0.000000000000000001"
                    step="any"
                    required
                    value={listPrice}
                    onChange={(event) => setListPrice(event.target.value)}
                  />
                </label>
                <label>
                  Deposit (ETH)
                  <input
                    type="number"
                    min="0.000000000000000001"
                    step="any"
                    required
                    value={listDeposit}
                    onChange={(event) => setListDeposit(event.target.value)}
                  />
                </label>
              </div>
              {listingError && <p className="listing-form__error" role="alert">{listingError}</p>}
              <button className="home__buy" type="submit" disabled={listingBusy}>
                {listingBusy ? "Confirming..." : "Approve & list"}
              </button>
            </form>
          ) : (
            <p className="status-note">
              Not listed{owner ? ` · Owned by ${owner.slice(0, 6)}...${owner.slice(38, 42)}` : ""}
              {!account || !provider ? " · Connect the seller wallet on the local network to list." : ""}
              {account?.toLowerCase() === seller?.toLowerCase() && !isAuthenticated ? " · Sign in to list this property." : ""}
            </p>
          ) : owner ? (
            <p className="status-note">Owned by {owner.slice(0, 6)}...{owner.slice(38, 42)}</p>
          ) : !account || !provider ? (
            <p className="status-note">Connect your wallet to the local network to take action.</p>
          ) : (
            <>
              {account === inspector ? (
                <button className="home__buy" onClick={inspectHandler} disabled={hasInspected}>
                  {hasInspected ? "Inspection Approved" : "Approve Inspection"}
                </button>
              ) : account === lender ? (
                <button className="home__buy" onClick={lendHandler} disabled={hasLended}>
                  {hasLended ? "Funds Sent" : "Approve & Lend"}
                </button>
              ) : account === seller ? (
                <button className="home__buy" onClick={sellHandler} disabled={hasSold}>
                  {hasSold ? "Sale Finalized" : "Approve & Sell"}
                </button>
              ) : (
                <button className="home__buy" onClick={buyHandler} disabled={hasBought}>
                  {hasBought ? "Deposit Made" : "Buy"}
                </button>
              )}
              <p className="status-note">
                Inspection: {hasInspected ? "✅" : "pending"} · Lender: {hasLended ? "✅" : "pending"} · Seller: {hasSold ? "✅" : "pending"}
              </p>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
