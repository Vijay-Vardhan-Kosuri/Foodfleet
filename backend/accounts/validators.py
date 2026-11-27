import os
from django.conf import settings
from django.core.exceptions import ValidationError
from PIL import Image


def validate_uploaded_image(file):
    """Secure file upload validation for images (size, extension, Pillow header check)."""
    if file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError("Image file size cannot exceed 5 MB.")
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError("Unsupported image format. Allowed: JPG, JPEG, PNG, WEBP.")
    try:
        pos = file.tell()
        img = Image.open(file)
        img.verify()
        file.seek(pos)
    except Exception:
        raise ValidationError("Uploaded file is not a valid image.")


def validate_uploaded_document(file):
    """Secure validation for partner verification documents."""
    if file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError("Document size cannot exceed 5 MB.")
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in (".pdf", ".jpg", ".jpeg", ".png", ".webp"):
        raise ValidationError("Unsupported document format. Allowed: PDF, JPG, PNG, WEBP.")
