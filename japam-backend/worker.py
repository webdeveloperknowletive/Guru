import os
import time
import json
import logging
import signal
import sys
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(process)d] [%(levelname)s] %(message)s"
)
logger = logging.getLogger("worker")

RUNNING = True


def signal_handler(sig, frame):
    global RUNNING
    logger.info("Graceful shutdown signal received. Finishing pending tasks...")
    RUNNING = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def process_image_thumbnail(file_path: str, max_size=(300, 300)):
    """Generate high-quality WebP thumbnail using Pillow."""
    try:
        if not os.path.exists(file_path):
            logger.warning("File not found for thumbnailing: %s", file_path)
            return None

        thumb_dir = os.path.join(os.path.dirname(file_path), "thumbs")
        os.makedirs(thumb_dir, exist_ok=True)
        base_name = os.path.basename(file_path).rsplit(".", 1)[0]
        thumb_path = os.path.join(thumb_dir, f"{base_name}_thumb.webp")

        with Image.open(file_path) as img:
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            img.save(thumb_path, "WEBP", quality=85)

        logger.info("Generated thumbnail: %s", thumb_path)
        return thumb_path
    except Exception as e:
        logger.error("Failed to generate thumbnail for %s: %s", file_path, e)
        return None


def dispatch_notification(notification_type: str, recipient: str, subject: str, message: str):
    """Simulate or execute email/SMS notification dispatch."""
    logger.info("Dispatched %s notification to %s: '%s'", notification_type, recipient, subject)
    return True


def run_worker():
    from app import create_app
    from app.extensions import redis_client

    app = create_app(os.getenv("FLASK_ENV", "production"))
    logger.info("Spiritual Commerce Background Worker started. Listening for tasks...")

    with app.app_context():
        while RUNNING:
            try:
                # Check redis queue if connected
                if redis_client.is_connected:
                    task_raw = redis_client.lpop("japam:worker:queue")
                    if task_raw:
                        task = json.loads(task_raw)
                        task_name = task.get("task")
                        logger.info("Processing background job: %s", task_name)
                        if task_name == "process_thumbnail":
                            process_image_thumbnail(task.get("path"))
                        elif task_name == "send_notification":
                            dispatch_notification(
                                task.get("type", "email"),
                                task.get("recipient"),
                                task.get("subject"),
                                task.get("message")
                            )
                time.sleep(1)
            except Exception as e:
                logger.error("Worker exception: %s", e)
                time.sleep(2)

    logger.info("Worker gracefully stopped.")


if __name__ == "__main__":
    run_worker()
