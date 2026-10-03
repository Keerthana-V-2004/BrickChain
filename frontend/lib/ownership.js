export async function getOwnershipHistory(realEstate, tokenId) {
  if (!realEstate || tokenId === undefined || tokenId === null) return [];

  const filter = realEstate.filters.Transfer(null, null, tokenId);
  const events = await realEstate.queryFilter(filter, 0, "latest");

  const history = [];
  for (const event of events) {
    const block = await event.getBlock();
    history.push({
      from: event.args.from,
      to: event.args.to,
      timestamp: block.timestamp,
      txHash: event.transactionHash,
    });
  }

  return history;
}

export function labelAddress(address, accounts, escrowAddress) {
  if (!address) return "Unknown";
  if (address === "0x0000000000000000000000000000000000000000") return "— (minted)";
  if (escrowAddress && address.toLowerCase() === escrowAddress.toLowerCase()) return "Escrow Contract";
  if (accounts?.seller && address.toLowerCase() === accounts.seller.toLowerCase()) return "Seller";
  if (accounts?.buyer && address.toLowerCase() === accounts.buyer.toLowerCase()) return "Buyer";
  if (accounts?.admin && address.toLowerCase() === accounts.admin.toLowerCase()) return "Admin";
  if (accounts?.inspector && address.toLowerCase() === accounts.inspector.toLowerCase()) return "Inspector";
  if (accounts?.lender && address.toLowerCase() === accounts.lender.toLowerCase()) return "Lender";
  return `${address.slice(0, 6)}...${address.slice(38, 42)}`;
}
