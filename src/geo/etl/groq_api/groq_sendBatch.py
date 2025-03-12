# Send groq_requests.jsonl to Groq for processing

# import requests
# import os

# script_dir = os.path.dirname(os.path.abspath(__file__))
# groq_file_path = os.path.join(script_dir, "..", "data", "json", "groq_requests.jsonl")
# groq_file_path = os.path.abspath(groq_file_path)

# if not os.path.exists(groq_file_path):
#   raise FileNotFoundError(f"Llama's result file not found at: {groq_file_path}")


# def upload_to_groq(api_key, file_path):
#   url = "https://api.groq.com/openai/v1/files"
#   headers = {"Authorization": f'Bearer {api_key}'}
#   files = {"file": ("batch_file.jsonl", open(file_path, "rb"))}
#   data = {"purpose": "batch"}
  
#   response = requests.post(url, headers=headers, files=files, data=data)
#   return response.json()

# api_key = "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"
# file_path = groq_file_path

# # result = upload_to_groq(api_key, file_path)
# # print(result)


# def create_batch(api_key, input_file_id):
#   url = "https://api.groq.com/openai/v1/batches"
#   headers = {
#     "Authorization": f'Bearer {api_key}',
#     "Content-type": "application/json"
#   }
#   data = {
#     "input_file_id": input_file_id,
#     "endpoint": "/v1/chat/completions",
#     "completion_window": "24h"
#   }
  
#   response = requests.post(url, headers=headers, json=data)
#   return response.json()

# file_id = "file_01jncxxrmyfy2bmfza179gva9x"

# # result = create_batch(api_key, file_id)
# # print(result)


# def get_batch_status(api_key, batch_id):
#   url = f"https://api.groq.com/openai/v1/batches/{batch_id}"
  
#   headers = {
#       "Authorization": f"Bearer {api_key}",
#       "Content-Type": "application/json"
#   }
  
#   response = requests.get(url, headers=headers)
#   return response.json()

# batch_id = "batch_01jncxynxqer58h8ah6pgepp2e"

# # result = get_batch_status(api_key, batch_id)
# # print(result)