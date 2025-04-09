import os
import time
import logging
import pandas as pd
import json
import re
from unidecode import unidecode

from geopy.geocoders import Nominatim
from groq import Groq

# API
groq_client = Groq(api_key = "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")

geolocator = Nominatim(user_agent="lctnguyen@ucdavis.edu")
manual_geo_name = {
  "CA" : "California",
  "California, U.S.A." : "California",
  "the United States" : "USA",
  "East Greenland" : "Greenland",
  "Latin America" : "South America",
  "South America" : "South America",
  "North America" : "North America"
}

BATCH_SIZE = 100

# Clear the log file on each run
log_file = "processing.log"
if os.path.exists(log_file):
  os.remove(log_file)

# Setup logging
logging.basicConfig(filename=log_file, level=logging.INFO, format="%(asctime)s - %(message)s")

# Temporary storage. Will parse into Json file
profiles = {}           # Expert's name -> Profile object
location_based = {}     # Location -> {Expert's name -> GeoProfileMapping object}
coordinates = {}        # Location -> Coordinates

# Use in this script only. Store geocoded locations
geoData = {}          # Location's name -> its info (id, coordinate, level)
standardGeoName = {}  # Location's id -> normalized name

unique_titles = set()
unique_locations = set()
unique_researchers = set()

def formatDeepSeekResult(text):
  pattern = r'<think>.*?</think>'
  clean = re.sub(pattern, '', text, flags=re.DOTALL)
  clean = clean.strip().split("\n")
  for i in range(len(clean)):
    clean[i] = clean[i].strip()
  return clean

def normalizeLocationName(location):
  location = location.strip().lower()
  location = re.sub(r'\s+', ' ', location)
  location = re.sub(r'^the\s+', '', location, flags=re.IGNORECASE)
  location = re.sub(r'\b\w', lambda c: c.group(0).upper(), location)
  return location

class Profile:
  def __init__(self, name):
    self.name = name
    self.titles = []
    self.locations = []

  def addTitle(self, title):
    self.titles.append(title)
    unique_titles.add(title)

  def addLocation(self, location):
    self.locations.append(location)
    unique_locations.add(location)

def profileToJson(profile: Profile):
  return {"titles": profile.titles, "locations": profile.locations}

class GeoProfileMapping:
  def __init__(self, name, location, confident):
    self.name = name
    self.location = location
    self.relatedWork = []
    self.matchesCount = 0
    self.confident = confident

  def addRelatedWork(self, work):
    self.relatedWork.append(work)
    self.matchesCount += 1

def geoProfileMappingToJson(mapping: GeoProfileMapping):
  return {"matches": mapping.matchesCount, "confident": mapping.confident, "works": mapping.relatedWork}


# -----Main-----
start_time = time.time()

# Locate files
script_dir = os.path.dirname(os.path.abspath(__file__))
csv_file_path = os.path.join(script_dir, "..", "data", "csv", "expert_profiles.csv")
csv_file_path = os.path.abspath(csv_file_path)
geo_file_path = os.path.join(script_dir, "..", "data", "json", "extraction", "llama_geo_results.jsonl")
geo_file_path = os.path.abspath(geo_file_path)

if not os.path.exists(csv_file_path):
  raise FileNotFoundError(f"CSV file not found at: {csv_file_path}")
if not os.path.exists(geo_file_path):
  raise FileNotFoundError(f"Llama's result file not found at: {geo_file_path}")

logging.info("Processing file: %s", csv_file_path)
logging.info("Processing file: %s", geo_file_path)

# Read data from expert_profiles.csv
data = pd.read_csv(csv_file_path)
total_rows = len(data)

# Read locations from llama_geo_results.jsonl
with open(geo_file_path, "r") as file:
  llama_results = list(file)

# Match locations to data
geo = ["N/A"] * total_rows
for ret in llama_results:
  ret = json.loads(ret)
  id = int(ret["custom_id"])
  loc = ret["response"]["body"]["choices"][0]["message"]["content"]
  # Some manual name changes for api
  if loc in manual_geo_name:
    loc = manual_geo_name[loc]
  elif "America" in loc:
    loc = "America"
  geo[id] = loc
data["geo"] = geo

titles = data["title"].tolist()
names = data["Name"].tolist()
locations = data["geo"].tolist()

total_locations = 0
fail_to_geocode = set()

# Geocoding all locations. Store in "geoData"
for batch_start in range(0, total_rows, BATCH_SIZE):
  batch_end = min(batch_start + BATCH_SIZE, total_rows)
  batch_locations = locations[batch_start:batch_end]
  
  batch_start_time = time.time()
  batch_location_count = 0
  
  for location in batch_locations:
    # Geocode and store to 'geoData' if it's a new location
    if location != "N/A":
      if location not in geoData:
        time.sleep(0.5)
        try:
          geo = geolocator.geocode(location)
          if geo:
            full_info = geo.raw
            geoData[location] = {
              "geo_id" : full_info["osm_id"],
              "coordinate" : [geo.latitude, geo.longitude],
              "level" : full_info["place_rank"]
            }
          else:
            fail_to_geocode.add(location)
        except Exception:
          print("API error geocoding: ", location)
          
      if location in geoData:
        batch_location_count += 1
  
  batch_time = time.time() - batch_start_time

  logging.info(
    "Batch %d-%d processed in %.2f seconds | Locations found: %d | Total locations: %d",
    batch_start, batch_end, batch_time, batch_location_count, total_locations
  )
  print(
    f"Processed batch {batch_start}-{batch_end} in {batch_time:.2f}s | "
    f"Locations found: {batch_location_count}"
  )
  
# Filter out false positives
filter = []
for geo in geoData:
  filter.append(geo)
  
filtered = set()
for batch_start in range(0, len(filter), 20):
  batch_end = min(batch_start + 20, len(filter))
  
  chat_completion = groq_client.chat.completions.create(
    messages=[
        {"role": "system", "content": f'System will be provided with a list of texts. Determine invalid locations in provided text. Do not infer.'},
        {"role": "system", "content": f'Output each invalid location in seperate line. Do not provide explainations.'},
        {"role": "user", "content": f'Extract from this list: {filter[batch_start:batch_end]}'}
    ],
    model="deepseek-r1-distill-llama-70b",
    stream=False,
    temperature=0
  )
  for f in formatDeepSeekResult(chat_completion.choices[0].message.content):
    filtered.add(f)

# Processing profiles
for name, title, location in zip(names, titles, locations):
  unique_researchers.add(name)  # Track unique researchers
  
  # Add title to corresponding expert profile
  if name not in profiles:
    profiles[name] = Profile(name)
  profiles[name].addTitle(title)

  # Handle expert/title that has location
  if location in geoData:
    total_locations += 1

    # Use standardize location's name
    if geoData[location]["geo_id"] not in standardGeoName:
      standardGeoName[geoData[location]["geo_id"]] = location
    location_name = standardGeoName[geoData[location]["geo_id"]]
    location_name = normalizeLocationName(location_name)
    
    # Store new coordinates
    if location_name not in coordinates:
      coordinates[location_name] = geoData[location]["coordinate"]
    
    # Add location to expert's profile
    profiles[name].addLocation(location_name)
    
    # Confident
    confident = "High"
    if location in filtered:
      confident = "Low"
    
    # Update location-based profile mapping
    if location_name not in location_based:
      location_based[location_name] = {}
    if name not in location_based[location_name]:
      location_based[location_name][name] = GeoProfileMapping(name, location_name, confident)

    location_based[location_name][name].addRelatedWork(title)
  else:
    profiles[name].addLocation("None")


logging.info("Completed in %.2f seconds", time.time() - start_time)

# Save JSON files, creating them if they don't exist
start_save = time.time()

# Create directories if they don't exist
json_ext_dir = os.path.join(script_dir, "..", "data", "json", "extraction")
os.makedirs(json_ext_dir, exist_ok=True)
json_geo_dir = os.path.join(script_dir, "..", "data", "json", "geocoding")
os.makedirs(json_ext_dir, exist_ok=True)

# Save expert profiles
expert_profiles_path = os.path.join(json_ext_dir, "expert_profiles.json")
with open(expert_profiles_path, "w") as file_profiles:
  json.dump(profiles, file_profiles, default=profileToJson, indent=2)

# Save location-based profiles
location_based_profiles_path = os.path.join(json_geo_dir, "location_based_profiles.json")
with open(location_based_profiles_path, "w") as file_locations:
  json.dump(location_based, file_locations, default=geoProfileMappingToJson, indent=2)
  
# # Save coordinate
# coordinates_path = os.path.join(json_dir, "location_coordinates.json")
# with open(coordinates_path, "w") as file_profiles:
#   json.dump(coordinates, file_profiles, indent=2)
  
# Stats and confidence:
report_path = os.path.join(json_ext_dir, "report.txt")
with open(report_path, "w") as file_report:
  file_report.write("Final Statistics:\n")
  file_report.write(f"Total unique researchers: {len(unique_researchers)}\n")
  file_report.write(f"Total unique works (titles) parsed: {len(unique_titles)}\n")
  file_report.write(f"Total unique locations extracted: {len(unique_locations)}\n")
  file_report.write(f"Total works with locations: {total_locations}\n\n")
  
  file_report.write(f"* Incorrect format/Fail to geocode: {len(fail_to_geocode)} (filtered by Nominatim API)\n\n")
  for fail in fail_to_geocode:
    file_report.write(f"{fail}\n\n")
    
  file_report.write(f"* Low confident locations: {len(filtered)} (filtered by LLM)\n\n")
  for geo in filtered:
    file_report.write(f"-{geo}\n")
  
# Save non-geo profiles
non_geo_profiles = {name: profile for name, profile in profiles.items() if "None" in profile.locations}
non_geo_profiles_path = os.path.join(json_ext_dir, "non_geo_profiles.json")
with open(non_geo_profiles_path, "w") as file_non_geo_profiles:
  json.dump(non_geo_profiles, file_non_geo_profiles, default=profileToJson, indent=2)

logging.info("Saved JSON files in %.2f seconds", time.time() - start_save)

# Final Stats
total_time = time.time() - start_time
logging.info("Final Statistics:")
logging.info("Total unique researchers: %d", len(unique_researchers))
logging.info("Total unique works (titles) parsed: %d", len(unique_titles))
logging.info("Total unique locations extracted: %d", len(unique_locations))
logging.info("Total execution time: %.2f minutes", total_time / 60)

print(f"\nIncorrect format/Fail to geocode: {len(fail_to_geocode)}")
print(f"\nLow confident: {len(filtered)}")

print("\nFinal Statistics:")
print(f"Total unique researchers: {len(unique_researchers)}")
print(f"Total unique works (titles) parsed: {len(unique_titles)}")
print(f"Total unique locations extracted: {len(unique_locations)}")
print(f"Total execution time: {total_time / 60:.2f} minutes")

print("Processing complete. Check processing.log for batch statistics.")