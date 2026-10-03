export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Image upload failed");
  }

  return result.cid;
}

export async function uploadDocument(file, type) {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("type", type);

  const response = await fetch("/api/upload-document", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Document upload failed");
  }

  return result;
}

export async function uploadAllDocuments(documentFiles) {
  const results = [];
  for (const { file, type } of documentFiles) {
    results.push(await uploadDocument(file, type));
  }
  return results;
}

export async function createPropertyMetadata({ name, description, attributes, imageFile, documentFiles }) {
  const imageCid = await uploadImage(imageFile);
  const documents = await uploadAllDocuments(documentFiles || []);

  const metadata = {
    name,
    description,
    image: imageCid,
    attributes,
    documents,
  };

  const response = await fetch("/api/upload-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Metadata upload failed");
  }

  return result.tokenURI;
}
