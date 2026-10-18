# Verified Academic References (IEEE style)

Use these in your Reference list. Prefer the faculty-mandated style (IEEE or APA). DOIs/URLs verified via publisher or official project pages where possible.

---

## Core computer vision / YOLO

[1] G. Jocher, A. Chaurasia, and J. Qiu, “YOLO by Ultralytics,” version 8.0.0, Jan. 10, 2023. [Online]. Available: https://github.com/ultralytics/ultralytics

[2] J. Redmon, S. Divvala, R. Girshick, and A. Farhadi, “You Only Look Once: Unified, real-time object detection,” in *Proc. IEEE Conf. Comput. Vis. Pattern Recognit. (CVPR)*, 2016, pp. 779–788, doi: 10.1109/CVPR.2016.91.

[3] A. Bochkovskiy, C.-Y. Wang, and H.-Y. M. Liao, “YOLOv4: Optimal speed and accuracy of object detection,” *arXiv preprint arXiv:2004.10934*, 2020.

---

## Smart waste / bin monitoring (related work)

[4] M. A. Hannan *et al.*, “A review on technologies and their usage in solid waste monitoring and management systems: Issues and challenges,” *Waste Manage.*, vol. 43, pp. 509–523, 2015, doi: 10.1016/j.wasman.2015.05.033.

[5] T. Anagnostopoulos *et al.*, “Challenges and opportunities of waste management in IoT-enabled smart cities: A survey,” *IEEE Trans. Sustain. Comput.*, vol. 2, no. 3, pp. 275–289, 2017, doi: 10.1109/TSUSC.2017.2692968.

[6] F. Folianto, Y. S. Low, and W. L. Yeow, “Smartbin: Smart waste management system,” in *Proc. IEEE Tenth Int. Conf. Intell. Sensors, Sensor Netw. Inf. Process. (ISSNIP)*, 2015, pp. 1–2, doi: 10.1109/ISSNIP.2015.7106974.

[7] A. S. Wijaya, Z. Zainuddin, and M. Niswar, “Design a smart waste bin for smart waste management,” in *Proc. 5th Int. Conf. Instrum., Control, Autom. (ICA)*, 2017, pp. 62–66, doi: 10.1109/ICA.2017.8068414.

[8] N. Abdullah, O. A. Alwesabi, and R. Abdullah, “IoT-based smart waste management system in a smart city,” in *Advances in Intelligent Systems and Computing*, Springer, 2019, doi: 10.1007/978-3-319-99007-1_34.

[9] A. H. Vo *et al.*, “YOLO-based object detection for separate collection of recyclables and capacity monitoring of trash bins,” *Electronics*, vol. 11, no. 9, p. 1323, 2022, doi: 10.3390/electronics11091323.  
    [Online]. Available: https://www.mdpi.com/2079-9292/11/9/1323

---

## IoT / ESP32 / mobile

[10] Espressif Systems, “ESP32-CAM AI-Thinker,” Hardware reference. [Online]. Available: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/

[11] Flutter Team, “Flutter documentation,” Google. [Online]. Available: https://docs.flutter.dev/

[12] FastAPI, “FastAPI framework documentation.” [Online]. Available: https://fastapi.tiangolo.com/

---

## Dataset / tools

[13] B. Dwyer, J. Nelson, and J. Solawetz *et al.*, “Roboflow (Version 1.0),” 2022. [Online]. Available: https://roboflow.com  
    Dataset used: C. Edirisinghe, “Garbage_Fill_Level,” Roboflow Universe, v2. [Online]. Available: https://universe.roboflow.com/charuka-edirisinghe/garbage_fill_level/dataset/2

[14] G. Bradski, “The OpenCV Library,” *Dr. Dobb’s J. Softw. Tools*, 2000.

---

## Municipal / Sri Lanka context (optional cite if you discuss local waste)

[15] Central Environmental Authority (Sri Lanka), “National waste management policy / guidelines,” [Online]. Available: https://www.cea.lk (cite the specific PDF you actually download).

[16] United Nations Environment Programme, “Global Waste Management Outlook,” UNEP. [Online]. Available: https://www.unep.org

---

## How to cite YOUR metrics in text (examples)

- Method: “We fine-tuned YOLOv8n [1] on the Garbage_Fill_Level v2 dataset [13] …”  
- Related work contrast: “Unlike ultrasonic-only smart bins [6], [7], our approach estimates fill state from imagery, similar in spirit to vision-assisted recycling systems [9], but targeting Empty/Half/Overflow tiers for public bins.”  
- IoT: “Images are captured on an ESP32-CAM edge node [10] and inferred in a FastAPI microservice [12].”

---

## Integrity note

- Do not invent DOIs. If a DOI link fails, replace with the stable publisher URL.  
- Prefer citing papers you actually read.  
- Your Colab metrics are **empirical results**, not a citation — they go in Results, not References.
