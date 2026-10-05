import os

def run_worker():
    db_conn = os.getenv("DATABASE_URL")
    timeout = os.environ.get("API_TIMEOUT", "5000")
    print(f"Worker initialized with timeout={timeout}")

if __name__ == "__main__":
    run_worker()
