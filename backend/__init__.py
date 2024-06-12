import os, sys
sys.path.append(os.path.join(os.getcwd(), 'backend', 'lama'))
from flask import Flask, Blueprint
from flask_cors import CORS
from .blueprints.inpaint.inpaint import inpaint_bp
from .blueprints.image.image import image_bp
from .blueprints.gallery.gallery import gallery_bp


def create_app():
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'db.sqlite'),
    )

    app.config.from_pyfile('config.py', silent=True)

    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    from . import db
    db.init_app(app)
    CORS(app, expose_headers=['Custom-Field'])

    app.register_blueprint(image_bp)
    app.register_blueprint(inpaint_bp)
    app.register_blueprint(gallery_bp)
    
    return app