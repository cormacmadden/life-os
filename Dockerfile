# Use a full Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the backend folder into the /app directory
COPY backend /app/backend

# Install dependencies
RUN pip install --no-cache-dir --progress-bar off -r /app/backend/requirements.txt

# Set the PYTHONPATH to include the /app directory
ENV PYTHONPATH="/app"

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--log-level", "debug", "--workers", "1"]
