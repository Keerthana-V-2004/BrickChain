import { useEffect, useState } from "react";
import { ethers } from "ethers";

import Navigation from "../components/Navigation";
import Search from "../components/Search";
import HomeModal from "../components/Home";

import RealEstateABI from "../abis/RealEstate.json";
import EscrowABI from "../abis/Escrow.json";
import config from "../config.json";
import { createSignInMessage } from "../lib/auth-message";

export default function HomePage() {
  const [provider, setProvider] = useState(null);
  const [escrow, setEscrow] = useState(null);
  const [account, setAccount] = useState(null);

  const [homes, setHomes] = useState([]);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [listingFilter, setListingFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [bedroomFilter, setBedroomFilter] = useState("all");
  const [selectedHome, setSelectedHome] = useState(null);
  const [toggle, setToggle] = useState(false);
  const [showListingPicker, setShowListingPicker] = useState(false);
  const [sellerHomes, setSellerHomes] = useState([]);
  const [realEstate, setRealEstate] = useState(null);
  const [defaultBuyer, setDefaultBuyer] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [theme, setTheme] = useState("light");
  const [authenticatedAddress, setAuthenticatedAddress] = useState("");
  const [authenticatedChainId, setAuthenticatedChainId] = useState(null);
  const [walletChainId, setWalletChainId] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    loadBlockchainData();
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        setAccount(accounts[0] ? ethers.getAddress(accounts[0]) : null);
        loadBlockchainData();
      };
      const handleChainChanged = () => loadBlockchainData();

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        if (active) {
          setAuthenticatedAddress(session.authenticated ? session.address : "");
          setAuthenticatedChainId(session.authenticated ? session.chainId : null);
        }
      })
      .catch(() => {
        if (active) {
          setAuthenticatedAddress("");
          setAuthenticatedChainId(null);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("estatehub-theme");
    const preferredTheme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.dataset.theme = preferredTheme;
    setTheme(preferredTheme);
  }, []);

  async function loadBlockchainData() {
    let walletProvider = null;
    let walletChainId = null;

    if (window.ethereum) {
      walletProvider = new ethers.BrowserProvider(window.ethereum);
      walletChainId = (await walletProvider.getNetwork()).chainId.toString();
    }

    const localConfig = config["31337"];
    setWalletChainId(walletChainId || (localConfig ? "31337" : ""));
    const useWalletProvider = Boolean(walletChainId && config[walletChainId]);
    const networkConfig = useWalletProvider ? config[walletChainId] : localConfig;
    const readProvider = useWalletProvider
      ? walletProvider
      : localConfig
        ? new ethers.JsonRpcProvider("http://127.0.0.1:8545")
        : null;

    setProvider(useWalletProvider ? walletProvider : null);

    if (!networkConfig || !networkConfig.realEstate?.address || !readProvider) {
      console.warn(
        `No contract addresses found for chainId ${walletChainId || "unknown"}. ` +
        `Run the deploy script and check frontend/config.json.`
      );
      return;
    }

    const realEstate = new ethers.Contract(
      networkConfig.realEstate.address,
      RealEstateABI.abi,
      readProvider
    );
    const escrow = new ethers.Contract(
      networkConfig.escrow.address,
      EscrowABI.abi,
      readProvider
    );
    setRealEstate(realEstate);
    setEscrow(escrow);
    setDefaultBuyer(networkConfig.accounts?.buyer || "");
    setSellerAddress(await escrow.seller());

    const totalSupply = await realEstate.totalSupply();
    const homesList = [];
    for (let i = 1; i <= Number(totalSupply); i++) {
      const uri = await realEstate.tokenURI(i);
      const metadataUrl = new URL(uri, window.location.origin);
      if (
        ["localhost", "127.0.0.1"].includes(metadataUrl.hostname) &&
        metadataUrl.pathname.startsWith("/metadata/")
      ) {
        metadataUrl.host = window.location.host;
      }
      const response = await fetch(metadataUrl);
      if (!response.ok) throw new Error(`Could not load metadata for property ${i}.`);
      const metadata = await response.json();
      const isListed = await escrow.isListed(i);
      homesList.push({ id: i, isListed, ...metadata });
    }
    setHomes(homesList);
  }

  const propertyTypes = [...new Set(
    homes.map((home) => home.attributes?.[1]?.value).filter(Boolean)
  )];

  const visibleHomes = homes.filter((home) => {
    const term = filter.toLowerCase();
    const price = Number(home.attributes?.[0]?.value);
    const bedrooms = Number(home.attributes?.[2]?.value);
    const matchesPrice =
      priceFilter === "all" ||
      (priceFilter === "under-400" && price < 400) ||
      (priceFilter === "400-600" && price >= 400 && price <= 600) ||
      (priceFilter === "over-600" && price > 600);
    return (
      (home.name?.toLowerCase().includes(term) ||
        home.address?.toLowerCase().includes(term)) &&
      (typeFilter === "all" || home.attributes?.[1]?.value === typeFilter) &&
      (listingFilter === "all" ||
        (listingFilter === "listed" ? home.isListed : !home.isListed)) &&
      matchesPrice &&
      (bedroomFilter === "all" || bedrooms >= Number(bedroomFilter))
    );
  });

  async function openListingPicker() {
    const candidates = homes.filter((home) => !home.isListed);
    const owners = await Promise.all(
      candidates.map((home) => realEstate.ownerOf(home.id))
    );
    setSellerHomes(
      candidates.filter(
        (_, index) => owners[index].toLowerCase() === sellerAddress.toLowerCase()
      )
    );
    setShowListingPicker(true);
  }

  function togglePop(home) {
    setSelectedHome(home);
    setToggle(!toggle);
  }

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("estatehub-theme", nextTheme);
  }

  async function signInWithWallet() {
    setAuthBusy(true);
    setAuthError("");
    try {
      if (!window.ethereum) throw new Error("Install a wallet to sign in.");
      const walletProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await walletProvider.getSigner();
      const address = await signer.getAddress();
      const chainId = Number((await walletProvider.getNetwork()).chainId);
      const challengeResponse = await fetch("/api/auth/nonce", { cache: "no-store" });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challenge.error || "Could not start sign-in.");

      const message = createSignInMessage({
        domain: challenge.domain,
        address,
        uri: challenge.uri,
        chainId,
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        expirationTime: challenge.expirationTime,
      });
      const signature = await signer.signMessage(message);
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          chainId,
          issuedAt: challenge.issuedAt,
          expirationTime: challenge.expirationTime,
          signature,
        }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(result.error || "Wallet sign-in failed.");
      setAccount(result.address);
      setAuthenticatedAddress(result.address);
      setAuthenticatedChainId(chainId);
      setWalletChainId(String(chainId));
    } catch (error) {
      setAuthError(error.shortMessage || error.message || "Wallet sign-in failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticatedAddress("");
    setAuthenticatedChainId(null);
    setAuthError("");
  }

  const isAuthenticated = Boolean(
    account && authenticatedAddress &&
    account.toLowerCase() === authenticatedAddress.toLowerCase() &&
    Number(walletChainId) === authenticatedChainId
  );

  return (
    <div>
      <Navigation
        account={account}
        setAccount={setAccount}
        onConnected={loadBlockchainData}
        isSeller={account?.toLowerCase() === sellerAddress.toLowerCase() && isAuthenticated}
        canListProperty={homes.some((home) => !home.isListed)}
        onListProperty={openListingPicker}
        isAuthenticated={isAuthenticated}
        authBusy={authBusy}
        authError={authError}
        onSignIn={signInWithWallet}
        onSignOut={signOut}
        theme={theme}
        onThemeChange={changeTheme}
      />
      <Search
        homes={homes}
        onSearch={setFilter}
        propertyTypes={propertyTypes}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        listingFilter={listingFilter}
        onListingFilter={setListingFilter}
        priceFilter={priceFilter}
        onPriceFilter={setPriceFilter}
        bedroomFilter={bedroomFilter}
        onBedroomFilter={setBedroomFilter}
        onSearchSubmit={() => document.getElementById("properties")?.scrollIntoView({ behavior: "smooth" })}
      />

      <section className="cards__section" id="properties">
        <div className="cards__heading">
          <div>
            <p className="section-eyebrow">ESTATEHUB COLLECTION</p>
            <h3>Explore properties</h3>
          </div>
          <p className="properties-count">{visibleHomes.length} properties</p>
        </div>
        {homes.length === 0 && (
          <p className="status-note">
            No properties loaded yet — deploy the contracts and update frontend/config.json,
            or make sure MetaMask is connected to the right network.
          </p>
        )}
        {homes.length > 0 && visibleHomes.length === 0 && (
          <p className="status-note">No homes match these filters.</p>
        )}
        <ul className="cards">
          {visibleHomes.map((home) => (
            <li className="card" key={home.id}>
              <div className="card__media">
                <img
                  src={home.image}
                  alt={home.name}
                  loading="lazy"
                  onLoad={(event) => { event.currentTarget.dataset.loaded = "true"; }}
                  onError={(event) => { event.currentTarget.dataset.error = "true"; }}
                />
                <span className="card__shimmer" aria-hidden="true" />
                <span className={home.isListed ? "card__status" : "card__status card__status--quiet"}>
                  {home.isListed ? "For sale" : "Not listed"}
                </span>
              </div>
              <div className="card__info">
                <h4 className="card__title">{home.name}</h4>
                <p className="card__location">{home.address}</p>
                <p className="card__price">{home.attributes?.[0]?.value} ETH</p>
                <div className="card__stats">
                  <span>{home.attributes?.[2]?.value} beds</span>
                  <span>{home.attributes?.[3]?.value} baths</span>
                  <span>{Number(home.attributes?.[4]?.value).toLocaleString()} sqft</span>
                </div>
                <button className="card__view" type="button" onClick={() => togglePop(home)}>
                  View Property <span aria-hidden="true">→</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="about" id="about">
        <div className="about__inner">
          <p className="about__eyebrow">ABOUT ESTATEHUB</p>
          <div className="about__intro">
            <h2>A clearer path from searching to owning.</h2>
            <p>
              EstateHub brings property discovery and wallet-backed sales into one considered marketplace.
              Explore real homes, compare the details that matter, and follow each sale through transparent escrow.
            </p>
          </div>
          <div className="about__principles">
            <div><strong>Explore</strong><span>Browse property details and imagery in one place.</span></div>
            <div><strong>Verify</strong><span>Seller access is signed by the owner’s wallet.</span></div>
            <div><strong>Transact</strong><span>Escrow coordinates the sale on the connected network.</span></div>
          </div>
        </div>
      </section>

      {showListingPicker && (
        <div className="listing-picker">
          <section className="listing-picker__dialog" role="dialog" aria-modal="true" aria-labelledby="listing-picker-title">
            <button
              className="home__close"
              type="button"
              aria-label="Close property picker"
              onClick={() => setShowListingPicker(false)}
            >
              ×
            </button>
            <h2 id="listing-picker-title">Choose a property to list</h2>
            {sellerHomes.length === 0 ? (
              <p className="status-note">There are no seller-owned properties available to list.</p>
            ) : (
              <ul className="listing-picker__list">
                {sellerHomes.map((home) => (
                  <li key={home.id}>
                    <button
                      className="listing-picker__option"
                      type="button"
                      onClick={() => {
                        setSelectedHome(home);
                        setToggle(true);
                        setShowListingPicker(false);
                      }}
                    >
                      <img src={home.image} alt="" />
                      <span className="listing-picker__details">
                        <strong>{home.name}</strong>
                        <span>{home.address}</span>
                      </span>
                      <span className="listing-picker__price">{home.attributes?.[0]?.value} ETH</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {toggle && selectedHome && (
        <HomeModal
          home={selectedHome}
          provider={provider}
          escrow={escrow}
          realEstate={realEstate}
          account={account}
          isAuthenticated={isAuthenticated}
          defaultBuyer={defaultBuyer}
          onUpdated={() => {
            setToggle(false);
            loadBlockchainData();
          }}
          togglePop={() => setToggle(false)}
        />
      )}
    </div>
  );
}
