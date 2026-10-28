import os
import pandas as pd
import math
import random
from datetime import datetime
from sqlalchemy.orm import Session
from models import Producto, Venta, ProductoAIncluir, Cronograma, CronogramaItem

def importar_datos_excel(filepath: str, db: Session):
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"El archivo {filepath} no existe.")

    # 1. Cargar DATA VENTAS (encabezado en fila index 2)
    df_ventas = pd.read_excel(filepath, sheet_name="DATA VENTAS", skiprows=2)

    # Limpiar base de datos de ventas previa
    db.query(Venta).delete()
    db.commit()

    ventas_objs = []
    productos_dict = {}

    for _, row in df_ventas.iterrows():
        # Código de referencia
        raw_code = str(row["Codigo de la referencia"]).strip()
        if raw_code.endswith(".0"):
            code = raw_code[:-2]
        else:
            code = raw_code
        code_str = f"REF-{int(code):03d}" if code.isdigit() else code

        # Descripción
        desc = str(row["Descripción de la referencia"]).strip() if pd.notnull(row["Descripción de la referencia"]) else "Sin Descripción"

        # Categoria (Si es #REF! o vacia, asignar Sin Categoría o derivar)
        cat_raw = str(row["Calegoria"]).strip() if pd.notnull(row["Calegoria"]) else ""
        categoria = "General" if cat_raw in ["#REF!", "nan", ""] else cat_raw

        # Guardar o actualizar diccionario de productos
        if code_str not in productos_dict:
            productos_dict[code_str] = {
                "codigo": code_str,
                "descripcion": desc,
                "categoria": categoria,
                "stock_actual": 0.0
            }

        # Manejo de fecha
        fecha_val = row["Fecha"]
        if isinstance(fecha_val, str):
            fecha_dt = pd.to_datetime(fecha_val).to_pydatetime()
        elif isinstance(fecha_val, datetime):
            fecha_dt = fecha_val
        elif hasattr(fecha_val, "to_pydatetime"):
            fecha_dt = fecha_val.to_pydatetime()
        else:
            fecha_dt = datetime.now()

        no_orden = str(int(row["No. de orden"])) if pd.notnull(row["No. de orden"]) and str(row["No. de orden"]).replace('.0','').isdigit() else str(row["No. de orden"])

        venta = Venta(
            no_orden=no_orden,
            fecha=fecha_dt,
            valor_total_orden=float(row["Valor total de la orden"]) if pd.notnull(row["Valor total de la orden"]) else 0.0,
            moneda=str(row["Denominación moneda"]).strip() if pd.notnull(row["Denominación moneda"]) else "COP",
            codigo_referencia=code_str,
            descripcion_referencia=desc,
            cantidad=float(row["Cantidad por referencia"]) if pd.notnull(row["Cantidad por referencia"]) else 0.0,
            valor_total_ref=float(row["Valor total de las referencias"]) if pd.notnull(row["Valor total de las referencias"]) else 0.0,
            empresa=str(row["Empresa"]).strip() if pd.notnull(row["Empresa"]) else "N/A",
            ciudad=str(row["Ciudad"]).strip() if pd.notnull(row["Ciudad"]) else "N/A",
            categoria=categoria,
            valor_unitario=float(row["Valor unitario mcia"]) if pd.notnull(row["Valor unitario mcia"]) else 0.0
        )
        ventas_objs.append(venta)

    db.bulk_save_objects(ventas_objs)

    # 2. Cargar PRODUCTOS A INCLUIR (encabezado en fila index 3)
    df_prod = pd.read_excel(filepath, sheet_name="PRODUCTOS A INCLUIR", skiprows=3)
    db.query(ProductoAIncluir).delete()
    db.commit()

    prod_incluir_objs = []
    for _, row in df_prod.iterrows():
        raw_code = str(row["CODIGO"]).strip()
        if raw_code.endswith(".0"):
            code = raw_code[:-2]
        else:
            code = raw_code
        code_str = f"REF-{int(code):03d}" if code.isdigit() else code

        desc = str(row["DESCRIPCIÓN"]).strip() if pd.notnull(row["DESCRIPCIÓN"]) else ""
        cat = str(row["CATEGORIA"]).strip() if pd.notnull(row["CATEGORIA"]) else "General"

        def get_m(col_name):
            val = row[col_name]
            return float(val) if pd.notnull(val) and not math.isnan(val) else None

        prod_inc = ProductoAIncluir(
            codigo=code_str,
            descripcion=desc,
            categoria=cat,
            enero=get_m("ENERO"),
            febrero=get_m("FEBRERO"),
            marzo=get_m("MARZO"),
            abril=get_m("ABRIL"),
            mayo=get_m("MAYO"),
            junio=get_m("JUNIO"),
            julio=get_m("JULIO"),
            agosto=get_m("AGOSTO"),
            septiembre=get_m("SEPTIEMBRE"),
            octubre=get_m("OCTUBRE"),
            noviembre=get_m("NOVIEMBRE"),
            diciembre=get_m("DICIEMBRE")
        )
        prod_incluir_objs.append(prod_inc)

        # Si el producto a incluir no está en productos, añadirlo
        if code_str not in productos_dict:
            productos_dict[code_str] = {
                "codigo": code_str,
                "descripcion": desc,
                "categoria": cat,
                "stock_actual": 0.0
            }
        else:
            # Si su categoría era #REF!, actualizar con la categoría real del producto a incluir
            if productos_dict[code_str]["categoria"] == "General":
                productos_dict[code_str]["categoria"] = cat

    db.bulk_save_objects(prod_incluir_objs)

    # 3. Guardar Productos en tabla Productos
    for code, pdata in productos_dict.items():
        existing = db.query(Producto).filter(Producto.codigo == code).first()
        if not existing:
            nuevo_prod = Producto(
                codigo=pdata["codigo"],
                descripcion=pdata["descripcion"],
                categoria=pdata["categoria"],
                stock_actual=pdata["stock_actual"]
            )
            db.add(nuevo_prod)
        else:
            existing.descripcion = pdata["descripcion"]
            if existing.categoria == "General" and pdata["categoria"] != "General":
                existing.categoria = pdata["categoria"]

    db.commit()

    # 4. Asegurar que existan las 600 referencias para el cronograma si es necesario
    tot_prods = db.query(Producto).count()
    if tot_prods < 600:
        for i in range(1, 601):
            ref_code = f"REF-{i:03d}"
            if not db.query(Producto).filter(Producto.codigo == ref_code).first():
                db.add(Producto(
                    codigo=ref_code,
                    descripcion=f"Referencia de Catálogo {i:03d}",
                    categoria="General",
                    stock_actual=0.0
                ))
        db.commit()

    # 5. Generar un cronograma inicial si no existe
    if db.query(Cronograma).count() == 0:
        generar_y_guardar_cronograma(db)

    return {
        "ventas_importadas": len(ventas_objs),
        "productos_a_incluir_importados": len(prod_incluir_objs),
        "total_productos_registrados": db.query(Producto).count()
    }

def generar_cronograma_algoritmo(num_referencias=600, conteos_por_ref=5, semanas_totales=49, cupo_semanal_normal=62, cupo_semana_final=24, min_distancia=5):
    referencias = [f"REF-{i+1:03d}" for i in range(num_referencias)]
    saldo = {ref: conteos_por_ref for ref in referencias}
    ultima_semana = {ref: -999 for ref in referencias}
    conteo_num = {ref: 0 for ref in referencias}

    cronograma = {}

    for semana in range(1, semanas_totales + 1):
        semanas_restantes = semanas_totales - semana + 1
        meta_semana = cupo_semanal_normal if semana < semanas_totales else cupo_semana_final

        seleccionados_semana = set()

        # 1. Cota de Urgencia
        for ref in referencias:
            if saldo[ref] == semanas_restantes:
                seleccionados_semana.add(ref)

        # 2. Completar cupos
        distancia_actual = min_distancia
        while len(seleccionados_semana) < meta_semana:
            candidatos = [
                ref for ref in referencias
                if ref not in seleccionados_semana
                and saldo[ref] > 0
                and (semana - ultima_semana[ref]) >= distancia_actual
            ]

            cupos_faltantes = meta_semana - len(seleccionados_semana)

            if len(candidatos) >= cupos_faltantes:
                elegidos = random.sample(candidatos, cupos_faltantes)
                seleccionados_semana.update(elegidos)
            else:
                if distancia_actual > 1:
                    distancia_actual -= 1
                else:
                    candidatos_emergencia = [
                        ref for ref in referencias
                        if ref not in seleccionados_semana and saldo[ref] > 0
                    ]
                    elegidos = random.sample(candidatos_emergencia, cupos_faltantes)
                    seleccionados_semana.update(elegidos)

        # 3. Actualizar estado e historial
        items_semana = []
        for ref in seleccionados_semana:
            saldo[ref] -= 1
            ultima_semana[ref] = semana
            conteo_num[ref] += 1
            items_semana.append({
                "codigo_referencia": ref,
                "numero_conteo": conteo_num[ref]
            })

        cronograma[semana] = items_semana

    return cronograma

def generar_y_guardar_cronograma(db: Session, nombre="Cronograma Cíclico Anual"):
    # Desactivar cronogramas anteriores
    db.query(Cronograma).update({"activo": False})

    nuevo_crono = Cronograma(nombre=nombre, activo=True)
    db.add(nuevo_crono)
    db.commit()
    db.refresh(nuevo_crono)

    cronograma_dict = generar_cronograma_algoritmo()

    items_objs = []
    for semana, lista_items in cronograma_dict.items():
        for item in lista_items:
            crono_item = CronogramaItem(
                cronograma_id=nuevo_crono.id,
                semana=semana,
                codigo_referencia=item["codigo_referencia"],
                numero_conteo=item["numero_conteo"],
                estado="PROGRAMADO"
            )
            items_objs.append(crono_item)

    db.bulk_save_objects(items_objs)
    db.commit()
    return nuevo_crono
