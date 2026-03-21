FROM python:3.11-slim

WORKDIR /app

# Copy only requirements first (better caching)
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# App Runner expects port 8081
EXPOSE 8081

CMD ["gunicorn", "-c", "gunicorn.config.py", "app.main:app"]