import formidable from "formidable";
import { promises as fs } from "fs";

export const config = { api: { bodyParser: false } };

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

async function pinFile(file) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is not configured.");
  }

  const buffer = await fs.readFile(file.filepath);
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: file.mimetype || "application/octet-stream" }), file.originalFilename || "document");
  formData.append("pinataMetadata", JSON.stringify({ name: file.originalFilename || "property-document" }));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok || !result.IpfsHash) {
    throw new Error("Pinata could not upload the document.");
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
    const [fields, files] = await form.parse(req);
    uploadedFile = Array.isArray(files.document) ? files.document[0] : files.document;
    const docType = Array.isArray(fields.type) ? fields.type[0] : fields.type;

    if (!uploadedFile) {
      return res.status(400).json({ error: "No document file provided" });
    }
    if (!docType) {
      return res.status(400).json({ error: "Document type is required" });
    }
    if (!ALLOWED_TYPES.includes(uploadedFile.mimetype)) {
      return res.status(415).json({ error: `Unsupported file type: ${uploadedFile.mimetype}` });
    }

    const ipfsHash = await pinFile(uploadedFile);

    return res.status(200).json({ type: docType, cid: `ipfs://${ipfsHash}` });
  } catch (error) {
    console.error("Document upload failed:", error);
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
