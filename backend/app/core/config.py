from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "MedDevice Backend"
    environment: str = "development"
    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://localhost:5174"
    analytics_dir: str = r"D:\Medical_Device_End_to_End_Demo_FIXED\bigdata-pipeline\dashboard\data\generated"
    admin_email: str = ""
    admin_password: str = ""
    admin_full_name: str = "System Administrator"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_list(self):
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

settings = Settings()

