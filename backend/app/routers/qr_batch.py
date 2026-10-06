
from io import BytesIO

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import current_profile
from app.models.workflow_models import WorkflowRecord

router = APIRouter(prefix="/qr", tags=["qr-batch"])


@router.get("/image/{token}")
def qr_image(token: str):
    image = qrcode.make(token)

    buffer = BytesIO()
    image.save(buffer, "PNG")

    return Response(
        content=buffer.getvalue(),
        media_type="image/png"
    )


@router.post("/batch-print")
def batch_print(
    body: dict,
    db: Session = Depends(get_db),
    current=Depends(current_profile)
):
    device_ids = body.get("device_ids", [])

    if not isinstance(device_ids, list) or any(not isinstance(v, str) for v in device_ids):
        raise HTTPException(status_code=422, detail='device_ids must be a list of strings')
    if len(device_ids) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 QR per batch"
        )

    devices = [r.payload for r in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == 'devices', WorkflowRecord.id.in_(device_ids)).limit(100)).all()]

    return {
        "count": len(devices),
        "items": [
            {
                "id": d.get("id"),
                "device_code": d.get("device_code"),
                "name": d.get("name"),
                "qr_token": d.get("qr_token")
            }
            for d in devices
        ]
    }
