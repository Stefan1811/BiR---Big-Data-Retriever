FROM python:3.9-slim

WORKDIR /app

# Instalare dependințe
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiere cod
COPY . .

# Variabila PYTHONPATH asigură că Python vede modulele corect
ENV PYTHONPATH=/app

CMD ["python", "app/main.py"]