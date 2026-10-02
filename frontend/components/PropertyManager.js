import { useEffect, useState } from "react";

const STATUS_NAMES = ["Pending review", "Verified", "Rejected", "Minted"];
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 2 * 1024 * 1024;

async function compressImage(file) {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 15 MB before compression.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.78, 0.62, 0.48]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= MAX_UPLOAD_IMAGE_BYTES) return blob;
    }
    throw new Error("Image could not be compressed below 2 MB. Choose a smaller image.");
  } finally {
    bitmap.close();
  }
}

function ipfsGatewayUrl(uri) {
  return uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
}

export default function PropertyManager({
  open,
  provider,
  realEstate,
  account,
  isSeller,
  isAdmin,
  isAuthenticated,
  onClose,
  onMinted,
  onListExisting,
}) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshSubmissions() {
    if (!realEstate || !account) return;
    setLoading(true);
    try {
      const count = Number(await realEstate.submissionCount());
      const accountAddress = account.toLowerCase();
      const nextSubmissions = [];
      for (let id = 1; id <= count; id++) {
        const submission = await realEstate.submissions(id);
        const sellerAddress = submission.seller;
        const status = Number(submission.status);
        const isOwnSubmission = sellerAddress.toLowerCase() === accountAddress;
        if (!isOwnSubmission && !(isAdmin && status === 0)) continue;
        nextSubmissions.push({
          id,
          seller: sellerAddress,
          metadataUri: submission.tokenURI,
          status,
        });
      }
      setSubmissions(nextSubmissions.reverse());
    } catch (loadError) {
      setError(loadError.shortMessage || loadError.message || "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refreshSubmissions();
  }, [open, realEstate, account, isAdmin]);

  async function submitProperty(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    try {
      if (!isSeller || !isAuthenticated) throw new Error("Sign in with the configured seller wallet first.");
      const formData = new FormData(form);
      const image = formData.get("image");
      if (!(image instanceof File) || image.size === 0) throw new Error("Choose a property image.");
      const compressedImage = await compressImage(image);
      formData.delete("image");
      formData.append("image", compressedImage, "property-image.webp");
      const response = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Metadata upload failed.");

      const signer = await provider.getSigner();
      const tx = await realEstate.connect(signer).submitProperty(result.metadataUri);
      const receipt = await tx.wait();
      const submittedEvent = receipt.logs
        .map((log) => {
          try {
            return realEstate.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((log) => log?.name === "PropertySubmitted");
      const submissionId = submittedEvent?.args.submissionId.toString();

      form.reset();
      setMessage(`Submitted${submissionId ? ` as #${submissionId}` : ""}. Awaiting admin review.`);
      await refreshSubmissions();
    } catch (submitError) {
      setError(submitError.shortMessage || submitError.message || "Could not submit the property.");
    } finally {
      setBusy(false);
    }
  }

  async function updateSubmission(submissionId, action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const signer = await provider.getSigner();
      const tx = await realEstate.connect(signer)[action](submissionId);
      await tx.wait();
      if (action === "mintVerifiedProperty") {
        setMessage(`Property #${submissionId} minted successfully.`);
        onMinted?.();
      } else {
        setMessage(`Property #${submissionId} ${action === "verifyProperty" ? "verified" : "rejected"}.`);
      }
      await refreshSubmissions();
    } catch (actionError) {
      setError(actionError.shortMessage || actionError.reason || actionError.message || "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="listing-picker property-manager">
      <section className="listing-picker__dialog property-manager__dialog" role="dialog" aria-modal="true" aria-labelledby="property-manager-title">
        <button className="home__close" type="button" aria-label="Close property manager" onClick={onClose}>×</button>
        <h2 id="property-manager-title">Property submissions</h2>

        {isSeller && (
          <form className="listing-form property-manager__form" onSubmit={submitProperty}>
            <h3>Submit a property</h3>
            {!isAuthenticated && <p className="status-note">Sign in with the seller wallet to submit.</p>}
            <label>Property name<input name="name" required maxLength="100" /></label>
            <label>Description<textarea name="description" required maxLength="2000" rows="3" /></label>
            <label>Location / address<input name="address" required maxLength="160" /></label>
            <label>
              Property type
              <select name="propertyType" required defaultValue="">
                <option value="" disabled>Select a type</option>
                <option>Apartment</option>
                <option>Condominium</option>
                <option>Single Family</option>
                <option>Townhouse</option>
                <option>Villa</option>
                <option>Land</option>
              </select>
            </label>
            <div className="listing-form__amounts property-manager__numbers">
              <label>Price (ETH)<input name="price" type="number" min="0.000000000000000001" step="any" required /></label>
              <label>Bedrooms<input name="bedrooms" type="number" min="1" max="100" step="1" required /></label>
              <label>Bathrooms<input name="bathrooms" type="number" min="1" max="100" step="1" required /></label>
              <label>Square feet<input name="squareFeet" type="number" min="1" max="1000000" step="1" required /></label>
              <label>Year built<input name="yearBuilt" type="number" min="1700" step="1" required /></label>
            </div>
            <label>
              Property image
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
            </label>
            <p className="status-note">Images are compressed to WebP and limited to 2 MB. Property data on IPFS is public.</p>
            <button className="home__buy" type="submit" disabled={busy || !isAuthenticated}>
              {busy ? "Uploading and submitting..." : "Upload and submit for review"}
            </button>
            {onListExisting && <button className="property-manager__secondary" type="button" onClick={onListExisting}>List an owned NFT</button>}
          </form>
        )}

        <section className="property-manager__queue" aria-labelledby="property-queue-title">
          <div className="property-manager__queue-heading">
            <h3 id="property-queue-title">{isAdmin ? "Review queue" : "Your submissions"}</h3>
            <button type="button" onClick={refreshSubmissions} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
          </div>
          {!isAuthenticated && <p className="status-note">Sign in with an authorized wallet to manage submissions.</p>}
          {isAuthenticated && submissions.length === 0 && <p className="status-note">No submissions to show.</p>}
          <ul className="property-manager__list">
            {submissions.map((submission) => (
              <li className="property-manager__item" key={submission.id}>
                <div>
                  <strong>Submission #{submission.id}</strong>
                  <span>{STATUS_NAMES[submission.status] || "Unknown status"}</span>
                  <small>Seller: {submission.seller.slice(0, 6)}...{submission.seller.slice(-4)}</small>
                  <a href={ipfsGatewayUrl(submission.metadataUri)} target="_blank" rel="noreferrer">View metadata</a>
                </div>
                <div className="property-manager__actions">
                  {isAdmin && submission.status === 0 && (
                    <>
                      <button type="button" disabled={busy} onClick={() => updateSubmission(submission.id, "verifyProperty")}>Verify</button>
                      <button type="button" disabled={busy} onClick={() => updateSubmission(submission.id, "rejectProperty")}>Reject</button>
                    </>
                  )}
                  {isSeller && submission.seller.toLowerCase() === account?.toLowerCase() && submission.status === 1 && (
                    <button type="button" disabled={busy} onClick={() => updateSubmission(submission.id, "mintVerifiedProperty")}>Mint NFT</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {message && <p className="property-manager__message" role="status">{message}</p>}
        {error && <p className="listing-form__error" role="alert">{error}</p>}
      </section>
    </div>
  );
}