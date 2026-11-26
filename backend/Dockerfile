FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code and create SQLite data directory inside same image
COPY . .
RUN mkdir -p /app/data

ENV DB_PATH=/app/data/delivery_mst.db

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
