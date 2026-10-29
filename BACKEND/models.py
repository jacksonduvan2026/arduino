from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Producto(Base):
    __tablename__ = "productos"

    codigo = Column(String, primary_key=True, index=True)
    descripcion = Column(String, index=True)
    categoria = Column(String, index=True, nullable=True)
    stock_actual = Column(Float, default=0.0)
    unidad_medida = Column(String, default="Unidad")
    ubicacion = Column(String, default="Almacén Principal")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    no_orden = Column(String, index=True)
    fecha = Column(DateTime, index=True)
    valor_total_orden = Column(Float)
    moneda = Column(String)
    codigo_referencia = Column(String, index=True)
    descripcion_referencia = Column(String)
    cantidad = Column(Float)
    valor_total_ref = Column(Float)
    empresa = Column(String, index=True)
    ciudad = Column(String, index=True)
    categoria = Column(String, index=True, nullable=True)
    valor_unitario = Column(Float)

class ProductoAIncluir(Base):
    __tablename__ = "productos_a_incluir"

    codigo = Column(String, primary_key=True, index=True)
    descripcion = Column(String)
    categoria = Column(String, index=True, nullable=True)
    enero = Column(Float, nullable=True)
    febrero = Column(Float, nullable=True)
    marzo = Column(Float, nullable=True)
    abril = Column(Float, nullable=True)
    mayo = Column(Float, nullable=True)
    junio = Column(Float, nullable=True)
    julio = Column(Float, nullable=True)
    agosto = Column(Float, nullable=True)
    septiembre = Column(Float, nullable=True)
    octubre = Column(Float, nullable=True)
    noviembre = Column(Float, nullable=True)
    diciembre = Column(Float, nullable=True)

class Cronograma(Base):
    __tablename__ = "cronogramas"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    nombre = Column(String, default="Cronograma Cíclico Anual")
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    activo = Column(Boolean, default=True)
    estado = Column(String, default="ACTIVO") # ACTIVO, FINALIZADO, ARCHIVADO

    items = relationship("CronogramaItem", back_populates="cronograma", cascade="all, delete-orphan")

class CronogramaItem(Base):
    __tablename__ = "cronograma_items"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    cronograma_id = Column(Integer, ForeignKey("cronogramas.id"), index=True)
    semana = Column(Integer, index=True)
    codigo_referencia = Column(String, index=True)
    numero_conteo = Column(Integer, default=1) # 1 a 5
    fecha_programada = Column(DateTime, nullable=True)
    fecha_confirmacion = Column(DateTime, nullable=True)
    estado = Column(String, default="PROGRAMADO") # PROGRAMADO, PENDIENTE, COMPLETADO, ANULADO

    cronograma = relationship("Cronograma", back_populates="items")
    historial = relationship("HistorialConteo", back_populates="item", cascade="all, delete-orphan")

class HistorialConteo(Base):
    __tablename__ = "historial_conteos"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    cronograma_item_id = Column(Integer, ForeignKey("cronograma_items.id"), index=True)
    fecha_conteo = Column(DateTime, default=datetime.utcnow)
    cantidad_sistema = Column(Float, default=0.0)
    cantidad_fisica = Column(Float)
    diferencia = Column(Float)
    observaciones = Column(String, nullable=True)
    usuario = Column(String, default="Operador")

    item = relationship("CronogramaItem", back_populates="historial")

class UbicacionMapa(Base):
    __tablename__ = "ubicaciones_mapa"

    id = Column(String, primary_key=True, index=True) # e.g. "LOC_R1_C1"
    codigo_visible = Column(String, index=True) # e.g. "18"
    fila = Column(Integer, index=True) # 1 to 9
    columna = Column(Integer, index=True) # 1 to 7
    nivel = Column(String, default="SIN_NIVEL") # NIVEL_1, NIVEL_2, AMBOS, SIN_NIVEL
    producto_codigo = Column(String, ForeignKey("productos.codigo"), nullable=True, index=True)
    es_duplicado = Column(Boolean, default=False)
    nota_inconsistencia = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    producto = relationship("Producto")

class ParametrosSimulacion(Base):
    __tablename__ = "parametros_simulacion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre_config = Column(String, default="Default")
    velocidad_rover_ms = Column(Float, default=1.0)
    tiempo_pick_nivel_1_s = Column(Float, default=15.0)
    tiempo_pick_nivel_2_s = Column(Float, default=45.0) # 3x nivel 1
    salida_defecto_inicio = Column(String, default="SALIDA_1")
    salida_defecto_fin = Column(String, default="SALIDA_1")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RecorridoGuardado(Base):
    __tablename__ = "recorridos_guardados"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    fecha = Column(DateTime, default=datetime.utcnow)
    nombre = Column(String, default="Recorrido de Picking")
    salida_inicio = Column(String, default="SALIDA_1")
    salida_fin = Column(String, default="SALIDA_1")
    ubicaciones_json = Column(String)
    resultado_json = Column(String)
