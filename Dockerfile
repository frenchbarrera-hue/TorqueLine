FROM python:3.11-slim

WORKDIR /app

COPY . .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Create data directory for SQLite
RUN mkdir -p /home/user/.torqueline

EXPOSE 8080

CMD ["python", "server.py"]