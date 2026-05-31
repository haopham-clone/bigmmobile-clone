from __future__ import annotations

import csv
import json
import logging
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://bigmmobile.com.au/"
CATEGORY_URL = urljoin(BASE_URL, "product-category/tablet-cases/")
CATEGORY_NAME = "Tablet Cases"
SOURCE_NAME = "BigM Mobile"
MAX_PAGES = 100
REQUEST_TIMEOUT_SECONDS = 30
DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "bigm_tablet_cases.csv"
JSON_PATH = DATA_DIR / "bigm_tablet_cases.json"
FIELD_NAMES = [
    "name",
    "price",
    "product_url",
    "image_url",
    "category",
    "source",
    "crawled_at",
]
PRODUCT_CARD_SELECTOR = "li.product, .product-grid-item, .wd-product, .product"
PRICE_PATTERN = re.compile(r"\$\s*\d[\d,]*(?:\.\d{1,2})?")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
LOGGER = logging.getLogger(__name__)


def create_session() -> requests.Session:
    """Create a requests session with retries for transient request failures."""
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "BigMMobilePublicCrawler/1.0 "
                "(public product catalog crawler; contact: local-script-user)"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def build_page_url(page_number: int) -> str:
    """Build the category URL for a page number."""
    if page_number <= 1:
        return CATEGORY_URL
    return urljoin(CATEGORY_URL, f"page/{page_number}/")


def fetch_page(session: requests.Session, url: str) -> str | None:
    """Fetch one public category page, returning None when the request fails."""
    try:
        response = session.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        LOGGER.error("Request failed for %s: %s", url, exc)
        return None


def extract_product_url(card: Tag) -> str | None:
    """Extract the canonical-looking product detail URL from a product card."""
    selectors = (
        ".wd-entities-title a[href]",
        ".woocommerce-loop-product__title a[href]",
        "a.product-image-link[href]",
        "a.woocommerce-LoopProduct-link[href]",
        "a[href]",
    )
    for selector in selectors:
        for link in card.select(selector):
            href = str(link.get("href", "")).strip()
            absolute_url = urljoin(BASE_URL, href)
            if "/product/" in absolute_url:
                return absolute_url
    return None


def extract_name(card: Tag) -> str | None:
    """Extract a product name from the common WooCommerce title locations."""
    selectors = (
        ".wd-entities-title a",
        ".woocommerce-loop-product__title",
        "h2.woocommerce-loop-product__title",
        "a.product-image-link[aria-label]",
    )
    for selector in selectors:
        element = card.select_one(selector)
        if element is None:
            continue
        value = element.get("aria-label") or element.get_text(" ", strip=True)
        name = " ".join(str(value).split())
        if name:
            return name
    return None


def _find_public_price(text: str) -> str | None:
    match = PRICE_PATTERN.search(text)
    if match is None:
        return None
    return re.sub(r"\s+", "", match.group(0))


def extract_price(card: Tag) -> str | None:
    """Extract public RRP first, then fall back to a visible public price."""
    rrp_element = card.select_one(".bigm-rrp")
    if rrp_element is not None:
        rrp_price = _find_public_price(rrp_element.get_text(" ", strip=True))
        if rrp_price:
            return f"RRP: {rrp_price}"

    price_element = card.select_one(".price")
    if price_element is None:
        return None

    price_text = price_element.get_text(" ", strip=True)
    if "login" in price_text.lower() or "register" in price_text.lower():
        return None
    return _find_public_price(price_text)


def _first_srcset_url(srcset: str) -> str | None:
    first_candidate = srcset.split(",", maxsplit=1)[0].strip()
    if not first_candidate:
        return None
    return first_candidate.split()[0]


def extract_image_url(card: Tag) -> str | None:
    """Extract the first usable public product image URL."""
    image = card.select_one("a.product-image-link img, img")
    if image is None:
        return None

    for attribute in ("src", "data-src", "data-lazy-src", "data-original"):
        value = str(image.get(attribute, "")).strip()
        if value and not value.startswith("data:"):
            return urljoin(BASE_URL, value)

    for attribute in ("srcset", "data-srcset"):
        value = str(image.get(attribute, "")).strip()
        image_url = _first_srcset_url(value)
        if image_url and not image_url.startswith("data:"):
            return urljoin(BASE_URL, image_url)

    return None


def parse_products_from_page(html: str) -> list[dict[str, Any]]:
    """Parse public product cards from one category page."""
    soup = BeautifulSoup(html, "lxml")
    cards: list[Tag] = []
    seen_cards: set[int] = set()
    for card in soup.select(PRODUCT_CARD_SELECTOR):
        card_identity = id(card)
        if card_identity in seen_cards or extract_product_url(card) is None:
            continue
        seen_cards.add(card_identity)
        cards.append(card)

    crawled_at = datetime.now(timezone.utc).isoformat()
    products: list[dict[str, Any]] = []
    for card in cards:
        product_url = extract_product_url(card)
        if product_url is None:
            continue
        products.append(
            {
                "name": extract_name(card),
                "price": extract_price(card),
                "product_url": product_url,
                "image_url": extract_image_url(card),
                "category": CATEGORY_NAME,
                "source": SOURCE_NAME,
                "crawled_at": crawled_at,
            }
        )
    return products


def save_to_csv(products: list[dict[str, Any]], output_path: Path = CSV_PATH) -> None:
    """Write products to a UTF-8 BOM CSV file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELD_NAMES)
        writer.writeheader()
        writer.writerows(products)


def save_to_json(products: list[dict[str, Any]], output_path: Path = JSON_PATH) -> None:
    """Write products to a readable UTF-8 JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as json_file:
        json.dump(products, json_file, ensure_ascii=False, indent=2)


def main() -> None:
    """Crawl all currently available public Tablet Cases category pages."""
    session = create_session()
    products_by_url: dict[str, dict[str, Any]] = {}

    for page_number in range(1, MAX_PAGES + 1):
        if page_number > 1:
            delay = random.uniform(1, 3)
            LOGGER.info("Waiting %.2f seconds before the next request", delay)
            time.sleep(delay)

        page_url = build_page_url(page_number)
        LOGGER.info("Crawling page %d: %s", page_number, page_url)
        html = fetch_page(session, page_url)
        if html is None:
            LOGGER.info("Stopping because page %d could not be fetched", page_number)
            break

        page_products = parse_products_from_page(html)
        if not page_products:
            LOGGER.info("Stopping because page %d has no product cards", page_number)
            break

        new_products = 0
        for product in page_products:
            product_url = str(product["product_url"])
            if product_url not in products_by_url:
                products_by_url[product_url] = product
                new_products += 1

        LOGGER.info(
            "Page %d: found %d products, %d new products, %d total products",
            page_number,
            len(page_products),
            new_products,
            len(products_by_url),
        )
        if new_products == 0:
            LOGGER.info("Stopping because page %d has no new product URLs", page_number)
            break
    else:
        LOGGER.warning("Stopped after reaching the safety limit of %d pages", MAX_PAGES)

    products = list(products_by_url.values())
    save_to_csv(products)
    save_to_json(products)
    LOGGER.info("Saved %d products to %s and %s", len(products), CSV_PATH, JSON_PATH)


if __name__ == "__main__":
    main()
