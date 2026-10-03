export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const metadata = req.body;
    const requiredFields = ["name", "description", "image", "attributes"];

    for (const field of requiredFields) {
      if (!metadata[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    if (!metadata.image.startsWith("ipfs://")) {
      return res.status(400).json({ error: "image must be an ipfs:// URI" });
    }

    if (metadata.documents) {
      for (const doc of metadata.documents) {
        if (!doc.cid?.startsWith("ipfs://")) {
          return res.status(400).json({ error: `Document "${doc.type}" has an invalid cid` });
        }
      }
    }

    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return res.status(503).json({ error: "PINATA_JWT is not configured." });
    }

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataMetadata: { name: metadata.name },
        pinataContent: metadata,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.IpfsHash) {
      throw new Error("Pinata could not upload the property metadata.");
    }

    return res.status(200).json({ tokenURI: `ipfs://${result.IpfsHash}` });
  } catch (error) {
    console.error("Metadata upload failed:", error);
    return res.status(500).json({ error: error.message || "Upload failed" });
  }
}
