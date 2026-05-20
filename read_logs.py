import os
import json

log_path = r'C:\Users\ةة\.gemini\antigravity\brain\02439689-aa24-4dba-8f87-5f91d78bcd27\.system_generated\logs\transcript.jsonl'
output_path = r'C:\Users\ةة\Desktop\phone\logs_output.txt'

print(f"Reading from {log_path} and writing to {output_path}")

with open(output_path, 'w', encoding='utf-8') as out_f:
    if os.path.exists(log_path):
        with open(log_path, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    source = obj.get("source")
                    content = obj.get("content") or ""
                    # Grab everything containing suggestions or from user
                    if source == "USER_INPUT" or (source == "MODEL" and ("اقترح" in content or "شاشات" in content or "تطوير" in content)):
                        out_f.write(f"=== [{source}] ===\n{content}\n\n")
                except Exception as e:
                    pass
    else:
        out_f.write("Logs not found.")
