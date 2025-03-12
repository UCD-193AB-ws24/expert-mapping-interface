# Generate requests for Groq batch from expert_profiles.csv


# from groq import Groq
# import json
# import pandas as pd
# import os
# from unidecode import unidecode

# client = Groq(api_key = "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")

# script_dir = os.path.dirname(os.path.abspath(__file__))
# csv_file_path = os.path.join(script_dir, "..", "data", "csv", "expert_profiles.csv")
# csv_file_path = os.path.abspath(csv_file_path)

# if not os.path.exists(csv_file_path):
#   raise FileNotFoundError(f"CSV file not found at: {csv_file_path}")

# data = pd.read_csv(csv_file_path)
# titles = data["title"].tolist()

# texts = []
# for i in range(len(titles)):
#   texts.append(unidecode(titles[i]))
  
# json_dir = os.path.join(script_dir, "..", "data", "json")
# os.makedirs(json_dir, exist_ok=True)

# groq_request_path = os.path.join(json_dir, "groq_requests.jsonl")
# with open(groq_request_path, "w") as file:
#   for i in range(len(texts)):
#     request = {
#       "custom_id": f"{i:04}",
#       "method": "POST",
#       "url": "/v1/chat/completions",
#       "body": {
#         "model": "llama-3.3-70b-versatile", 
#         "messages": [
#           {"role": "system", "content": f'Extract geopolitical entites from provided text. Do not infer. Do not provide explaination.'},
#           {"role": "system", "content": f'Output answer in the format of "City, Country" or "City, State" or "State, Country" or "Country" or "Location name". If no location was found for the text, return "N/A".'},
#           {"role": "user", "content": f'Extract from this text: {texts[i]}'}
#         ]
#       }
#     }
#     file.write(json.dumps(request) + "\n")