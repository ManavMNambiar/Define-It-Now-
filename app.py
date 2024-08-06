from flask import Flask, request, jsonify
import os
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module='tensorflow')
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
from flask_cors import CORS
from transformers import pipeline
app = Flask(__name__)
CORS(app)
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.get_json()
    text = data.get('text','').strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
    input_length = len(text.split())
    max_length = 30 if input_length <= 10 else 150
    summary = summarizer(text, max_length=max_length, min_length=5, do_sample=False)
    return jsonify(summary)
if __name__ == '__main__':
    from waitress import serve
    serve(app, host='0.0.0.0', port=5000)
