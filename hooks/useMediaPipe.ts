
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

const mapHandToWorld = (x: number, y: number): THREE.Vector3 => {
  const GAME_X_RANGE = 5; 
  const GAME_Y_RANGE = 3.5;
  const Y_OFFSET = 0.8;
  const worldX = (0.5 - x) * GAME_X_RANGE; 
  const worldY = (1.0 - y) * GAME_Y_RANGE - (GAME_Y_RANGE / 2) + Y_OFFSET;
  const worldZ = -Math.max(0, worldY * 0.2);
  return new THREE.Vector3(worldX, Math.max(0.1, worldY), worldZ);
};

export const useMediaPipe = (videoRef: React.RefObject<HTMLVideoElement | null>, enabled: boolean = false) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handPositionsRef = useRef<{
    left: THREE.Vector3 | null;
    right: THREE.Vector3 | null;
    lastLeft: THREE.Vector3 | null;
    lastRight: THREE.Vector3 | null;
    leftVelocity: THREE.Vector3;
    rightVelocity: THREE.Vector3;
    lastTimestamp: number;
  }>({
    left: null,
    right: null,
    lastLeft: null,
    lastRight: null,
    leftVelocity: new THREE.Vector3(0,0,0),
    rightVelocity: new THREE.Vector3(0,0,0),
    lastTimestamp: 0
  });

  const lastResultsRef = useRef<HandLandmarkerResult | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  const retry = useCallback(() => {
    setError(null);
    setRetryCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let isActive = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        if (!isActive) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (!isActive) {
             landmarker.close();
             return;
        }

        landmarkerRef.current = landmarker;
        await startCamera();
      } catch (err) {
        console.error("MediaPipe Init Error:", err);
        setError(`Error de inicialización: ${(err as Error).message}`);
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
             if (isActive) {
                 setIsCameraReady(true);
                 setError(null);
                 predictWebcam();
             }
          };
        }
      } catch (err) {
        console.error("Camera Error:", err);
        const error = err as Error;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setError("Permiso Denegado: Por favor, activa el acceso a la cámara en tu navegador.");
        } else {
          setError(`Error de Cámara: ${error.message || "No se pudo acceder."}`);
        }
      }
    };

      const videoElement = videoRef.current;

      const predictWebcam = () => {
        if (!videoElement || !landmarkerRef.current || !isActive) return;

        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
             const startTimeMs = performance.now();
             try {
                 const results = landmarkerRef.current.detectForVideo(videoElement, startTimeMs);
                 lastResultsRef.current = results;
                 processResults(results);
             } catch {
                 // Frame skip
             }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
      };

      const processResults = (results: HandLandmarkerResult) => {
          const now = performance.now();
          const deltaTime = (now - handPositionsRef.current.lastTimestamp) / 1000;
          handPositionsRef.current.lastTimestamp = now;

          let newLeft: THREE.Vector3 | null = null;
          let newRight: THREE.Vector3 | null = null;

          if (results.landmarks) {
            for (let i = 0; i < results.landmarks.length; i++) {
              const landmarks = results.landmarks[i];
              const classification = results.handedness[i][0];
              const isRight = classification.categoryName === 'Right'; 
              const tip = landmarks[8];
              const worldPos = mapHandToWorld(tip.x, tip.y);

              if (isRight) { newRight = worldPos; } else { newLeft = worldPos; }
            }
          }

          const s = handPositionsRef.current;
          const LERP = 0.6; 

          if (newLeft) {
              if (s.left) {
                  newLeft.lerpVectors(s.left, newLeft, LERP);
                  if (deltaTime > 0.001) { s.leftVelocity.subVectors(newLeft, s.left).divideScalar(deltaTime); }
              }
              s.lastLeft = s.left ? s.left.clone() : newLeft.clone();
              s.left = newLeft;
          } else { s.left = null; }

          if (newRight) {
               if (s.right) {
                   newRight.lerpVectors(s.right, newRight, LERP);
                   if (deltaTime > 0.001) { s.rightVelocity.subVectors(newRight, s.right).divideScalar(deltaTime); }
               }
               s.lastRight = s.right ? s.right.clone() : newRight.clone();
               s.right = newRight;
          } else { s.right = null; }
      };

      setupMediaPipe();

      return () => {
        isActive = false;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (landmarkerRef.current) landmarkerRef.current.close();
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoElement.srcObject = null;
        }
        setIsCameraReady(false);
      };
  }, [enabled, videoRef, retryCount]);

  return { isCameraReady, handPositionsRef, lastResultsRef, error, retry };
};
