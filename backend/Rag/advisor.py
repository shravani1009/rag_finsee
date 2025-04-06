from flask import Flask, request, jsonify, render_template
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv
import os
import warnings
import pandas as pd
import matplotlib.pyplot as plt
import io
import base64
from pathlib import Path
import json
import tempfile
import threading
import re

load_dotenv()

app = Flask(__name__)

class FinancialAdvisor:
    def __init__(self):
        # Load API keys from environment variables
        self.groq_api_key = os.environ.get('GROQ_API_KEY')
        
        if not self.groq_api_key:
            raise ValueError("Groq API key must be provided in the GROQ_API_KEY environment variable.")
            
        self.client = Groq(api_key=self.groq_api_key)
        self.transaction_data = None
        self.categorized_data = None
        self.detected_format = {}
        self.current_file_path = None
        self.charts = {}
    
    def process_transaction_data(self, file_path):
        """Process transaction data from CSV/Excel files"""
        try:
            # Determine file type
            file_extension = Path(file_path).suffix.lower()
            
            if file_extension == '.csv':
                df = pd.read_csv(file_path)
            elif file_extension in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            else:
                return "Unsupported file format. Please upload CSV or Excel files."
                
            # Store the dataframe and file path
            self.transaction_data = df
            self.current_file_path = file_path
            
            # Try to automatically detect columns
            self.detected_format = self._detect_transaction_format(df)
            
            # Process and categorize transactions
            self._categorize_transactions()
            
            # Generate transaction summary
            summary = self._generate_transaction_summary()
            
            # Generate visualization
            self._generate_visualizations()
            
            return f"✅ Successfully processed transaction data with {len(df)} entries.\n\n{summary}"
            
        except Exception as e:
            return f"❌ Error processing transaction data: {str(e)}"

    def _detect_transaction_format(self, df):
        """Detect transaction data format automatically"""
        columns = [col.lower() for col in df.columns]
        format_info = {}
        
        # Look for date column
        date_candidates = ['date', 'transaction date', 'trans date', 'posted date']
        for candidate in date_candidates:
            matches = [col for col in columns if candidate in col]
            if matches:
                format_info['date_column'] = df.columns[columns.index(matches[0])]
                break
        
        # Look for amount column
        amount_candidates = ['amount', 'transaction amount', 'debit', 'credit']
        for candidate in amount_candidates:
            matches = [col for col in columns if candidate in col]
            if matches:
                format_info['amount_column'] = df.columns[columns.index(matches[0])]
                break
        
        # Look for description column
        desc_candidates = ['description', 'narrative', 'details', 'transaction description', 'merchant']
        for candidate in desc_candidates:
            matches = [col for col in columns if candidate in col]
            if matches:
                format_info['description_column'] = df.columns[columns.index(matches[0])]
                break
        
        return format_info

    def _categorize_transactions(self):
        """Categorize transactions based on description"""
        if not hasattr(self, 'transaction_data') or self.transaction_data is None:
            return
            
        # Create a copy of the dataframe
        df = self.transaction_data.copy()
        
        # Add category column if it doesn't exist
        if 'category' not in df.columns:
            df['category'] = 'Uncategorized'
        
        # Use LLM to categorize transactions in batches
        desc_column = self.detected_format.get('description_column')
        if not desc_column:
            # Cannot categorize without description
            self.categorized_data = df
            return
            
        # Process in batches to avoid context length issues
        batch_size = 20
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i+batch_size]
            descriptions = batch[desc_column].tolist()
            
            # Create prompt for categorization
            prompt = "Categorize each of these transactions into one of the following categories:\n"
            prompt += "Food, Shopping, Transportation, Housing, Utilities, Healthcare, Entertainment, Travel, Education, Income, Savings, Other\n\n"
            prompt += "For each transaction, respond with just the category name. Transactions:\n\n"
            prompt += "\n".join(descriptions)
            
            try:
                response = self.client.chat.completions.create(
                    model="llama3-70b-8192",
                    messages=[
                        {"role": "system", "content": "You are a financial transaction categorization expert. Your task is to categorize financial transactions based on their descriptions."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1
                )
                
                # Parse categories from response
                categories = response.choices[0].message.content.strip().split('\n')
                
                # Ensure we have the right number of categories
                if len(categories) == len(batch):
                    df.loc[batch.index, 'category'] = categories
            except Exception as e:
                print(f"Error categorizing transactions: {str(e)}")
        
        self.categorized_data = df

    def _generate_transaction_summary(self):
        """Generate a summary of transaction data"""
        if not hasattr(self, 'categorized_data') or self.categorized_data is None:
            return "No transaction data available."
            
        df = self.categorized_data
        
        # Calculate basic metrics
        total_records = len(df)
        
        # Handle amount calculations
        amount_col = self.detected_format.get('amount_column')
        if amount_col:
            # Convert to numeric, handling potential formatting issues
            df[amount_col] = pd.to_numeric(df[amount_col].astype(str).str.replace(',', '').str.replace('$', ''), errors='coerce')
            
            # Calculate income vs. expenses
            # Assuming positive values are income, negative are expenses (adjust as needed)
            income = df[df[amount_col] > 0][amount_col].sum()
            expenses = abs(df[df[amount_col] < 0][amount_col].sum())
            net = income - expenses
            
            # Category breakdown if we have categories
            if 'category' in df.columns:
                expense_df = df[df[amount_col] < 0].copy()
                category_summary = expense_df.groupby('category')[amount_col].sum().sort_values()
                top_categories = category_summary.head(5)
                
                category_breakdown = "\n🔍 Top Spending Categories:\n"
                for cat, amount in top_categories.items():
                    category_breakdown += f"- {cat}: ${abs(amount):.2f}\n"
                
            else:
                category_breakdown = ""
            
            summary = f"📊 Transaction Summary:\n\n"
            summary += f"Total Transactions: {total_records}\n"
            summary += f"Income: ${income:.2f}\n"
            summary += f"Expenses: ${expenses:.2f}\n"
            summary += f"Net: ${net:.2f}\n"
            summary += category_breakdown
            
            return summary
        else:
            return f"📊 Transaction Summary:\n\nTotal Transactions: {total_records}\n"

    def _generate_visualizations(self):
        """Generate visualizations from transaction data"""
        if not hasattr(self, 'categorized_data') or self.categorized_data is None:
            return
            
        df = self.categorized_data
        amount_col = self.detected_format.get('amount_column')
        
        if not amount_col or 'category' not in df.columns:
            return
            
        try:
            # Create a spending by category pie chart
            plt.figure(figsize=(10, 6))
            expenses = df[df[amount_col] < 0].copy()
            category_expenses = expenses.groupby('category')[amount_col].sum()
            
            # Convert to absolute values and sort
            abs_expenses = category_expenses.apply(abs).sort_values(ascending=False)
            
            # Only show top 6 categories, group the rest as "Other"
            if len(abs_expenses) > 6:
                top_cats = abs_expenses.head(6)
                other_sum = abs_expenses.iloc[6:].sum()
                
                if other_sum > 0:
                    plot_data = pd.concat([top_cats, pd.Series({'Other': other_sum})])
                else:
                    plot_data = top_cats
            else:
                plot_data = abs_expenses
                
            # Create pie chart
            plt.pie(plot_data, labels=plot_data.index, autopct='%1.1f%%', startangle=90)
            plt.axis('equal')
            plt.title('Spending by Category')
            
            # Save to a base64 string
            buf = io.BytesIO()
            plt.savefig(buf, format='png')
            buf.seek(0)
            self.charts['category_pie'] = base64.b64encode(buf.read()).decode('utf-8')
            plt.close()
            
            # Create income vs expenses bar chart if we have date info
            date_col = self.detected_format.get('date_column')
            if date_col:
                # Ensure date column is datetime
                try:
                    df[date_col] = pd.to_datetime(df[date_col])
                    # Add a month column
                    df['month'] = df[date_col].dt.strftime('%Y-%m')
                    
                    # Group by month
                    monthly_data = df.groupby('month')[amount_col].agg(['sum', 'count'])
                    
                    # Split into income and expenses
                    monthly_income = df[df[amount_col] > 0].groupby('month')[amount_col].sum()
                    monthly_expenses = df[df[amount_col] < 0].groupby('month')[amount_col].sum().abs()
                    
                    # Create the plot
                    plt.figure(figsize=(12, 6))
                    
                    # Get all months from both series
                    all_months = sorted(list(set(monthly_income.index) | set(monthly_expenses.index)))
                    
                    # Create index positions
                    x = range(len(all_months))
                    
                    # Fill in missing months with zeros
                    income_values = [monthly_income.get(month, 0) for month in all_months]
                    expense_values = [monthly_expenses.get(month, 0) for month in all_months]
                    
                    # Create the plot
                    width = 0.35
                    plt.bar([i - width/2 for i in x], income_values, width, label='Income')
                    plt.bar([i + width/2 for i in x], expense_values, width, label='Expenses')
                    
                    plt.xlabel('Month')
                    plt.ylabel('Amount ($)')
                    plt.title('Monthly Income vs Expenses')
                    plt.xticks(x, all_months, rotation=45)
                    plt.legend()
                    plt.tight_layout()
                    
                    # Save to a base64 string
                    buf = io.BytesIO()
                    plt.savefig(buf, format='png')
                    buf.seek(0)
                    self.charts['monthly_comparison'] = base64.b64encode(buf.read()).decode('utf-8')
                    plt.close()
                except Exception as e:
                    print(f"Error creating time-based chart: {str(e)}")
                
        except Exception as e:
            print(f"Error generating visualizations: {str(e)}")

    def generate_financial_advice(self):
        """Generate personalized financial advice based on transaction data"""
        if not hasattr(self, 'categorized_data') or self.categorized_data is None:
            return "No transaction data available for analysis."
        
        df = self.categorized_data
        
        # Prepare context with transaction data
        amount_col = self.detected_format.get('amount_column')
        if amount_col and 'category' in df.columns:
            # Calculate category percentages
            expenses = df[df[amount_col] < 0].copy()
            total_expense = abs(expenses[amount_col].sum())
            
            # Calculate income
            income = df[df[amount_col] > 0][amount_col].sum()
            
            # Calculate savings rate
            savings_rate = (income - total_expense) / income * 100 if income > 0 else 0
            
            category_expenses = expenses.groupby('category')[amount_col].sum().sort_values()
            
            # Create a context string with financial metrics
            context = "Based on the user's transaction data:\n\n"
            context += f"Total income: ${income:.2f}\n"
            context += f"Total expenses: ${total_expense:.2f}\n"
            context += f"Savings rate: {savings_rate:.1f}%\n\n"
            context += "Expense breakdown by category:\n"
            
            for category, amount in category_expenses.items():
                percentage = (abs(amount) / total_expense) * 100
                context += f"- {category}: ${abs(amount):.2f} ({percentage:.1f}%)\n"
            
            # Generate advice using the LLM with specific instructions for visually impaired users
            prompt = context + "\n\nProvide friendly and helpful financial advice based on this spending pattern. The user is visually impaired, so:\n"
            prompt += "1. Use clear, straightforward language without relying on visual cues\n"
            prompt += "2. Structure information with clear section headings and numbered lists\n"
            prompt += "3. Focus on practical, actionable advice that's easy to remember\n"
            prompt += "4. Suggest accessible financial tools and resources (like screen-reader compatible apps)\n"
            prompt += "5. Offer concise explanations of financial concepts when introducing them\n\n"
            prompt += "Focus on identifying areas where the user could save money, suggesting budgeting tips, and offering actionable recommendations. Include advice on improving their savings rate if applicable."
            
            try:
                response = self.client.chat.completions.create(
                    model="llama3-70b-8192",
                    messages=[
                        {"role": "system", "content": "You are a friendly, helpful personal financial advisor specializing in accessible financial guidance. Your task is to analyze spending patterns and provide clear, actionable financial advice that works well for visually impaired users. Be supportive, educational, and focus on practical solutions."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=1500
                )
                
                return "💡 Personal Financial Advice:\n\n" + response.choices[0].message.content.strip()
            except Exception as e:
                return f"Error generating financial advice: {str(e)}"
        else:
            return "Insufficient transaction data to generate financial advice. Please ensure your data includes amount and category information."

    def get_response(self, user_input):
        """Get response from the RAG system"""
        try:
            # Process the user input through the RAG system
            completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a financial advisor using RAG to provide accurate and personalized financial advice."},
                    {"role": "user", "content": user_input}
                ],
                model="llama3-70b-8192",
                temperature=0.7,
                max_tokens=150
            )
            
            # Get the response
            response = completion.choices[0].message.content
            
            # Format the response to be voice-friendly
            # Remove any complex formatting or special characters
            response = response.replace('\n', ' ').strip()
            response = ' '.join(response.split())  # Remove extra spaces
            
            # Ensure the response is concise and clear for voice output
            if len(response.split()) > 50:
                response = ' '.join(response.split()[:50]) + '...'
            
            return response
            
        except Exception as e:
            print(f"Error getting RAG response: {str(e)}")
            return "I apologize, but I'm having trouble processing your financial advice request at the moment. Please try again later."


# Routes for web interface
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Save the file temporarily
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, file.filename)
    file.save(temp_path)
    
    # Process the file
    advisor = FinancialAdvisor()
    result = advisor.process_transaction_data(temp_path)
    
    # Return charts if available
    response_data = {
        'message': result,
        'charts': advisor.charts if hasattr(advisor, 'charts') else {}
    }
    
    return jsonify(response_data)

@app.route('/api/advice', methods=['POST'])
def get_advice():
    file_path = request.json.get('file_path')
    
    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'Invalid file path'}), 400
    
    advisor = FinancialAdvisor()
    advisor.process_transaction_data(file_path)
    advice = advisor.generate_financial_advice()
    
    return jsonify({'advice': advice})

@app.route('/api/question', methods=['POST'])
def ask_question():
    file_path = request.json.get('file_path')
    question = request.json.get('question')
    
    if not file_path or not os.path.exists(file_path) or not question:
        return jsonify({'error': 'Invalid request parameters'}), 400
    
    advisor = FinancialAdvisor()
    advisor.process_transaction_data(file_path)
    answer = advisor.get_response(question)
    
    return jsonify({'answer': answer})

def run_terminal_app():
    """Run the financial advisor in terminal mode"""
    print("\n===== Financial Transaction Analyzer & Advisor =====")
    print("Commands:")
    print("- Type 'exit', 'quit', or 'bye' to end the conversation")
    print("- Type 'upload <path>' to upload and analyze transaction data")
    print("- Type 'advice' to get personalized financial advice")
    print("- Type 'summary' to see transaction summary again")
    print("- Type any financial question to get answers")
    print("====================================================\n")
    
    # Initialize the advisor
    try:
        advisor = FinancialAdvisor()
    except Exception as e:
        print(f"Initialization error: {str(e)}")
        return
    
    # Main chat loop
    while True:
        # Get user input
        user_input = input("\nYou: ").strip()
        
        # Check if user wants to exit
        if user_input.lower() in ['exit', 'quit', 'bye']:
            print("\nThank you for using the Financial Advisor! Goodbye.")
            break
        
        # Check for upload command
        if user_input.lower().startswith('upload '):
            file_path = user_input[7:].strip()
            print("\nProcessing your transaction data. This may take a moment...")
            result = advisor.process_transaction_data(file_path)
            print(f"\n{result}")
            continue
        
        # Check for advice command
        if user_input.lower() == 'advice':
            print("\nGenerating personalized financial advice...")
            advice = advisor.generate_financial_advice()
            print(f"\n{advice}")
            continue
        
        # Check for summary command
        if user_input.lower() == 'summary':
            if hasattr(advisor, 'categorized_data') and advisor.categorized_data is not None:
                summary = advisor._generate_transaction_summary()
                print(f"\n{summary}")
            else:
                print("\nNo transaction data available. Please upload data first.")
            continue
        
        # Skip empty inputs
        if not user_input:
            continue
        
        # Get and display the response
        try:
            print("\nFinancial Advisor: ", end="")
            response = advisor.get_response(user_input)
            print(response)
        except Exception as e:
            print(f"Error: {str(e)}")

if __name__ == "__main__":
    # Check run mode
    run_mode = os.environ.get('RUN_MODE', 'terminal').lower()
    
    if run_mode == 'web':
        # Run Flask app for web interface
        port = int(os.environ.get('PORT', 5000))
        app.run(host='0.0.0.0', port=port, debug=True)
    else:
        # Run terminal app
        run_terminal_app()