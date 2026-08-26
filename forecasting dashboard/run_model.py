import pandas as pd
import pickle
import json
import warnings
import os
warnings.filterwarnings('ignore')

try:
    # Read the input data sent by Node.js
    with open('input.json', 'r') as f:
        input_data = json.load(f)

    # Load the ML Model and Features
    with open('trained_model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('model_features.pkl', 'rb') as f:
        features = pickle.load(f)

    # Convert input to DataFrame
    df = pd.DataFrame(input_data)

    # Prepare columns to match the trained features
    for col in features:
        if col not in df.columns:
            df[col] = 0
            
    df = df[features]
    
    # Generate predictions
    predictions = model.predict(df).tolist()

    # Write predictions to output.json
    with open('output.json', 'w') as f:
        json.dump(predictions, f)

except Exception as e:
    with open('output.json', 'w') as f:
        json.dump({"error": str(e)}, f)
