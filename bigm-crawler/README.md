# BigM Mobile Tablet Cases Crawler

Python crawler for public product data from:

```text
https://bigmmobile.com.au/product-category/tablet-cases/
```

The script crawls category pagination only. It does not log in, bypass security
controls, fetch hidden wholesale prices, or download images.

## Requirements

- Python 3.10+
- Internet access

## Installation

```bash
cd bigm-crawler
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python main.py
```

The crawler waits a random 1-3 seconds between requests and logs progress for
each page. It stops when there are no product cards, no new product URLs, a page
request fails, or the 100-page safety limit is reached.

Output files:

```text
data/bigm_tablet_cases.csv
data/bigm_tablet_cases.json
```

## Output Schema

| Field | Description |
| --- | --- |
| `name` | Public product name |
| `price` | Public RRP when present, otherwise public price or `null` |
| `product_url` | Product detail URL |
| `image_url` | Public image URL or `null` |
| `category` | Always `Tablet Cases` |
| `source` | Always `BigM Mobile` |
| `crawled_at` | ISO timestamp in UTC |

## JSON Example

```json
[
  {
    "name": "Product name",
    "price": "RRP: $49.99",
    "product_url": "https://bigmmobile.com.au/product/example-product/",
    "image_url": "https://example.com/product-image.jpg",
    "category": "Tablet Cases",
    "source": "BigM Mobile",
    "crawled_at": "2026-05-31T10:00:00+00:00"
  }
]
```
