from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI(
    title="Sistema de Inventario Cíclico",
    description="Sistema para administrar referencias y conteos semanales.",
    version="1.0.0"
)

# Configuración inicial del frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def inicio():
    return {
        "mensaje": "Bienvenido al Sistema de Inventario Cíclico",
        "estado": "Servidor funcionando"
    }


# ==========================================
# FUNCIÓN DEL CRONOGRAMA DE INVENTARIO CÍCLICO
# ==========================================
def generar_cronograma_inventario():
    num_referencias = 600
    conteos_por_ref = 5
    semanas_totales = 49
    cupo_semanal_normal = 62
    cupo_semana_final = 24
    min_distancia = 5  # Mínimo de semanas entre conteos del mismo ítem

    # Inicialización de datos
    referencias = [f"REF-{i+1:03d}" for i in range(num_referencias)]
    saldo = {ref: conteos_por_ref for ref in referencias}
    ultima_semana = {ref: -999 for ref in referencias}
    
    cronograma = {}

    for semana in range(1, semanas_totales + 1):
        semanas_restantes = semanas_totales - semana + 1
        meta_semana = cupo_semanal_normal if semana < semanas_totales else cupo_semana_final
        
        seleccionados_semana = set()

        # 1. Aplicar Cota de Urgencia (Deadlock Prevention)
        for ref in referencias:
            if saldo[ref] == semanas_restantes:
                seleccionados_semana.add(ref)

        # 2. Completar los cupos restantes con aleatoriedad y espaciamiento
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

        # 3. Actualizar estados
        for ref in seleccionados_semana:
            saldo[ref] -= 1
            ultima_semana[ref] = semana

        cronograma[f"Semana_{semana}"] = list(seleccionados_semana)

    return cronograma


def obtener_cronograma():
    cronograma_generado = generar_cronograma_inventario()
    return {
        "total_semanas": 49,
        "cronograma": cronograma_generado
    }
