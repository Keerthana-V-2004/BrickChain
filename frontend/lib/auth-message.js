export function createSignInMessage({
  domain,
  address,
  uri,
  chainId,
  nonce,
  issuedAt,
  expirationTime,
}) {
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n` +
    `Sign in to EstateHub to manage seller listings.\n\n` +
    `URI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\n` +
    `Issued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;
}