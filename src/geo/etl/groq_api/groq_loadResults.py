# Download Groq results into llama_geo_results.jsonl


# import requests
# import os

# api_key = "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"

# script_dir = os.path.dirname(os.path.abspath(__file__))
# json_dir = os.path.join(script_dir, "..", "data", "json")
# os.makedirs(json_dir, exist_ok=True)

# result_file_path = os.path.join(json_dir, "llama_geo_results.jsonl")


# def download_file_content(api_key, output_file_id, output_file):
#     url = f"https://api.groq.com/openai/v1/files/{output_file_id}/content"
    
#     headers = {
#         "Authorization": f"Bearer {api_key}"
#     }
    
#     response = requests.get(url, headers=headers)
    
#     # Write the content to a file
#     with open(output_file, 'wb') as f:
#         f.write(response.content)
    
#     return f"File downloaded successfully to {output_file}"

# output_file_id = "file_01jnffm9xheb9a4r56771fwaky"
# output_file = result_file_path

# # result = download_file_content(api_key, output_file_id, output_file)
# # print(result)