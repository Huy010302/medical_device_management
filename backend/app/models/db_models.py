from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import uuid

class Base(DeclarativeBase):
    pass

class AuthUser(Base):
    __tablename__ = "auth_users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Department(Base):
    __tablename__ = "departments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Profile(Base):
    __tablename__ = "profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth_users.id", ondelete="CASCADE"), primary_key=True)
    username: Mapped[str | None] = mapped_column(String, unique=True)
    full_name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class DeviceCategory(Base):
    __tablename__ = "device_categories"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class DeviceStatus(Base):
    __tablename__ = "device_statuses"
    value: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("device_categories.id"))
    manufacturer: Mapped[str | None] = mapped_column(String)
    model: Mapped[str | None] = mapped_column(String)
    origin_country: Mapped[str | None] = mapped_column(String)
    serial_number: Mapped[str | None] = mapped_column(String)
    asset_code: Mapped[str | None] = mapped_column(String)
    unit: Mapped[str | None] = mapped_column(String)
    current_status: Mapped[str | None] = mapped_column(String, ForeignKey("device_statuses.value"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    current_location: Mapped[str | None] = mapped_column(String)
    installation_date: Mapped[object | None] = mapped_column(Date)
    warranty_start: Mapped[object | None] = mapped_column(Date)
    warranty_end: Mapped[object | None] = mapped_column(Date)
    qr_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    maintenance_type: Mapped[str | None] = mapped_column(String)
    scheduled_date: Mapped[object | None] = mapped_column(Date)
    actual_date: Mapped[object | None] = mapped_column(Date)
    performed_by: Mapped[str | None] = mapped_column(String)
    service_company: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(String)
    cost: Mapped[object | None] = mapped_column(Numeric)
    next_maintenance_date: Mapped[object | None] = mapped_column(Date)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

class RepairRecord(Base):
    __tablename__ = "repair_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    report_date: Mapped[object | None] = mapped_column(Date)
    fault_category: Mapped[str | None] = mapped_column(String)
    fault_description: Mapped[str | None] = mapped_column(Text)
    repair_start_date: Mapped[object | None] = mapped_column(Date)
    repair_end_date: Mapped[object | None] = mapped_column(Date)
    technician: Mapped[str | None] = mapped_column(String)
    repair_company: Mapped[str | None] = mapped_column(String)
    total_cost: Mapped[object | None] = mapped_column(Numeric)
    repair_status: Mapped[str | None] = mapped_column(String)

class ReplacementPart(Base):
    __tablename__ = "replacement_parts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    repair_record_id: Mapped[str] = mapped_column(String, ForeignKey("repair_records.id", ondelete="CASCADE"))
    part_name: Mapped[str | None] = mapped_column(String)
    part_code: Mapped[str | None] = mapped_column(String)
    quantity: Mapped[int | None] = mapped_column(Integer)
    unit_price: Mapped[object | None] = mapped_column(Numeric)
    vendor: Mapped[str | None] = mapped_column(String)
    replacement_date: Mapped[object | None] = mapped_column(Date)

class TransferRecord(Base):
    __tablename__ = "transfer_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    transfer_date: Mapped[object | None] = mapped_column(Date)
    from_location: Mapped[str | None] = mapped_column(String)
    to_location: Mapped[str | None] = mapped_column(String)
    reason: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String)

class DisposalRecord(Base):
    __tablename__ = "disposal_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    disposal_date: Mapped[object | None] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(Text)
    disposal_method: Mapped[str | None] = mapped_column(String)
    book_value: Mapped[object | None] = mapped_column(Numeric)
    disposal_value: Mapped[object | None] = mapped_column(Numeric)

class TenderingRecord(Base):
    __tablename__ = "tendering_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tender_code: Mapped[str] = mapped_column(String, unique=True)
    tender_name: Mapped[str] = mapped_column(String)
    tender_date: Mapped[object | None] = mapped_column(Date)
    winning_vendor: Mapped[str | None] = mapped_column(String)
    estimated_value: Mapped[object | None] = mapped_column(Numeric)
    tender_status: Mapped[str | None] = mapped_column(String)

class PurchaseRecord(Base):
    __tablename__ = "purchase_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tender_id: Mapped[str | None] = mapped_column(String, ForeignKey("tendering_records.id"))
    contract_number: Mapped[str | None] = mapped_column(String)
    vendor_name: Mapped[str | None] = mapped_column(String)
    purchase_date: Mapped[object | None] = mapped_column(Date)
    total_value: Mapped[object | None] = mapped_column(Numeric)
    status: Mapped[str | None] = mapped_column(String)

class ReceptionRecord(Base):
    __tablename__ = "reception_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    device_id: Mapped[str] = mapped_column(String, ForeignKey("devices.id", ondelete="CASCADE"))
    purchase_id: Mapped[str | None] = mapped_column(String, ForeignKey("purchase_records.id"))
    reception_date: Mapped[object | None] = mapped_column(Date)
    installation_date: Mapped[object | None] = mapped_column(Date)
    warranty_start: Mapped[object | None] = mapped_column(Date)
    warranty_end: Mapped[object | None] = mapped_column(Date)
