import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "inventario.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def ejecutar_migraciones_seguras():
    from sqlalchemy import inspect, text
    with engine.connect() as conn:
        inspector = inspect(conn)

        # 1. productos.activo
        if "productos" in inspector.get_table_names():
            cols_prod = [c["name"] for c in inspector.get_columns("productos")]
            if "activo" not in cols_prod:
                conn.execute(text("ALTER TABLE productos ADD COLUMN activo BOOLEAN DEFAULT 1"))

        # 2. cronogramas.fecha_inicio, estado
        if "cronogramas" in inspector.get_table_names():
            cols_crono = [c["name"] for c in inspector.get_columns("cronogramas")]
            if "fecha_inicio" not in cols_crono:
                conn.execute(text("ALTER TABLE cronogramas ADD COLUMN fecha_inicio DATETIME"))
            if "estado" not in cols_crono:
                conn.execute(text("ALTER TABLE cronogramas ADD COLUMN estado VARCHAR DEFAULT 'ACTIVO'"))

        # 3. cronograma_items.fecha_programada, fecha_confirmacion
        if "cronograma_items" in inspector.get_table_names():
            cols_item = [c["name"] for c in inspector.get_columns("cronograma_items")]
            if "fecha_programada" not in cols_item:
                conn.execute(text("ALTER TABLE cronograma_items ADD COLUMN fecha_programada DATETIME"))
            if "fecha_confirmacion" not in cols_item:
                conn.execute(text("ALTER TABLE cronograma_items ADD COLUMN fecha_confirmacion DATETIME"))

        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
