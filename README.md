# Medical Device Management

Đây là đồ án môn học với đề tài: Hệ thống quản lý vòng đời thiết bị y tế (mua sắm → tiếp nhận → bảo trì → sửa chữa → điều chuyển → thanh lý) kèm pipeline phân tích dữ liệu lớn.

**Quy mô dữ liệu demo:** 10.002 thiết bị, 5.000.002 bản ghi sự kiện.

## Kiến trúc

| Thành phần | Công nghệ | Thư mục |
|---|---|---|
| Backend API | FastAPI, SQLAlchemy, Alembic, PostgreSQL | `backend/` |
| Frontend | React, TypeScript, Vite | `frontend/` |
| Big Data | Apache Spark (PySpark), dashboard | `bigdata-pipeline/` |

Chức năng chính: quản lý thiết bị, mã QR, mua sắm/đấu thầu, tiếp nhận, bảo trì, sửa chữa, điều chuyển, thanh lý, phân quyền người dùng, nhật ký audit, báo cáo và phân tích.

## Yêu cầu môi trường

- Docker Desktop
- Python 3.10+
- Node.js 18+
- PowerShell (Windows)
- Java 11/17 (nếu chạy Spark ngoài Docker)

## Cách chạy

### 1. Cấu hình

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Sửa các giá trị cần thiết trong `.env` (thông tin DB, secret key).

### 2. Chạy nhanh bằng script

```powershell
.\START_DEMO.ps1
```

- API docs: http://localhost:8000/docs
- Giao diện: http://localhost:5173

## Sinh dữ liệu lớn (10.002 thiết bị, 5.000.002 bản ghi)

Dữ liệu không đưa vào repo do dung lượng lớn, được sinh bằng script:

```powershell
.\SEED_BIG_10K.ps1
```

## Pipeline phân tích Spark

```powershell
cd bigdata-pipeline
pip install -r requirements.txt
python spark/run_demo_pipeline.py
```

Kết quả xuất ra `bigdata-pipeline/dashboard/data/`. Xem thêm `bigdata-pipeline/README.md`.

## Tài khoản demo

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Admin | `admin2@benhvien.local` | `Admin@123456` |

## Cấu trúc thư mục

```
backend/            API, models, migrations, scripts seed
frontend/           Giao diện web
bigdata-pipeline/   Spark jobs và dashboard
START_DEMO.ps1      Chạy nhanh toàn bộ demo
SEED_BIG_10K.ps1    Sinh 10.002 thiết bị và 5.000.003 bản ghi
```