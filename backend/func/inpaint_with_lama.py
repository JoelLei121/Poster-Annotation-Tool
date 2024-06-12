import os
import torch
import numpy as np

# import pytorch_lightning

from saicinpainting.training.trainers import load_checkpoint
from saicinpainting.evaluation.data import pad_tensor_to_modulo
from saicinpainting.evaluation.utils import move_to_device
from omegaconf import OmegaConf
import yaml

MODEL_PATH = os.path.join('backend', 'static', 'best.ckpt')
CONFIG_PATH = os.path.join('backend', 'static', 'config.yaml')
IMAGE_PATH = "image.png"
MASK_PATH = "mask.png"

model = None
device = None

def norm_img(np_img):
    if len(np_img.shape) == 2:
        np_img = np_img[:, :, np.newaxis]
    np_img = np.transpose(np_img, (2, 0, 1))
    np_img = np_img.astype("float32") / 255
    return np_img

def init_model():
    global model
    global device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # device = torch.device("cpu")
    with open(CONFIG_PATH, 'r') as f:
        train_config = OmegaConf.create(yaml.safe_load(f))
        
    train_config.training_model.predict_only = True
    train_config.visualizer.kind = 'noop'

    model = load_checkpoint(train_config, MODEL_PATH, strict=False)
    model.freeze()
    model.to(device)
    model.eval()

@torch.no_grad()
def inpaint_with_lama(img, mask):
    # preprocess
    global model
    global device
    if model is None:
        init_model()

    img = torch.from_numpy(np.array(img)).float().div(255.)
    mask = torch.from_numpy(np.array(mask)).float()
    batch = {}
    batch['image'] = img.permute(2, 0, 1).unsqueeze(0)
    batch['mask'] = mask[None, None]
    unpad_to_size = [batch['image'].shape[2], batch['image'].shape[3]]
    batch['image'] = pad_tensor_to_modulo(batch['image'], 8)
    batch['mask'] = pad_tensor_to_modulo(batch['mask'], 8)
    batch = move_to_device(batch, device)
    batch['mask'] = (batch['mask'] > 0) * 1

    batch = model(batch)
    orig_height, orig_width = unpad_to_size
    cur_res = batch['inpainted'][0].permute(1, 2, 0)
    cur_res = cur_res[:orig_height, :orig_width]
    cur_res = cur_res.detach().cpu().numpy()
    cur_res = np.clip(cur_res * 255, 0, 255).astype('uint8')

    torch.cuda.empty_cache()
    return cur_res
    