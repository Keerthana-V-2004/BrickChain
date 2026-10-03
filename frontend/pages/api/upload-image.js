import formidable from "formidable";
import { promises as fs } from "fs";

export const config = { api: { bodyParser: false } };

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

async function pinFile(file) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is not configured.");
  }

  const buffer = await fs.readFile(file.filepath);
  const fileName = file.originalFilename || `property-${Date.now()}.webp`;
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: file.mimetype || "image/webp" }), fileName);
  formData.append("pinataMetadata", JSON.stringify({ name: fileName }));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok || !result.IpfsHash) {
    throw new Error("Pinata could not upload the property image.");
  }

  return result.IpfsHash;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let uploadedFile = null;

  try {
    const form = formidable({ maxFileSize: MAX_SIZE_BYTES });
    const [, files] = await form.parse(req);
    uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;

    if (!uploadedFile) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const ipfsHash = await pinFile(uploadedFile);

    return res.status(200).json({ cid: `ipfs://${ipfsHash}` });
  } catch (error) {
    console.error("Image upload failed:", error);
    const message = error.message || "Upload failed";
    if (message.includes("PINATA_JWT")) {
      return res.status(503).json({ error: message });
    }
    return res.status(500).json({ error: message });
  } finally {
    if (uploadedFile?.filepath) {
      await fs.unlink(uploadedFile.filepath).catch(() => {});
    }
  }
}
