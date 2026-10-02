import formidable from "formidable";
import { promises as fs } from "fs";
import { parseEther } from "ethers";
import networkConfig from "../../../config.json";
import {
  SESSION_COOKIE,
  getSiteOrigin,
  isSameOriginRequest,
  readSession,
} from "../../../lib/auth";

export const config = { api: { bodyParser: false } };

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function field(fields, name) {
  return Array.isArray(fields[name]) ? fields[name][0] : fields[name];
}

function requiredField(fields, name, maxLength) {
  const value = field(fields, name)?.trim();
  if (!value || value.length > maxLength) {
    throw new Error(`${name} is required and must be at most ${maxLength} characters.`);
  }
  return value;
}

function positiveInteger(value, name, maximum) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${name} is outside the allowed range.`);
  }
  return number;
}

async function pinJson(metadata, jwt) {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: { name: `${metadata.name} metadata` },
      pinataContent: metadata,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.IpfsHash) {
    throw new Error("Pinata could not upload the property metadata.");
  }
  return result.IpfsHash;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let uploadedFile;
  try {
    const origin = getSiteOrigin(req);
    if (!isSameOriginRequest(req, origin)) {
      return res.status(403).json({ error: "Upload request origin was not trusted." });
    }

    const session = readSession(req.cookies[SESSION_COOKIE]);
    const network = session && networkConfig[String(session.chainId)];
    const seller = network?.accounts?.seller;
    if (!session || !seller || session.address.toLowerCase() !== seller.toLowerCase()) {
      return res.status(403).json({ error: "Sign in with the configured seller wallet to upload." });
    }

    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return res.status(503).json({ error: "Set PINATA_JWT in the frontend server environment." });
    }

    const form = formidable({
      maxFiles: 1,
      maxFileSize: MAX_IMAGE_SIZE,
      maxTotalFileSize: MAX_IMAGE_SIZE,
      maxFields: 12,
      maxFieldsSize: 16 * 1024,
      filter: (part) => part.name === "image" && ALLOWED_IMAGE_TYPES.has(part.mimetype),
    });
    const [fields, files] = await form.parse(req);
    uploadedFile = Array.isArray(files.image) ? files.image[0] : files.image;
    if (!uploadedFile || !ALLOWED_IMAGE_TYPES.has(uploadedFile.mimetype)) {
      return res.status(400).json({ error: "Choose a JPEG, PNG, or WebP image under 2 MB." });
    }

    const name = requiredField(fields, "name", 100);
    const description = requiredField(fields, "description", 2000);
    const address = requiredField(fields, "address", 160);
    const propertyType = requiredField(fields, "propertyType", 60);
    const price = requiredField(fields, "price", 40);
    const priceWei = parseEther(price);
    if (priceWei <= 0n) throw new Error("Price must be greater than zero ETH.");

    const bedrooms = positiveInteger(field(fields, "bedrooms"), "Bedrooms", 100);
    const bathrooms = positiveInteger(field(fields, "bathrooms"), "Bathrooms", 100);
    const squareFeet = positiveInteger(field(fields, "squareFeet"), "Square feet", 1_000_000);
    const yearBuilt = positiveInteger(field(fields, "yearBuilt"), "Year built", new Date().getFullYear() + 5);
    if (yearBuilt < 1700) throw new Error("Year built must be 1700 or later.");

    const imageBytes = await fs.readFile(uploadedFile.filepath);
    const imageForm = new FormData();
    imageForm.append("file", new Blob([imageBytes], { type: uploadedFile.mimetype }), uploadedFile.originalFilename || "property-image");
    imageForm.append("pinataMetadata", JSON.stringify({ name: `${name} image` }));

    const imageResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: imageForm,
    });
    const imageResult = await imageResponse.json();
    if (!imageResponse.ok || !imageResult.IpfsHash) {
      throw new Error("Pinata could not upload the property image.");
    }

    const metadata = {
      name,
      description,
      address,
      image: `ipfs://${imageResult.IpfsHash}`,
      attributes: [
        { trait_type: "Purchase Price", value: price },
        { trait_type: "Type of Residence", value: propertyType },
        { trait_type: "Bed Rooms", value: bedrooms },
        { trait_type: "Bathrooms", value: bathrooms },
        { trait_type: "Square Feet", value: squareFeet },
        { trait_type: "Year Built", value: yearBuilt },
      ],
    };
    const metadataCid = await pinJson(metadata, jwt);
    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({ metadataUri: `ipfs://${metadataCid}` });
  } catch (error) {
    const message = error.message?.includes("maxFileSize")
      ? "Image must be smaller than 2 MB."
      : error.message || "Could not upload property metadata.";
    const status = message.startsWith("Pinata") ? 502 : 400;
    console.error("Property metadata upload failed:", message);
    return res.status(status).json({ error: message });
  } finally {
    if (uploadedFile?.filepath) await fs.unlink(uploadedFile.filepath).catch(() => {});
  }
}