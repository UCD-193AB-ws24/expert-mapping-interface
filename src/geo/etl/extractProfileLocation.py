import sys
import io
import requests
import json
import os

# Set UTF-8 encoding for stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# LLaMA API configuration
LLAMA_API_URL = "http://localhost:11434/api/generate"  # Corrected URL
MODEL_NAME = "llama3.1"  # Update this to match your model name

# File paths for the JSON files
BASE_DIR = os.path.dirname(__file__)
WORKS_FILE = os.path.join(BASE_DIR, "json", "expertWorks.json")
GRANTS_FILE = os.path.join(BASE_DIR, "json", "expertGrants.json")

def query_llama(prompt):
    """
    Query the LLaMA API with a prompt.
    :param prompt: The input prompt for the LLaMA model.
    :return: The response from the LLaMA model.
    """
    try:
        response = requests.post(
            LLAMA_API_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False
            },
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        raw_response = response.json().get("response", "").strip()
        print(f"Raw LLaMA Response: {raw_response}")  # Debugging log
        return raw_response
    except requests.exceptions.RequestException as e:
        print(f"Error querying LLaMA API: {e}")
        return "Unknown Location"

def extract_location(title):
    """
    Extract the ISO standard location for a given title using LLaMA.
    :param title: The title of the work or grant.
    :return: The extracted location or "Unknown Location" if not found.
    """
    prompt = (
        f"Identify the location associated with the following research work or grant.\n"
        f"Title: \"{title}\"\n"
        f"Provide the location in ISO 3166-1 alpha-2 format (e.g., 'US' for the United States) "
        f"or respond with 'None' if no location is found.\n"
    )
    extracted_location = query_llama(prompt)
    return extracted_location if extracted_location and extracted_location != "None" else "Unknown Location"

def process_file(file_path, title_key):
    """
    Process a JSON file to extract locations for each entry.
    :param file_path: Path to the JSON file.
    :param title_key: The key in the JSON objects that contains the title.
    """
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} does not exist.")
        return

    with open(file_path, "r", encoding="utf-8") as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError:
            print(f"Error: File {file_path} contains invalid JSON.")
            return

    if not data or not isinstance(data, list):
        print(f"Error: File {file_path} is empty or not a valid list.")
        return

    for entry in data:
        title = entry.get(title_key, "").strip()
        if not title:
            print("Skipping entry with no title.")
            continue
        print(f"Processing title: {title}")
        location = extract_location(title)
        entry["location"] = location
        print(f"Extracted location: {location}")

    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

    print(f"Updated file saved: {file_path}")

def main():
    """
    Main function to process both works and grants files.
    """

    print("Processing works...")
    process_file(WORKS_FILE, "name")

    print("Processing grants...")
    process_file(GRANTS_FILE, "title")

    print("Location extraction completed.")

if __name__ == "__main__":
    main()