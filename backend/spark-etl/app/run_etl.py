"""
Spark ETL Runner - Entry point for the Spark ETL job
Runs PySpark in local mode (no cluster needed for this data size)
"""
import time
import os
import sys

def wait_for_fuseki(max_retries=30, delay=5):
    """Wait for Fuseki to be ready"""
    import requests
    fuseki_host = os.getenv("FUSEKI_HOST", "fuseki")

    for i in range(max_retries):
        try:
            resp = requests.get(f"http://{fuseki_host}:3030/$/ping", timeout=5)
            if resp.status_code == 200:
                print(f"[SPARK-ETL] Fuseki ready after {i*delay}s", file=sys.stderr)
                return True
        except:
            pass
        print(f"[SPARK-ETL] Waiting for Fuseki... ({i+1}/{max_retries})", file=sys.stderr)
        time.sleep(delay)
    return False


def main():
    print("[SPARK-ETL] Starting Spark ETL Pipeline (Local Mode)...", file=sys.stderr)

    # Wait for dependencies
    time.sleep(10)  # Initial delay

    if not wait_for_fuseki():
        print("[SPARK-ETL] Fuseki not available. Exiting.", file=sys.stderr)
        return

    # Import and run ETL job
    from etl_job import SparkArtETL

    etl = SparkArtETL()
    etl.run()


if __name__ == "__main__":
    main()
