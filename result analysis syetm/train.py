import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pickle

# Expanded dataset
data = {
    'text': [
        "Congratulations! Send money to claim scholarship",
        "Click here to win scholarship http://bit.ly/fake",
        "Urgent scholarship offer apply now",
        "Provide bank details to receive funds",
        "You won scholarship pay registration fee",
        "aid-free"
        "http://student-aid-free.com"


        "Apply through official portal scholarships.gov.in",
        "University announced merit scholarship",
        "Submit documents via college office",
        "Scholarship results on official website",
        "Government scholarship scheme open"
    ] * 20,
    
    'label': ([1]*5 + [0]*5) * 20
}

df = pd.DataFrame(data)

# TF-IDF
vectorizer = TfidfVectorizer(
    max_features=5000,
    ngram_range=(1,2),
    stop_words='english'
)

X = vectorizer.fit_transform(df['text'])
y = df['label']

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# Train
model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)

# Accuracy
y_pred = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))

# Save
pickle.dump(model, open("model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl", "wb"))

print("✅ Model ready!")