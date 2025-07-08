# https://github.com/ultralytics/yolov5/issues/2995

from ultralytics import YOLO

model = YOLO('yolo11n.pt')

# to onnx
# model.export(format='onnx')
# yolo detect predict model="C:\Users\xurub\git_repos\test_video_pro\yolo11n.onnx" source="C:\Users\xurub\git_repos\test_video_pro\021.mp4" vid_stride=30

# to openvino
model.export(format="openvino", half=True)
 # imgsz=640 half
# yolo detect predict model=yolo11n_openvino_model source="C:\Users\xurub\git_repos\test_video_pro\021.mp4" vid_stride=30