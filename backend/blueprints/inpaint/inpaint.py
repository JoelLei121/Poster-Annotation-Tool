from flask import Blueprint, request, send_file
from PIL import Image
import io
from backend.db import get_db
import base64
from random import randint
from backend.func.inpaint_with_lama import inpaint_with_lama

inpaint_bp = Blueprint('inpaint', __name__, url_prefix='/inpaint')

# get inpainted image, else return original
@inpaint_bp.get("/<image_id>")
def get_inpaint_image(image_id):
    db = get_db()
    res = db.execute("SELECT data, name FROM InpaintImage WHERE image_id=(?)", (image_id,)).fetchone()
    if res is None:
        res = db.execute("SELECT data, name FROM Image WHERE id=(?)", (image_id,)).fetchone()
    
    image_bytes = io.BytesIO(res[0])
    return send_file(image_bytes, download_name=res[1])


@inpaint_bp.post("/<image_id>")
def inpaint(image_id):
    data = request.get_json()
    data = data['mask'].split(',')[1]
    mask = Image.open(io.BytesIO(base64.b64decode(data))).convert("L")
    
    mask.save("mask.png")

    # read image from db
    db = get_db()
    res = db.execute("SELECT data, name FROM InpaintImage WHERE image_id=(?)", (image_id,)).fetchone()
    if res is None:
        res = db.execute("SELECT data, name FROM Image WHERE id=(?)", (image_id,)).fetchone()
        if res is None:
            return f"image {image_id} not found", 404
    filename = 'out_' + res[1]
    image = Image.open(io.BytesIO(res[0])).convert("RGB")

    try:
        inpainted = inpaint_with_lama(image, mask)
        inpainted = Image.fromarray(inpainted)
        inpainted.save("result.png")

        # save to db
        blob = io.BytesIO()
        inpainted.save(blob, "PNG")

        cursor = db.cursor()
        query_string = '''
            SELECT * 
            FROM InpaintImage AS i 
            WHERE i.image_id = {id}
            '''.format(id=image_id)
        res = cursor.execute(query_string).fetchone()
        # print(res)
        if res is not None:
            query_string = '''
                UPDATE InpaintImage
                SET data = ?
                WHERE image_id = {id};
            '''.format(id = image_id)
            cursor.execute(query_string, (blob.getvalue(),))
        else:
            cursor.execute(
                "INSERT INTO InpaintImage (image_id, name, data) VALUES (?, ?, ?)",
                (image_id, filename, blob.getvalue())
            )
        db.commit()

    except RuntimeError as e:
        print(e)
        return "Inpaint failed", 502

    return 'ok', 200

@inpaint_bp.delete("/<image_id>")
def delete_inpaint_image(image_id):
    db = get_db()
    cursor = db.cursor()
    query_string = '''
            DELETE FROM InpaintImage
            WHERE image_id = ?
        '''
    res = cursor.execute(query_string, (image_id,))
    db.commit()
    return 'ok', 200

@inpaint_bp.post("/download/<image_id>")
def download_image(image_id):

    db = get_db()
    res = db.execute("SELECT data, name FROM InpaintImage WHERE image_id=(?)", (image_id,)).fetchone()
    if res is None:
        return f"image {image_id} not found", 404
    filename = 'out_' + res[1]
    image = Image.open(io.BytesIO(res[0])).convert("RGBA")

    # Save or display the result
    # composite.show()  # or composite.save("path_to_save_result.png")
    image.save(f'{randint(0,1000)}inpaint.png', )
    return 'ok', 200