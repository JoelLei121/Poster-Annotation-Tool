This is a graduation project, a poster annotation tool for poster layout generation.

## Frontend

### Installation
```
cd web_app
npm install
```
### Usage
run at local server:
```
npm run dev
```

## Backend

`python 3.10.6` with `CUDA 11.2` and `cuDNN 8.1`.

### Installation
create virtaul environment:
```
python -m venv ./backend/venv
cd backend/venv/Scripts
activate
```
install requirement:
```
cd ../..
pip install --no-cache-dir torch==2.2.2+cu118 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
```
### Usage
run at local server:
```
cd ..
flask --app backend run
```


## Citation
If you find this work useful for your research, please cite us.
```
@software{Guerra_Poster-Annotation-Tool_2024,
    author = {Guerra, Joel},
    doi = {10.5281/zenodo.11617861},
    month = jun,
    title = {{Poster-Annotation-Tool}},
    url = {https://github.com/JoelLei121/Poster-Annotation-Tool},
    version = {1.0.0},
    year = {2024}
}
```