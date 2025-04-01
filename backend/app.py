from flask import Flask, request, jsonify
from groq import Groq
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"]}})

client = Groq(api_key="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")

SYSTEM_PROMPT = """You are Finsee, a helpful and efficient banking assistant. Keep responses under 50 words.
Always respond in this exact JSON format:
{
    "intent": "one of: greeting, balance, transfer, scan_qr, pay_phone, pay_contacts, profile",
    "response": "friendly concise response",
    "action": "one of: none, /screen/home, /screen/check-balance, /screen/bank-transfer, /screen/scan-qr, /screen/pay-phone, /screen/pay-contacts, /screen/profile"
}"""

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

@app.route('/chat', methods=['POST'])
def chat():
    try:
        user_message = request.json.get('message', '')
        
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
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
        print(e)
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
