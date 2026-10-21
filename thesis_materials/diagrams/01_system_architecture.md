# Figure: System Architecture (Bin Fill + IoT + Mobile)

**Suggested caption:**  
*Figure 1. Edge–cloud–mobile architecture for vision-based bin fill monitoring in VisionWaste (R26-IT-084).*

Copy the Mermaid block into [mermaid.live](https://mermaid.live) → Export PNG/SVG → insert in Word.

```mermaid
flowchart TB
  subgraph Edge["Edge node"]
    PIR["PIR HC-SR501\nGPIO 14"]
    CAM["ESP32-CAM OV2640\nUXGA JPEG"]
    DFP["DFPlayer Mini\nGPIO 13"]
    PIR -->|motion| CAM
    DFP -->|audio tracks| OUT["Speaker"]
  end

  subgraph Cloud["Cloud Railway"]
    GW["Express Gateway\nPOST /predict"]
    FILL["fill-api\nYOLOv8n best.pt"]
    DB[("Postgres/MySQL\ndevices · captures\ndevice_commands")]
    GW -->|multipart image| FILL
    FILL -->|Empty/Half/Overflow| GW
    GW --> DB
  end

  subgraph Clients["Clients"]
    WEB["Web Bin Level Detector"]
    APP["Flutter App\nPublic + Staff"]
  end

  CAM -->|HTTPS POST /predict\nsource_type=esp32| GW
  DB -->|GET /devices/commands| CAM
  CAM -->|PLAY_AUDIO ACK| DB
  APP -->|nearest · map · latest\ncollection/plan| GW
  WEB -->|optional upload| GW
```

## Text for thesis (short)

The system comprises three layers: (i) an ESP32-CAM edge node that captures JPEG frames on PIR motion and polls cloud commands for DFPlayer audio; (ii) a cloud gateway that invokes the fill-api YOLOv8n microservice and persists fill tiers; (iii) Flutter and web clients that consume device fill state for citizen nearest-bin guidance and staff collection planning.
