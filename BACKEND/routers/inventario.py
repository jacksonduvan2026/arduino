from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import Optional, List
import io
import csv

from database import get_db
from models import Producto

router = APIRouter(prefix="/api/inventario", tags=["Inventario"])

class ProductoUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: Optional[float] = None
    unidad_medida: Optional[str] = None
    ubicacion: Optional[str] = None

class ProductoCreate(BaseModel):
    codigo: str
    descripcion: str
    categoria: Optional[str] = "General"
    stock_actual: Optional[float] = 0.0
    unidad_medida: Optional[str] = "Unidad"
    ubicacion: Optional[str] = "Almacén Principal"

@router.get("")
def list_inventario(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    q: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("codigo"),
    order: Optional[str] = Query("asc"),
    db: Session = Depends(get_db)
):
    query = db.query(Producto)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Producto.codigo.ilike(search_pattern),
                Producto.descripcion.ilike(search_pattern),
                Producto.categoria.ilike(search_pattern)
            )
        )

    if categoria and categoria != "TODAS":
        query = query.filter(Producto.categoria == categoria)

    total = query.count()

    # Ordenamiento
    sort_column = getattr(Producto, sort_by, Producto.codigo)
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Paginación
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    # Categorías para selector de filtros
    categorias_raw = db.query(func.distinct(Producto.categoria)).all()
    categorias = [c[0] for c in categorias_raw if c[0]]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        "categorias_disponibles": sorted(categorias),
        "items": [
            {
                "codigo": p.codigo,
                "descripcion": p.descripcion,
                "categoria": p.categoria or "General",
                "stock_actual": p.stock_actual,
                "unidad_medida": p.unidad_medida,
                "ubicacion": p.ubicacion,
                "updated_at": p.updated_at.strftime("%Y-%m-%d %H:%M") if p.updated_at else ""
            }
            for p in items
        ]
    }

@router.get("/{codigo}")
def get_producto(codigo: str, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.codigo == codigo).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {
        "codigo": p.codigo,
        "descripcion": p.descripcion,
        "categoria": p.categoria,
        "stock_actual": p.stock_actual,
        "unidad_medida": p.unidad_medida,
        "ubicacion": p.ubicacion,
        "created_at": p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else "",
        "updated_at": p.updated_at.strftime("%Y-%m-%d %H:%M") if p.updated_at else ""
    }

@router.post("")
def create_producto(p_data: ProductoCreate, db: Session = Depends(get_db)):
    existing = db.query(Producto).filter(Producto.codigo == p_data.codigo).first()
    if existing:
        raise HTTPException(status_code=400, detail="El código de producto ya existe")

    new_p = Producto(
        codigo=p_data.codigo,
        descripcion=p_data.descripcion,
        categoria=p_data.categoria or "General",
        stock_actual=p_data.stock_actual or 0.0,
        unidad_medida=p_data.unidad_medida or "Unidad",
        ubicacion=p_data.ubicacion or "Almacén Principal"
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return {"message": "Producto creado con éxito", "codigo": new_p.codigo}

@router.put("/{codigo}")
def update_producto(codigo: str, p_data: ProductoUpdate, db: Session = Depends(get_db)):
    p = db.query(Producto).filter(Producto.codigo == codigo).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if p_data.descripcion is not None:
        p.descripcion = p_data.descripcion
    if p_data.categoria is not None:
        p.categoria = p_data.categoria
    if p_data.stock_actual is not None:
        p.stock_actual = p_data.stock_actual
    if p_data.unidad_medida is not None:
        p.unidad_medida = p_data.unidad_medida
    if p_data.ubicacion is not None:
        p.ubicacion = p_data.ubicacion

    db.commit()
    return {"message": "Producto actualizado con éxito", "codigo": p.codigo}

@router.get("/export/csv")
def export_inventario_csv(
    q: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Producto)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Producto.codigo.ilike(search_pattern),
                Producto.descripcion.ilike(search_pattern)
            )
        )
    if categoria and categoria != "TODAS":
        query = query.filter(Producto.categoria == categoria)

    items = query.all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Codigo", "Descripcion", "Categoria", "Stock Actual", "Unidad Medida", "Ubicacion"])

    for p in items:
        writer.writerow([
            p.codigo,
            p.descripcion,
            p.categoria or "General",
            p.stock_actual,
            p.unidad_medida,
            p.ubicacion
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventario_export.csv"}
    )
