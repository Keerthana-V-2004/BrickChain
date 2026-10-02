import config from "../config.json";

export default function Navigation({
  account,
  setAccount,
  onConnected,
  isSeller,
  isAdmin,
  canListProperty,
  onManageProperties,
  theme,
  onThemeChange,
  isAuthenticated,
  authBusy,
  authError,
  onSignIn,
  onSignOut,
}) {
  async function connectHandler() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Install it from metamask.io to continue.");
      return;
    }

    const configuredChainIds = Object.keys(config);
    if (configuredChainIds.length === 1) {
      const chainId = `0x${Number(configuredChainIds[0]).toString(16)}`;
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
    onConnected?.();
  }

  return (
    <nav className="nav">
      <div className="nav__brand">
        <img className="nav__icon" src="/property-mark.svg" alt="" />
        <h1>
          <span>Estate</span><span className="nav__brand-accent">Hub</span>
          <span className="nav__brand-suffix"> dApp</span>
        </h1>
      </div>
      <div className="nav__links">
        <a href="#property-search">Buy</a>
        <a href="#properties">Properties</a>
        <a href="#about">About</a>
      </div>
      <div className="nav__actions">
        <button
          className={theme === "dark" ? "theme-toggle is-dark" : "theme-toggle"}
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-pressed={theme === "dark"}
          onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <span>{theme === "dark" ? "Dark" : "Light"}</span>
          <span className="theme-toggle__track" aria-hidden="true">
            <span className="theme-toggle__thumb" />
          </span>
        </button>
        {(isSeller || isAdmin) && (
          <button
            type="button"
            className="nav__list"
            onClick={onManageProperties}
            title={isAdmin ? "Submit properties or review submissions" : "Submit a property or list an existing NFT"}
          >
            Property tools
          </button>
        )}
        {account && (
          <button
            type="button"
            className="nav__auth"
            onClick={isAuthenticated ? onSignOut : onSignIn}
            disabled={authBusy}
            title={isAuthenticated ? "End wallet session" : "Sign a wallet challenge to authenticate"}
          >
            {authBusy ? "Signing..." : isAuthenticated ? "Sign out" : "Sign in"}
          </button>
        )}
        <button type="button" className="nav__connect" onClick={connectHandler}>
          {account ? `${account.slice(0, 6)}...${account.slice(38, 42)}` : "Connect Wallet"}
        </button>
        {authError && <span className="nav__auth-error" role="alert" title={authError}>Sign-in failed</span>}
      </div>
    </nav>
  );
}
