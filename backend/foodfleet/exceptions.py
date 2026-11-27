from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Consistent, safe API error responses without leaking internal stack traces."""
    response = exception_handler(exc, context)
    if response is not None:
        detail = response.data
        if isinstance(detail, dict) and "detail" in detail:
            message = str(detail["detail"])
        elif isinstance(detail, list) and detail:
            message = str(detail[0])
        else:
            message = "Request validation failed."
        response.data = {
            "success": False,
            "message": message,
            "errors": response.data,
        }
        return response
    return Response(
        {"success": False, "message": "An unexpected server error occurred."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
