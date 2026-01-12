FROM python:3.9-slim

# 1. Instalăm Java
RUN apt-get update && \
    apt-get install -y default-jre procps build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Configurare Python
RUN pip install --upgrade pip
RUN pip install --no-cache-dir pyspark==3.5.0

# 3. Instalăm dependențele
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copiem totul (inclusiv folderul 'app' care conține main.py)
COPY . .
RUN mkdir -p /app/data_lake

# 5. Setăm variabila PYTHONPATH ca să vadă modulele corect
ENV PYTHONPATH=/app

# 6. Pornim fișierul din folderul app
CMD ["python", "app/main.py"]