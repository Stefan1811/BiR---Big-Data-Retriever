FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Python path for module imports
ENV PYTHONPATH=/app

CMD ["python", "app/main.py"]
