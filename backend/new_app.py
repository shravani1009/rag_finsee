from flask import Flask, request, jsonify
from groq import Groq
from flask_cors import CORS
import json
import os
from pathlib import Path
from PyPDF2 import PdfReader
import torch
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import re

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})

client = Groq(api_key="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")

# Initialize PDF processing
def setup_pdf_embeddings(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        
        # Split into chunks
        chunks = [text[i:i+512] for i in range(0, len(text), 512)]
        
        # Create embeddings
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embeddings = model.encode(chunks)
        
        # Create FAISS index
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(embeddings)
        
        return chunks, index, model
    except Exception as e:
        print(f"Error setting up PDF: {e}")
        return None, None, None

# Initialize PDF data
PDF_PATH = "C:\\Users\\Admin\\Downloads\\Statement-XX2113_unlocked.pdf"
text_chunks, faiss_index, embedding_model = setup_pdf_embeddings(PDF_PATH)

def get_relevant_context(query, k=3):
    if not (text_chunks and faiss_index and embedding_model):
        return ""
    
    query_vector = embedding_model.encode([query])
    D, I = faiss_index.search(query_vector, k)
    relevant_chunks = [text_chunks[i] for i in I[0]]
    return " ".join(relevant_chunks)

def extract_transaction_details(text):
    try:
        amount_pattern = r'(?:Rs\.|₹|INR)\s*([0-9,]+\.?\d*)'
        date_pattern = r'\d{2}[-/]\d{2}[-/]\d{4}'
        
        amounts = re.findall(amount_pattern, text)
        dates = re.findall(date_pattern, text)
        
        return {
            'amounts': [float(amt.replace(',', '')) for amt in amounts],
            'dates': dates,
            'text': text
        }
    except Exception as e:
        print(f"Error extracting details: {e}")
        return None

# Update SYSTEM_PROMPT to include RAG handling
SYSTEM_PROMPT = """You are Finsee, a helpful and efficient banking and financial assistant. Keep responses under 50 words.
Always respond in this exact JSON format:
{
    "intent": "one of: greeting, balance, transfer, scan_qr, pay_phone, pay_contacts, profile, financial_advice",
    "response": "friendly concise response incorporating context from bank statement when available",
    "action": "none"
}

For financial advice, analyze the provided transaction context to offer:
1. Spending pattern insights
2. Saving suggestions
3. Budget recommendations
4. Transaction anomalies
5. Basic financial tips

Keep advice practical, clear, and focused on the user's actual transaction history."""

ONBOARDING_PROMPT = """You are Finsee's registration assistant. Guide users through registration.
Always respond in this JSON format:
{
    "step": "one of: phone, otp, upiPin, complete",
    "value": "extracted value from user input",
    "message": "next instruction or confirmation",
    "status": "success or error"
}
Validate: Phone (10 digits), OTP (1111 for testing), UPI PIN (6 digits)"""

VOICE_ONBOARDING_PROMPT = """You are Finsee's voice assistant for visually impaired users.
Analyze user's voice input and provide clear, structured responses.

For language selection:
- Detect mentions of "English", "Hindi", "Telugu", "Tamil"
- Handle variations like "I want [language]", "[language] please"

For registration:
Phone: Must be exactly 10 digits
OTP: Accept "1111" only
UPI PIN: Must be exactly 6 digits

Always respond in this format:
{
    "intent": "language_selection or registration",
    "step": "language/phone/otp/upiPin/complete",
    "value": "extracted value",
    "confidence": "high/low",
    "needs_confirmation": true/false,
    "message": "what you understood + question for confirmation",
    "next_instruction": "clear next step"
}"""

# Add Hindi financial keywords
FINANCE_KEYWORDS = {
    'english': ['spent', 'spending', 'expense', 'balance', 'transaction', 'money', 'paid', 'received'],
    'hindi': ['खर्च', 'बैलेंस', 'लेनदेन', 'पैसे', 'स्पेंड', 'जमा', 'भुगतान']
}

def is_financial_query(text):
    text = text.lower()
    return any(keyword in text for keywords in FINANCE_KEYWORDS.values() for keyword in keywords)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        user_message = request.json.get('message', '')
        
        # Get context for both financial advice and regular queries
        context = get_relevant_context(user_message)
        transaction_details = extract_transaction_details(context) if context else None
        
        # Create enhanced prompt with context
        enhanced_prompt = SYSTEM_PROMPT
        if context:
            enhanced_prompt += f"\n\nTransaction Context:\n{context}"
            if transaction_details:
                enhanced_prompt += f"\n\nDetected amounts: {transaction_details['amounts']}\nDates: {transaction_details['dates']}"

        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": enhanced_prompt},
                {"role": "user", "content": user_message}
            ],
            model="mistral-saba-24b",
            temperature=0.7,
            max_tokens=200
        )
        
        response_data = json.loads(completion.choices[0].message.content)
        if transaction_details:
            response_data['transaction_data'] = transaction_details
        
        return jsonify({"status": "success", "data": response_data})
        
    except Exception as e:
        print(f"Chat error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/onboarding', methods=['POST'])
def onboarding():
    try:
        data = request.json
        current_step = data.get('currentStep', 'phone')
        user_input = data.get('userInput', '')
        form_data = data.get('formData', {})

        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": ONBOARDING_PROMPT},
                {"role": "user", "content": f"Step: {current_step}, Input: {user_input}, Form: {json.dumps(form_data)}"}
            ],
            model="mistral-saba-24b",
            temperature=0.7,
            max_tokens=150,
            top_p=1,
            stream=False
        )
        
        response = completion.choices[0].message.content
        return jsonify({"status": "success", "data": json.loads(response)})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/process-voice', methods=['POST'])
def process_voice():
    try:
        data = request.json
        transcript = data.get('transcript', '').lower()
        current_step = data.get('currentStep', '')
        form_data = data.get('formData', {})

        # Special handling for language selection
        if current_step == 'language':
            languages = ['english', 'hindi', 'telugu', 'tamil']
            detected_language = next((lang for lang in languages if lang in transcript), None)
            
            if detected_language:
                return jsonify({
                    "status": "success",
                    "data": {
                        "intent": "language_selection",
                        "step": "language",
                        "value": detected_language,
                        "confidence": "high",
                        "needs_confirmation": True,
                        "message": f"I heard you want to use {detected_language}. Is that correct?",
                        "next_instruction": "Say yes to confirm or no to try again"
                    }
                })

        # Process registration steps
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": VOICE_ONBOARDING_PROMPT},
                {"role": "user", "content": f"Step: {current_step}, Input: {transcript}, Previous: {json.dumps(form_data)}"}
            ],
            model="mistral-saba-24b",
            temperature=0.3,
            max_tokens=150
        )
        
        result = json.loads(completion.choices[0].message.content)
        return jsonify({"status": "success", "data": result})
    except Exception as e:
        print(f"Voice processing error: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Could not process voice input"
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
