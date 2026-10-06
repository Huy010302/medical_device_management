"""Seed 1000 demo devices and large event history safely."""
from __future__ import annotations
import argparse, random, sys, time, uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy import delete, func, insert, select

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.db.session import SessionLocal
from app.models.db_models import Device
from app.models.workflow_models import DeviceEvent, WorkflowRecord

DEMO_PREFIX="DEMO-DEV-"
NS=uuid.UUID("fa81c4d2-8785-4bb7-8ca8-260f42d1e8a1")
EVENT_TYPES=("DEVICE_REGISTERED","DEVICE_STATUS_CHANGED","DEVICE_RECEIVED","DEVICE_TRANSFERRED","MAINTENANCE_COMPLETED","REPAIR_COMPLETED","DEVICE_DISPOSED")
EVENT_WEIGHTS=(1,100,18,90,150,105,3)
NAMES=("Patient Monitor","Infusion Pump","Syringe Pump","Ventilator","ECG Machine","Ultrasound System","Defibrillator","Electrosurgical Unit","Anesthesia Machine","Pulse Oximeter","X-Ray System","Autoclave")
MFR=("Philips","GE Healthcare","Siemens Healthineers","Mindray","Drager","Nihon Kohden","B. Braun","Fresenius")
LOC=("ICU","Emergency","Operating Room","Cardiology","Radiology","Pediatrics","Internal Medicine","Outpatient","Laboratory","Recovery")
COUNTRIES=("Germany","USA","Japan","China","Netherlands","Switzerland")

def did(i): return f"{DEMO_PREFIX}{i:04d}"

def make_devices(n, seed):
    r=random.Random(seed); today=date.today(); rel=[]; wf=[]; ids=[]
    for i in range(1,n+1):
        x=did(i); ids.append(x); installed=today-timedelta(days=r.randint(30,3650))
        ws=installed; we=installed+timedelta(days=365*r.choice((1,2,3)))
        name=r.choice(NAMES); mf=r.choice(MFR); loc=r.choice(LOC)
        serial=f"SN{seed%10000:04d}{i:06d}"; asset=f"ASSET-{i:06d}"
        qr=uuid.uuid5(NS,f"qr:{x}"); model=f"{name.split()[0].upper()}-{r.randint(100,999)}"; country=r.choice(COUNTRIES)
        rel.append(dict(id=x,device_code=f"DEMO-{i:04d}",name=name,manufacturer=mf,model=model,origin_country=country,serial_number=serial,asset_code=asset,unit="unit",current_status="operational",current_location=loc,installation_date=installed,warranty_start=ws,warranty_end=we,qr_token=qr,notes="Synthetic demo record for Big Data presentation"))
        payload=dict(id=x,device_code=f"DEMO-{i:04d}",name=name,manufacturer=mf,model=model,origin_country=country,serial_number=serial,asset_code=asset,unit="unit",current_status="operating",current_location=loc,installation_date=installed.isoformat(),warranty_start=ws.isoformat(),warranty_end=we.isoformat(),qr_token=str(qr),notes="Synthetic demo record for Big Data presentation")
        wf.append(dict(kind="devices",id=x,payload=payload))
    return ids,rel,wf

def event_rows(ids,n,seed,batch,offset):
    r=random.Random(seed+batch*1000003); now=datetime.now(timezone.utc); start=now-timedelta(days=1460); span=int((now-start).total_seconds()); out=[]
    for j in range(n):
        gi=offset+j; x=r.choice(ids); et=r.choices(EVENT_TYPES,weights=EVENT_WEIGHTS,k=1)[0]
        meta={"source_table":"synthetic_demo","record_id":f"DEMO-EVT-{gi:09d}","synthetic":True,"location":r.choice(LOC),"severity":r.choice(("low","low","medium","medium","high")),"maintenance_type":None,"fault_category":None,"cost":None,"from_location":None,"to_location":None}
        if et=="MAINTENANCE_COMPLETED": meta["maintenance_type"]=r.choice(("preventive","calibration","inspection")); meta["cost"]=r.randint(200000,8000000)
        elif et=="REPAIR_COMPLETED": meta["fault_category"]=r.choice(("electrical","sensor","mechanical","software")); meta["cost"]=r.randint(500000,25000000)
        elif et=="DEVICE_TRANSFERRED": meta["from_location"]=r.choice(LOC); meta["to_location"]=r.choice(LOC)
        out.append({
             "id": str(uuid.uuid5(NS, f"event:{seed}:{gi}")),
            "device_id": x,
            "event_type": et,
            "timestamp": start + timedelta(seconds=r.randrange(span + 1)),
            "metadata": meta,
        })
    return out

def main():
    p=argparse.ArgumentParser(); p.add_argument("--devices",type=int,default=1000); p.add_argument("--events",type=int,default=500000); p.add_argument("--batch-size",type=int,default=5000); p.add_argument("--seed",type=int,default=20260925); p.add_argument("--reset-demo",action="store_true"); a=p.parse_args()
    t=time.time(); ids,rel,wf=make_devices(a.devices,a.seed)
    with SessionLocal() as db:
        if a.reset_demo:
            print("Removing previous DEMO seed only...")
            db.execute(delete(DeviceEvent).where(DeviceEvent.metadata_json["synthetic"].as_boolean()==True))
            db.execute(delete(WorkflowRecord).where(WorkflowRecord.kind=="devices",WorkflowRecord.id.like(f"{DEMO_PREFIX}%")))
            db.execute(delete(Device).where(Device.id.like(f"{DEMO_PREFIX}%"))); db.commit()
        db.execute(delete(WorkflowRecord).where(WorkflowRecord.kind=="devices",WorkflowRecord.id.in_(ids)))
        db.execute(delete(Device).where(Device.id.in_(ids))); db.commit()
        print(f"Seeding {a.devices:,} devices...")
        db.execute(insert(Device),rel); db.execute(insert(WorkflowRecord),wf); db.commit()
        print(f"Seeding {a.events:,} events in batches of {a.batch_size:,}...")
        done=batch=0
        while done<a.events:
            n=min(a.batch_size,a.events-done); rows=event_rows(ids,n,a.seed,batch,done)
            try:
                db.execute(insert(DeviceEvent.__table__), rows)
                db.commit()
            except Exception:
                db.rollback(); print(f"FAILED batch {batch+1}, events {done+1:,}-{done+n:,}"); raise
            done+=n; batch+=1
            if done%50000==0 or done==a.events: print(f"  {done:,} / {a.events:,} events")
        td=db.scalar(select(func.count()).select_from(Device)) or 0
        tw=db.scalar(select(func.count()).select_from(WorkflowRecord).where(WorkflowRecord.kind=="devices")) or 0
        te=db.scalar(select(func.count()).select_from(DeviceEvent)) or 0
        de=db.scalar(select(func.count()).select_from(DeviceEvent).where(DeviceEvent.metadata_json["synthetic"].as_boolean()==True)) or 0
    print("\nDONE"); print(f"Relational devices in DB : {td:,}"); print(f"Frontend device records  : {tw:,}"); print(f"All events in DB          : {te:,}"); print(f"Synthetic demo events     : {de:,}"); print(f"Elapsed                   : {time.time()-t:.1f}s")
if __name__=="__main__": main()
