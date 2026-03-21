# gunicorn.config.py

bind = "0.0.0.0:8080"

# Workers
workers = 2
worker_class = "uvicorn.workers.UvicornWorker"

# Performance
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Restart workers periodically (helps stability)
max_requests = 1000
max_requests_jitter = 100
