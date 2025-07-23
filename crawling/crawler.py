import sys
import json
import re
import requests
from bs4 import BeautifulSoup

# Assuming the parse_price function is already defined as before
def parse_price(price_text):
  if price_text is None:
    return None
  cleaned_price_text = re.sub(r'[^d.-]+', '', price_text)
  try:
    price = float(cleaned_price_text)
    return price
  except ValueError:
    # print(f"Warning: Could not parse price from '{price_text}"") # Avoid printing warnings to stdout for easier parsing in Node.js
    return None

def crawl_price(url, selector):
  try:
    # Fetch the HTML content from the URL
    response = requests.get(url)
    response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)

    # Parse the HTML content
    soup = BeautifulSoup(response.text, 'html.parser')

    # Find the element using the CSS selector
    price_element = soup.select_one(selector)

    if price_element:
      # Extract the text content of the element
      price_text = price_element.get_text(strip=True)
      print(f"Found price text: {price_text}", file=sys.stderr)
      return price_text
    else:
      print(f"Could not find element with selector: {selector}", file=sys.stderr)
      return None

  except requests.exceptions.RequestException as e:
    print(f"Error fetching URL {url}: {e}", file=sys.stderr)
    return None
  except Exception as e:
    print(f"An error occurred during crawling: {e}", file=sys.stderr)
    return None

if __name__ == "__main__":
  # This block is executed when the script is run directly
  if len(sys.argv) != 3:
    print("Usage: python crawler.py <url> <selector>", file=sys.stderr)
    sys.exit(1)

  url = sys.argv[1]
  selector = sys.argv[2]

  # Perform the crawl
  price_text = crawl_price(url, selector)
  parsed_price = parse_price(price_text)

  # Output the result as JSON to standard output
  if parsed_price is not None:
    print(json.dumps({"success": True, "price": parsed_price}))
  else:
    print(json.dumps({"success": False, "error": "Could not parse price or element not found"})) # Updated error message
