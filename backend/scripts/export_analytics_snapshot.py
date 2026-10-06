"""Export real workflow documents for Spark; no generated/example rows."""
import json
import sys
from pathlib import Path
from sqlalchemy import select
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
from app.db.session import SessionLocal
from app.models.workflow_models import WorkflowRecord
from app.models.db_models import Department

OUT = ROOT.parent / 'bigdata-pipeline' / 'input'
KINDS = ('devices','maintenance_records','repair_records','replacement_parts','purchase_records','reception_records')
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    with SessionLocal() as db:
        for kind in KINDS:
            dest = OUT / f'{kind}.jsonl'; tmp = dest.with_suffix('.jsonl.tmp')
            count = 0
            with tmp.open('w',encoding='utf-8') as f:
                for row in db.scalars(select(WorkflowRecord).where(WorkflowRecord.kind == kind).execution_options(yield_per=1000)):
                    f.write(json.dumps(row.payload,ensure_ascii=False,default=str)+'\n');count+=1
            tmp.replace(dest)
            print(f'{kind}: {count}')
        dest = OUT / 'departments.jsonl';tmp = dest.with_suffix('.jsonl.tmp')
        with tmp.open('w',encoding='utf-8') as f:
            for row in db.scalars(select(Department)):
                f.write(json.dumps({'id':str(row.id),'code':row.code,'name':row.name},ensure_ascii=False)+'\n')
        tmp.replace(dest)
if __name__ == '__main__':main()
