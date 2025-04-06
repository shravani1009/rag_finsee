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
from Rag import rag_system

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})

client = Groq(api_key="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")

# Initialize PDF data
PDF_PATH = "C:\\Users\\Admin\\Downloads\\Statement-XX2113_unlocked.pdf"
rag_system.load_pdf(PDF_PATH)

def get_relevant_context(query, k=3):
    chunks = rag_system.get_relevant_chunks(query, k)
    return rag_system.format_context(chunks)

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
SYSTEM_PROMPT = """You are Finsee, a helpful and efficient banking assistant. Keep responses under 50 words.

Your primary responsibilities:
1. Handle banking operations (transfers, payments, balance)
2. Provide financial advice based on transaction data
3. Support both English and Hindi queries

For financial advice and statements, analyze the provided context to give accurate, personalized responses.

Always respond in this exact JSON format:
{
    "intent": "one of: greeting, balance, transfer, scan_qr, pay_phone, pay_contacts, profile, financial_advice",
    "response": "friendly concise response",
    "action": "one of: none, /screen/home, /screen/check-balance, /screen/bank-transfer, /screen/scan-qr, /screen/pay-phone, /screen/pay-contacts, /screen/profile, /screen/financial-advice"
}

For financial advice:
- Use transaction context to give relevant advice
- Keep responses practical and actionable
- Consider both spending patterns and savings
- Respond in the same language as the query (English/Hindi)"""

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
        
        if is_financial_query(user_message):
            context = get_relevant_context(user_message)
            transaction_details = extract_transaction_details(context)
            
            # Enhanced RAG prompt for financial advice
            rag_prompt = f"""Analyze this bank statement context:
{context}

User query: {user_message}

Provide detailed financial advice based on the transaction patterns.
Include:
1. Spending analysis
2. Actionable recommendations
3. Savings opportunities
4. Budget suggestions

Response must follow this format:
{{
    "intent": "financial_advice",
    "response": "clear and structured financial advice",
    "action": "/screen/financial-advice",
    "analysis": {{
        "summary": "brief overview",
        "recommendations": ["list", "of", "suggestions"],
        "savings_potential": "identified savings opportunities"
    }}
}}"""

            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": rag_prompt}
                ],
                model="mistral-saba-24b",
                temperature=0.3,
                max_tokens=200
            )
            
            response_data = json.loads(completion.choices[0].message.content)
            if transaction_details:
                response_data['transaction_data'] = transaction_details
            
            return jsonify({"status": "success", "data": response_data})

        # Handle non-financial queries with existing flow
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            model="mistral-saba-24b",
            temperature=0.7,
            max_tokens=150
        )
        
        response = completion.choices[0].message.content
        return jsonify({"status": "success", "data": json.loads(response)})
        
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
