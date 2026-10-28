import os
import sys
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

# Importar base de datos y routers
from database import engine, Base, get_db
from models import Venta
from services.import_service import importar_datos_excel
from routers import dashboard, inventario, ventas, productos_incluir, cronograma, reportes, arduino

# Crear las tablas en la base de datos si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Inventario Cíclico + Arduino Rover",
    description="Sistema web para gestión de inventarios cíclicos, análisis de ventas y control de rover Arduino.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir Routers API
app.include_router(dashboard.router)
app.include_router(inventario.router)
app.include_router(ventas.router)
app.include_router(productos_incluir.router)
app.include_router(cronograma.router)
app.include_router(reportes.router)
app.include_router(arduino.router)

# Importar automáticamente el Excel al iniciar si la BD está vacía
@app.on_event("startup")
def startup_db_check():
    db = next(get_db())
    if db.query(Venta).count() == 0:
        excel_file = "DATA FINAL ENTREGAR2026.xlsx"
        if os.path.exists(excel_file):
            importar_datos_excel(excel_file, db)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Sistema de Inventario Cíclico"}

@app.post("/api/admin/reimportar")
def reimportar_excel(db: Session = Depends(get_db)):
    excel_file = "DATA FINAL ENTREGAR2026.xlsx"
    if not os.path.exists(excel_file):
        raise HTTPException(status_code=404, detail="Archivo Excel no encontrado")
    res = importar_datos_excel(excel_file, db)
    return {"message": "Datos reimportados con éxito", "detalles": res}

# Configuración de Archivos Estáticos FRONTEND
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "FRONTEND"))
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def serve_frontend():
        index_file = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"mensaje": "Frontend no disponible aún en FRONTEND/index.html"}
