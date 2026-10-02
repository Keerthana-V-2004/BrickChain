import { useEffect, useState } from "react";

export default function Search({
  homes,
  onSearch,
  propertyTypes,
  typeFilter,
  onTypeFilter,
  listingFilter,
  onListingFilter,
  priceFilter,
  onPriceFilter,
  bedroomFilter,
  onBedroomFilter,
  onSearchSubmit,
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const slides = homes.slice(0, 6);
  const activeHome = slides[activeSlide];

  useEffect(() => {
    if (slides.length < 2 || isPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [slides.length, isPaused]);

  return (
    <header className="market-search">
      <section
        className="hero"
        aria-roledescription="carousel"
        aria-label="Featured properties"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
        }}
      >
        <div className="hero__slides" aria-hidden="true">
          {slides.map((home, index) => (
            <img
              className={index === activeSlide ? "hero__slide is-active" : "hero__slide"}
              key={home.id}
              src={home.image}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
        <div className="hero__content">
          <p className="hero__eyebrow">ESTATEHUB PROPERTIES</p>
          <h2>Find a place you’ll love to call home.</h2>
          <p className="hero__copy">Thoughtful homes. Clear details. A better way to make your next move.</p>
          {activeHome && <p className="hero__caption">Featured: {activeHome.name} · {activeHome.address}</p>}
        </div>
      </section>
      <div className="search" id="property-search">
        <div className="search__inner">
          <div className="search__panel">
            <div className="search__controls">
              <label className="search__field search__field--query">
                <span>Location or keyword</span>
                <input
                  type="search"
                  placeholder="City, address, or property name"
                  onChange={(event) => onSearch(event.target.value)}
                />
              </label>
              <label className="search__field">
                <span>Property type</span>
                <select value={typeFilter} onChange={(event) => onTypeFilter(event.target.value)}>
                  <option value="all">Any type</option>
                  {propertyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="search__field">
                <span>Price range</span>
                <select value={priceFilter} onChange={(event) => onPriceFilter(event.target.value)}>
                  <option value="all">Any price</option>
                  <option value="under-400">Under 400 ETH</option>
                  <option value="400-600">400–600 ETH</option>
                  <option value="over-600">Over 600 ETH</option>
                </select>
              </label>
              <label className="search__field">
                <span>Bedrooms</span>
                <select value={bedroomFilter} onChange={(event) => onBedroomFilter(event.target.value)}>
                  <option value="all">Any</option>
                  <option value="2">2+ beds</option>
                  <option value="3">3+ beds</option>
                  <option value="4">4+ beds</option>
                </select>
              </label>
              <button className="search__submit" type="button" onClick={onSearchSubmit}>
                Search properties
              </button>
            </div>
            <div className="search__availability" role="group" aria-label="Listing availability">
              {[
                ["all", "All homes"],
                ["listed", "For sale"],
                ["unlisted", "Not listed"],
              ].map(([value, label]) => (
                <button
                  className={listingFilter === value ? "filter-button is-active" : "filter-button"}
                  key={value}
                  type="button"
                  aria-pressed={listingFilter === value}
                  onClick={() => onListingFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
