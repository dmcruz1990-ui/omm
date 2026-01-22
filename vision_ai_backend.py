
import cv2
import json
import requests
import numpy as np
from ultralytics import YOLO

class NexusVisionAI:
    def __init__(self, api_endpoint="http://localhost:3000/api/alerts"):
        # 1. Carga de Modelo YOLOv8-Pose (Nano para máxima velocidad)
        self.model = YOLO('yolov8n-pose.pt')
        self.api_endpoint = api_endpoint
        
        # Diccionario para persistencia temporal (Tracking ID -> Contador de frames)
        self.hand_raise_counters = {}
        self.FRAME_THRESHOLD = 30  # ~1.2 segundos a 25fps
        
        # Definición de Zona de Mesa (Polígono de interés)
        # En una implementación real, esto vendría de una base de datos de calibración
        self.table_zone = np.array([[100, 400], [500, 400], [600, 700], [0, 700]], np.int32)
        
    def detect_service_request(self, keypoints, track_id):
        """
        Analiza si la muñeca está por encima de la nariz.
        Keypoints YOLOv8-Pose: 0: Nariz, 9: Muñeca Izq, 10: Muñeca Der
        """
        if keypoints is None or len(keypoints) < 11:
            return False
            
        nose_y = keypoints[0][1] # y de la nariz
        left_wrist_y = keypoints[9][1]
        right_wrist_y = keypoints[10][1]
        
        # Lógica: ¿Alguna muñeca está físicamente más alta (menor valor Y) que la nariz?
        is_raising = left_wrist_y < nose_y or right_wrist_y < nose_y
        
        if is_raising:
            self.hand_raise_counters[track_id] = self.hand_raise_counters.get(track_id, 0) + 1
        else:
            self.hand_raise_counters[track_id] = 0
            
        return self.hand_raise_counters[track_id] >= self.FRAME_THRESHOLD

    def detect_object_interaction(self, boxes):
        """
        Simulación de detección de objetos (platos sucios) en la zona de la mesa.
        """
        # Placeholder: En producción, aquí filtraríamos por class_id de platos
        # y verificaríamos si el centro de la box está dentro del polígono self.table_zone
        return False

    def send_api_alert(self, table_id, alert_type, confidence):
        """Envía alerta JSON a la API de Nexus Geo"""
        payload = {
            "table": table_id,
            "type": alert_type,
            "confidence": float(confidence),
            "timestamp": "iso_timestamp_here"
        }
        print(f"[API ALERT] {json.dumps(payload)}")
        # requests.post(self.api_endpoint, json=payload) # Descomentar en prod

    def run(self, source=0):
        # model.track activa automáticamente BoT-SORT o ByteTrack
        # persist=True mantiene los IDs entre frames para re-identificación
        results = self.model.track(source=source, show=False, conf=0.5, persist=True)
        
        for result in results:
            frame = result.orig_img
            
            # Dibujar zona de mesa
            cv2.polylines(frame, [self.table_zone], True, (255, 255, 0), 2)
            
            if result.keypoints and result.boxes.id is not None:
                # Obtener keypoints y IDs de tracking
                keypoints_list = result.keypoints.xy.cpu().numpy()
                track_ids = result.boxes.id.int().cpu().tolist()
                confidences = result.boxes.conf.cpu().tolist()

                for i, track_id in enumerate(track_ids):
                    kp = keypoints_list[i]
                    
                    # 1. Chequeo de Gesto de Mano
                    if self.detect_service_request(kp, track_id):
                        # Visualización de Alerta
                        cv2.putText(frame, "ALERTA DE SERVICIO ACTIVA", (50, 50), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
                        
                        # Dibujar recuadro parpadeante (basado en paridad de frames)
                        if cv2.getTickCount() % 2 == 0:
                            cv2.rectangle(frame, (0,0), (frame.shape[1], frame.shape[0]), (0,0,255), 10)
                        
                        self.send_api_alert(table_id=1, alert_type="service_hand", confidence=confidences[i])

                    # 2. Dibujar Esqueleto (Opcional, YOLO ya lo hace en result.plot())
                    # Usamos el plotter nativo para ver el tracking ID y pose
                    frame = result.plot()

            cv2.imshow("Nexus VisionAI - Hospitality Suite", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cv2.destroyAllWindows()

# Comentarios sobre Re-Identificación (CTO Insights):
# 1. BoT-SORT: Usamos model.track(persist=True) para que YOLO combine la apariencia (ReID) 
#    con el movimiento (Kalman Filter). Si el cliente se tapa momentáneamente con un mesero, 
#    el ID se mantiene al re-aparecer.
# 2. Re-ID profunda: Para multi-cámaras, usaríamos un vector de características (embeddings) 
#    guardado en Redis para reconocer al cliente aunque cambie de cámara de CCTV.

if __name__ == "__main__":
    ai = NexusVisionAI()
    ai.run()
