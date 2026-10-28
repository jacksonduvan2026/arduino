from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import Optional, List
import io
import csv

from database import get_db
from models import ProductoAIncluir

router = APIRouter(prefix="/api/productos-incluir", tags=["Productos a Incluir"])

class ProductoAIncluirUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    enero: Optional[float] = None
    febrero: Optional[float] = None
    marzo: Optional[float] = None
    abril: Optional[float] = None
    mayo: Optional[float] = None
    junio: Optional[float] = None
    julio: Optional[float] = None
    agosto: Optional[float] = None
    septiembre: Optional[float] = None
    octubre: Optional[float] = None
    noviembre: Optional[float] = None
    diciembre: Optional[float] = None

@router.get("")
def list_productos_a_incluir(
    q: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ProductoAIncluir)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                ProductoAIncluir.codigo.ilike(search_pattern),
                ProductoAIncluir.descripcion.ilike(search_pattern)
            )
        )

    if categoria and categoria != "TODAS":
        query = query.filter(ProductoAIncluir.categoria == categoria)

    items = query.all()

    result = []
    meses_cols = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

    for p in items:
        total_anual = sum([getattr(p, m) for m in meses_cols if getattr(p, m) is not None])
        meses_dict = {m: getattr(p, m) for m in meses_cols}
        result.append({
            "codigo": p.codigo,
            "descripcion": p.descripcion,
            "categoria": p.categoria or "General",
            "meses": meses_dict,
            "total_anual": total_anual
        })

    categorias = [c[0] for c in db.query(func.distinct(ProductoAIncluir.categoria)).all() if c[0]]

    return {
        "total": len(result),
        "categorias_disponibles": sorted(categorias),
        "items": result
    }

@router.put("/{codigo}")
def update_producto_a_incluir(codigo: str, data: ProductoAIncluirUpdate, db: Session = Depends(get_db)):
    p = db.query(ProductoAIncluir).filter(ProductoAIncluir.codigo == codigo).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto a incluir no encontrado")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(p, field, val)

    db.commit()
    return {"message": "Producto a incluir actualizado", "codigo": p.codigo}

@router.get("/export/csv")
def export_productos_incluir_csv(db: Session = Depends(get_db)):
    items = db.query(ProductoAIncluir).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Codigo", "Descripcion", "Categoria", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre", "Total Anual"])

    meses_cols = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

    for p in items:
        tot = sum([getattr(p, m) for m in meses_cols if getattr(p, m) is not None])
        writer.writerow([
            p.codigo,
            p.descripcion,
            p.categoria or "General",
            p.enero if p.enero is not None else "",
            p.febrero if p.febrero is not None else "",
            p.marzo if p.marzo is not None else "",
            p.abril if p.abril is not None else "",
            p.mayo if p.mayo is not None else "",
            p.junio if p.junio is not None else "",
            p.julio if p.julio is not None else "",
            p.agosto if p.agosto is not None else "",
            p.septiembre if p.septiembre is not None else "",
            p.octubre if p.octubre is not None else "",
            p.noviembre if p.noviembre is not None else "",
            p.diciembre if p.diciembre is not None else "",
            tot
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=productos_a_incluir_export.csv"}
    )
