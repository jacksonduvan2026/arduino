from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/arduino", tags=["Arduino Rover"])

class ComandoRoverRequest(BaseModel):
    accion: str # e.g. "MOVER_PASILLO", "DETENER", "GIRAR", "ENVIAR_RUTA"
    waypoints: Optional[List[str]] = None
    velocidad_pwm: Optional[int] = 0

@router.get("/status")
def get_arduino_status():
    return {
        "modulo": "Arduino Rover",
        "estado_conexion": "DESCONECTADO (Simulación Virtual Activa)",
        "hardware_status": "Simulación virtual activa en navegador. Motores físicos inactivos.",
        "puerto_com": None,
        "sensores_ir": {
            "sensor_izquierdo": {"estado": "SIMULADO", "valor_raw": 0},
            "sensor_centro": {"estado": "SIMULADO", "valor_raw": 0},
            "sensor_derecho": {"estado": "SIMULADO", "valor_raw": 0}
        },
        "motores": {
            "motor_izquierdo_pwm": 0,
            "motor_derecho_pwm": 0,
            "habilitado": False
        },
        "puntos_integracion_hardware": {
            "comunicacion_serie": "PySerial via /dev/ttyUSB0 o COM3 (Configurable)",
            "protocolo": "Comandos de texto plano sobre serie USB (ej. MOVE:W1,W2; PICK:LOC_R1_C1)",
            "seguridad": "Ejecución física deshabilitada por defecto en modo simulación virtual."
        },
        "mensaje": "La simulación se ejecuta virtualmente en el navegador. No se envían comandos de movimiento al hardware real."
    }

@router.post("/comando")
def enviar_comando_rover(cmd: ComandoRoverRequest):
    """
    Endpoint preparado para la integración futura con el hardware físico via puerto Serie/USB.
    En la fase actual no mueve motores físicos por seguridad y responde con simulación.
    """
    return {
        "status": "SIMULATED_OK",
        "accion": cmd.accion,
        "waypoints_recibidos": cmd.waypoints or [],
        "mensaje": "Comando procesado únicamente en entorno de simulación virtual. Hardware físico deshabilitado."
    }
