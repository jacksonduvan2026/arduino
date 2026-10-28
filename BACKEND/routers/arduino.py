from fastapi import APIRouter

router = APIRouter(prefix="/api/arduino", tags=["Arduino Rover"])

@router.get("/status")
def get_arduino_status():
    return {
        "modulo": "Arduino Rover",
        "estado_conexion": "DESCONECTADO (Pendiente de configuración hardware)",
        "hardware_status": "Instalación de sensores IR y motores en proceso",
        "puerto_com": None,
        "sensores_ir": {
            "sensor_izquierdo": {"estado": "INACTIVO", "valor_raw": 0},
            "sensor_centro": {"estado": "INACTIVO", "valor_raw": 0},
            "sensor_derecho": {"estado": "INACTIVO", "valor_raw": 0}
        },
        "motores": {
            "motor_izquierdo_pwm": 0,
            "motor_derecho_pwm": 0,
            "habilitado": False
        },
        "mensaje": "El control de movimiento y la lectura física de sensores están deshabilitados hasta la conexión física del hardware."
    }
