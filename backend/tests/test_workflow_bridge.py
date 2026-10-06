"""Self-contained contract tests: no live database/credentials required."""
import sys
from types import ModuleType, SimpleNamespace

# The isolated workflow module must be testable without starting a PostgreSQL server.
for name, attr in [('app.core.deps', 'current_profile'), ('app.db.session', 'get_db')]:
    stub = ModuleType(name)
    setattr(stub, attr, lambda: None)
    sys.modules[name] = stub

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.models.workflow_models import WorkflowBase, DeviceEvent, WorkflowRecord
from app.routers.workflow import put_record, list_records, RecordBody, event_type


@pytest.fixture()
def db():
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    WorkflowBase.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def admin():
    return SimpleNamespace(id='admin-id'), SimpleNamespace(code='admin')


def test_create_maintenance_event_and_no_duplicate(db):
    device = {'id': 'dev-1', 'device_code': 'MED-2026-001', 'name': 'Máy đo demo',
              'current_status': 'operating', 'qr_token': 'd8a5ee07-84af-4cb4-93d7-f512b1a855ab'}
    assert put_record('devices', 'dev-1', RecordBody(payload=device), db, admin())['id'] == 'dev-1'
    assert len(list_records('devices', db, admin())) == 1
    maintenance = {'id': 'maint-1', 'device_id': 'dev-1', 'result': 'completed'}
    put_record('maintenance_records', 'maint-1', RecordBody(payload=maintenance), db, admin())
    put_record('maintenance_records', 'maint-1', RecordBody(payload=maintenance), db, admin())
    types = list(db.scalars(select(DeviceEvent.event_type)).all())
    assert types.count('DEVICE_REGISTERED') == 1
    assert types.count('MAINTENANCE_COMPLETED') == 1
    assert db.get(WorkflowRecord, ('maintenance_records', 'maint-1')).payload['result'] == 'completed'


def test_orphan_rejected(db):
    with pytest.raises(HTTPException) as error:
        put_record('repair_records','repair-1', RecordBody(payload={'id': 'repair-1', 'device_id': 'missing'}), db, admin())
    assert error.value.status_code == 422
    assert not db.scalars(select(DeviceEvent)).all()


def test_repair_transition_not_recounted():
    old = {'repair_status': 'reported'}
    done = {'repair_status': 'completed'}
    assert event_type('repair_records', old, done) == 'REPAIR_COMPLETED'
    assert event_type('repair_records', done, done) is None
    assert event_type('repair_records', None, old) is None


def test_actual_http_contract(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers import workflow
    app = FastAPI()
    app.include_router(workflow.router, prefix='/api')
    app.dependency_overrides[workflow.current_profile] = admin
    app.dependency_overrides[workflow.get_db] = lambda: db
    with TestClient(app) as client:
        payload = {'id': 'dev-http', 'device_code': 'MED-HTTP', 'name': 'Demo API',
                   'current_status': 'operating'}
        response = client.put('/api/records/devices/dev-http', json={'payload': payload})
        assert response.status_code == 200, response.text
        assert response.json()['qr_token']
        response = client.get('/api/records/devices')
        assert response.status_code == 200
        assert response.json()[0]['device_code'] == 'MED-HTTP'
        response = client.put('/api/records/unknown/1', json={'payload': {'id': '1'}})
        assert response.status_code == 404


def test_legacy_device_post_has_required_primary_key():
    # Its relational status vocabulary still differs from the React JSON bridge.
    from app.routers.devices import create_item
    class FakeSession:
        def add(self, obj): self.row = obj
        def commit(self): pass
        def refresh(self, obj): pass
        def rollback(self): pass
    session = FakeSession()
    created = create_item({'device_code': 'LEGACY-SMOKE', 'name': 'Device'}, session, admin())
    import uuid
    assert str(uuid.UUID(created.id)) == created.id
    assert created.device_code == 'LEGACY-SMOKE'


def test_analytics_refuses_old_snapshots_and_reads_only_fresh_batch(tmp_path, monkeypatch):
    import csv
    from app.routers.analytics import bigdata_results
    fake_config = ModuleType('app.core.config')
    fake_config.settings = SimpleNamespace(analytics_dir=str(tmp_path))
    monkeypatch.setitem(sys.modules, 'app.core.config', fake_config)
    with pytest.raises(HTTPException) as missing:
        bigdata_results(admin())
    assert missing.value.status_code == 503
    assert len(missing.value.detail['missing']) == 9
    names = ('lifecycle_event_summary', 'lifecycle_daily', 'device_activity',
             'device_received', 'device_transferred', 'maintenance_daily',
             'maintenance_by_device', 'repair_daily', 'repair_by_device')
    for name in names:
        with (tmp_path / (name + '.csv')).open('w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if name == 'lifecycle_event_summary':
                writer.writerow(['event_type', 'event_count'])
                writer.writerow(['DEVICE_REGISTERED', '1'])
            else:
                writer.writerow(['device_id', 'event_count'])
    result = bigdata_results(admin())
    assert result['source'] == 'spark_csv'
    assert result['datasets']['lifecycle_event_summary'] == [
        {'event_type': 'DEVICE_REGISTERED', 'event_count': '1'}
    ]
    assert set(result['datasets']) == set(names)
