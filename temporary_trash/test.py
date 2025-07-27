import google.generativeai as genai
import os

genai.configure(api_key=os.environ['GOOGLE_API_KEY'])

model = genai.GenerativeModel('gemini-2.5-flash')  # Or 'gemini-2.5-pro' with your sub
response = model.generate_content("Create a file in the gemini folder that simply prints 'Hello, World!' in Python.")
print(response.text)