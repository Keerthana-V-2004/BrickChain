const GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const FALLBACK_GATEWAY = "https://ipfs.io/ipfs/";

export function resolveIpfsUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    return GATEWAY + uri.slice("ipfs://".length);
  }
  return uri;
}

function resolveLocalMetadataUri(uri) {
  if (typeof window === "undefined") return uri;

  try {
    const url = new URL(uri);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isLocalhost && url.pathname.startsWith("/metadata/")) {
      return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return uri;
  }

  return uri;
}

export async function fetchWithFallback(uri) {
  if (!uri) throw new Error("metadata fetch failed");

  const primary = resolveIpfsUri(resolveLocalMetadataUri(uri));
  try {
    const res = await fetch(primary, { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    if (!res.ok) throw new Error("primary gateway failed");
    return res;
  } catch {
    if (uri.startsWith("ipfs://")) {
      return fetch(FALLBACK_GATEWAY + uri.slice("ipfs://".length));
    }
    throw new Error("metadata fetch failed");
  }
}
