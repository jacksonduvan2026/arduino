import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional

def calcular_cuotas_semanales(num_referencias: int, counts_per_ref: int = 1, total_semanas: int = 52) -> Tuple[int, List[int]]:
    """
    Calcula las semanas totales y la cuota de asignaciones para cada semana según el número real N de referencias.
    Distribuye las asignaciones de forma equilibrada a lo largo del periodo.
    """
    total_asignaciones = num_referencias * counts_per_ref
    if total_asignaciones <= 0:
        return 1, [0]

    semanas = max(counts_per_ref, total_semanas)
    base_quota = total_asignaciones // semanas
    rem = total_asignaciones % semanas
    cuotas = [base_quota + 1] * rem + [base_quota] * (semanas - rem)

    return semanas, cuotas

def validar_cronograma_generado(
    cronograma: Dict[int, List[Dict[str, Any]]],
    referencias: List[str],
    cuotas_semanales: List[int],
    counts_per_ref: int = 5
) -> Tuple[bool, str]:
    """
    Valida rigurosamente que el cronograma cumpla con el 100% de las reglas de negocio.
    """
    set_refs = set(referencias)
    conteo_referencias = {ref: 0 for ref in referencias}
    total_items = 0

    for semana, items in cronograma.items():
        quota_esperada = cuotas_semanales[semana - 1]
        if len(items) != quota_esperada:
            return False, f"La semana {semana} tiene {len(items)} ítems, se esperaban {quota_esperada}."

        refs_semana = [it["codigo_referencia"] for it in items]
        if len(refs_semana) != len(set(refs_semana)):
            return False, f"Se detectaron referencias duplicadas en la semana {semana}."

        for ref in refs_semana:
            if ref not in set_refs:
                return False, f"La referencia {ref} en la semana {semana} no pertenece a las referencias elegibles."
            conteo_referencias[ref] += 1
            total_items += 1

    total_esperado = len(referencias) * counts_per_ref
    if total_items != total_esperado:
        return False, f"Total de asignaciones ({total_items}) no coincide con el objetivo ({total_esperado})."

    for ref, count in conteo_referencias.items():
        if count != counts_per_ref:
            return False, f"La referencia {ref} se programó {count} veces (objetivo: {counts_per_ref})."

    return True, "Cronograma validado exitosamente."

def generar_cronograma_algoritmo(
    referencias: List[str],
    fecha_inicio: Optional[datetime] = None,
    counts_per_ref: int = 1,
    seed: Optional[int] = None
) -> Tuple[Dict[int, List[Dict[str, Any]]], List[int], Dict[str, Any]]:
    """
    Algoritmo de planificación de inventario cíclico con restricciones y aleatoriedad controlada.
    """
    if seed is not None:
        random.seed(seed)

    N = len(referencias)
    if N == 0:
        raise ValueError("No hay referencias elegibles para generar el cronograma.")

    fecha_base = fecha_inicio or datetime.utcnow()
    total_semanas, cuotas = calcular_cuotas_semanales(N, counts_per_ref)

    saldo = {ref: counts_per_ref for ref in referencias}
    ultima_semana = {ref: -999 for ref in referencias}
    conteo_num = {ref: 0 for ref in referencias}

    cronograma = {}

    for semana in range(1, total_semanas + 1):
        semanas_restantes = total_semanas - semana + 1
        meta_semana = cuotas[semana - 1]
        fecha_prog_semana = fecha_base + timedelta(days=7 * (semana - 1))

        seleccionados_semana = set()

        # 1. Regla de Urgencia (Cota de Urgencia):
        # Si a una ref le faltan K conteos y quedan K semanas, DEBE programarse esta semana.
        for ref in referencias:
            if saldo[ref] == semanas_restantes:
                seleccionados_semana.add(ref)

        if len(seleccionados_semana) > meta_semana:
            raise ValueError(
                f"Incompatibilidad de restricciones: {len(seleccionados_semana)} referencias urgentes superan la cuota semanal de {meta_semana} en la semana {semana}."
            )

        # 2. Espaciamiento optimizado entre conteos de la misma referencia
        target_dist = math.floor(total_semanas / counts_per_ref) if counts_per_ref > 0 else 1
        if target_dist < 1:
            target_dist = 1

        distancia_actual = target_dist
        while len(seleccionados_semana) < meta_semana:
            candidatos = [
                ref for ref in referencias
                if ref not in seleccionados_semana
                and saldo[ref] > 0
                and (semana - ultima_semana[ref]) >= distancia_actual
            ]

            faltantes = meta_semana - len(seleccionados_semana)

            if len(candidatos) >= faltantes:
                elegidos = random.sample(candidatos, faltantes)
                seleccionados_semana.update(elegidos)
            else:
                if distancia_actual > 1:
                    distancia_actual -= 1
                else:
                    candidatos_emergencia = [
                        ref for ref in referencias
                        if ref not in seleccionados_semana and saldo[ref] > 0
                    ]
                    if len(candidatos_emergencia) < faltantes:
                        raise ValueError(f"No hay suficientes candidatos válidos para completar el cupo de la semana {semana}.")
                    elegidos = random.sample(candidatos_emergencia, faltantes)
                    seleccionados_semana.update(elegidos)

        # 3. Registrar asignaciones de la semana
        items_semana = []
        for ref in seleccionados_semana:
            saldo[ref] -= 1
            ultima_semana[ref] = semana
            conteo_num[ref] += 1
            items_semana.append({
                "codigo_referencia": ref,
                "numero_conteo": conteo_num[ref],
                "semana": semana,
                "fecha_programada": fecha_prog_semana
            })

        cronograma[semana] = items_semana

    # Validar el cronograma generado
    es_valido, msg_val = validar_cronograma_generado(cronograma, referencias, cuotas, counts_per_ref)
    if not es_valido:
        raise ValueError(f"Error de validación del algoritmo de cronograma: {msg_val}")

    resumen = {
        "num_referencias": N,
        "conteos_por_ref": counts_per_ref,
        "total_asignaciones": N * counts_per_ref,
        "total_semanas": total_semanas,
        "fecha_inicio": fecha_base,
        "fecha_fin_estimada": fecha_base + timedelta(days=7 * total_semanas),
        "cuotas_semanales": cuotas
    }

    return cronograma, cuotas, resumen
