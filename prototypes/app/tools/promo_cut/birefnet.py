# Вырезки для промо, шаг 1: главный объект на фото (BiRefNet, ONNX, на процессоре) → RGBA PNG в папку OUT.
# Модель: BiRefNet-general-epoch_244.onnx из релизов rembg (github.com/danielgatis/rembg/releases/tag/v0.0.0), путь — в BIREFNET.
# Запуск: BIREFNET=…/BiRefNet-general-epoch_244.onnx OUT=out python3 -I birefnet.py фото1.jpg фото2.jpg …  (по фото на запуск — меньше памяти)
import sys, os, time
import numpy as np
from PIL import Image
import onnxruntime as ort
MODEL = os.environ['BIREFNET']
OUT = os.environ.get('OUT', 'out'); os.makedirs(OUT, exist_ok=True)
so = ort.SessionOptions(); so.intra_op_num_threads = 3; so.enable_cpu_mem_arena = False; so.enable_mem_pattern = False
sess = ort.InferenceSession(MODEL, so, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0].name
def mask_of(im):
    x = im.convert('RGB').resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(x).astype(np.float32); a = a / max(a.max(), 1e-6)
    a = (a - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    a = a.transpose(2, 0, 1)[None].astype(np.float32)
    o = sess.run(None, {inp: a})[0][0, 0]
    p = 1 / (1 + np.exp(-o)); p = (p - p.min()) / max(p.max() - p.min(), 1e-6)
    return Image.fromarray((p * 255).astype(np.uint8), 'L').resize(im.size, Image.LANCZOS)
for path in sys.argv[1:]:
    name = os.path.splitext(os.path.basename(path))[0]
    dst = os.path.join(OUT, name + '.png')
    if os.path.exists(dst): continue
    t0 = time.time()
    im = Image.open(path).convert('RGB')
    if max(im.size) > 1600: im.thumbnail((1600, 1600), Image.LANCZOS)
    m = mask_of(im)
    rgba = im.copy(); rgba.putalpha(m); rgba.save(dst)
    print(name, im.size, '%.1fs' % (time.time() - t0), flush=True)
