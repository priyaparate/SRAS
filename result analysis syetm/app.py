from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle

app = Flask(__name__)

# ✅ Enable CORS (VERY IMPORTANT)
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------------- LOAD MODEL ----------------
try:
    with open('logistic_model.pkl', 'rb') as f:
        model = pickle.load(f)

    with open('tfidf_vectorizer.pkl', 'rb') as f:
        vectorizer = pickle.load(f)

    print("✅ Model and vectorizer loaded successfully")

except Exception as e:
    print("❌ Error loading model:", e)


# ---------------- HOME ROUTE ----------------
@app.route('/', methods=['GET'])
def home():
    return "API is running 🚀"


import re

# ---------------- PREDICT ROUTE ----------------
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        # ✅ Validate input
        if not data or 'text' not in data:
            return jsonify({"error": "Invalid input. Provide 'text' field."}), 400

        text = data['text']
        text_lower = text.lower()

        # ✅ Transform text
        vector = vectorizer.transform([text])

        # ✅ Predict
        prediction = int(model.predict(vector)[0])

        # 1. ADD CONFIDENCE SCORE
        try:
            probs = model.predict_proba(vector)[0]
            # Assuming class 1 is Fake and class 0 is Real
            fake_prob = float(round(probs[1] * 100, 2))
            real_prob = float(round(probs[0] * 100, 2))
            confidence = max(fake_prob, real_prob)
        except:
            fake_prob = None
            real_prob = None
            confidence = None

        # 2. ADD KEYWORD EXTRACTION
        try:
            vector_array = vector.toarray()[0]
            nonzero_indices = vector_array.nonzero()[0]
            sorted_nonzero = sorted(nonzero_indices, key=lambda i: vector_array[i], reverse=True)
            feature_names = vectorizer.get_feature_names_out()
            top_keywords = [feature_names[i] for i in sorted_nonzero[:5]]
        except:
            top_keywords = []

        # 3. ADD RULE-BASED FLAGS
        suspicious_keywords = {
            "free": "Contains 'free'",
            "urgent": "Contains 'urgent'",
            "click": "Contains 'click'",
            "bank": "Asks for banking info",
            "payment": "Asks for payment"
        }
        flags = [msg for kw, msg in suspicious_keywords.items() if kw in text_lower]

        # 4. ADD URL DETECTION
        urls_found = re.findall(r'(https?://\S+|www\.\S+)', text)
        suspicious_urls = [url for url in urls_found if 'bit.ly' in url or 'tinyurl' in url]

        return jsonify({
            "prediction": prediction,
            "confidence": confidence,
            "fake_probability": fake_prob,
            "real_probability": real_prob,
            "keywords": top_keywords,
            "flags": flags,
            "urls_found": urls_found,
            "suspicious_urls": suspicious_urls
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- RUN SERVER ----------------
if __name__ == '__main__':
    app.run(debug=True)