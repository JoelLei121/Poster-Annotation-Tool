from flask import Blueprint, request, send_file, make_response
import io, json, zipfile, os, cv2, base64
import numpy as np
from PIL import Image
from backend.db import get_db
from backend.func.text_detector import get_image_elem, merge_elems
from backend.func.underlay_detector import detect_underlay
from random import randint

image_bp = Blueprint('image', __name__, url_prefix='/image')

'''
    level: all_image
'''
@image_bp.get("/")
def get_all_images():
    db = get_db()
    gallery_id = request.args.get('gallery', 0)
    query_string = '''
            SELECT id
            FROM Image as i
            WHERE i.gallery_id = {id};
        '''.format(id = gallery_id)
    res = db.execute(query_string).fetchall()
    all_image = [row[0] for row in res]
    return all_image

# text detection of images
@image_bp.put("/")
def generate_images_elem():
    db = get_db()
    cursor = db.cursor()

    # get exist images
    id_list = request.json['id']
    placeholders = ', '.join('?' for _ in id_list)
    query_string = '''
            SELECT i.id, i.data
            FROM Image as i
            WHERE i.id NOT IN (
                SELECT image_id FROM Element
            ) AND i.id IN ({placeholders})
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, (id_list)).fetchall()
    images_in_byte = [row[1] for row in res]
    images_id = [row[0] for row in res]
    print(images_id)
    if(len(images_id) <= 0):
        return 'ok', 200

    # 
    # elem_groups = get_all_images_elem(images_in_byte)
    for image_id, image_byte in zip(images_id, images_in_byte):
        elem_list = get_image_elem(image_byte)
        if len(elem_list) <= 0:
            continue
        insert_tuples = [(image_id, e['top'], e['left'], e['width'], e['height'], e['angle'], e['category'], e['content']) for e in elem_list]
        cursor.executemany(
            "INSERT INTO Element (image_id, top, left, width, height, angle, category, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            insert_tuples
        )
        db.commit()
    return 'ok', 200


# underlay detection
@image_bp.put("/underlay")
def get_underlay():
    db = get_db()
    cursor = db.cursor()

    id_list = request.json['id']
    placeholders = ', '.join('?' for _ in id_list)
    query_string = '''
            SELECT i.id, i.data
            FROM Image as i
            WHERE i.id NOT IN (
                SELECT e.image_id 
                FROM Element as e
                WHERE e.category = (?)
            ) AND i.id IN ({placeholders})
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, ("underlay", *id_list)).fetchall()
    images_in_byte = [io.BytesIO(row[1]) for row in res]
    images_id = [row[0] for row in res]
    print(images_id)

    if(len(images_id) <= 0):
        return 'ok', 200
    
    for image_id, image_bytes in zip(images_id, images_in_byte):
        query_string = '''
                SELECT COUNT(b.id)
                FROM Element AS b
                WHERE b.image_id = {id} AND b.category = ?;
            '''.format(id = image_id)
        num = cursor.execute(query_string, ('underlay',)).fetchone()
        # print(num[0])
        if num[0] > 0:
            continue
        
        query_string = '''
                SELECT b.id, b.top, b.left, b.width, b.height, b.angle, b.category, b.content
                FROM Element AS b
                WHERE b.image_id = {id};
            '''.format(id = image_id)
        res = cursor.execute(query_string)
        all_boxes = [dict(row) for row in res]
        if(len(all_boxes) <= 0):
            continue

        underlays = detect_underlay(image_bytes.getvalue(), all_boxes)

        if len(underlays) <= 0:
            continue

        insert_tuples = [(image_id, e['top'], e['left'], e['width'], e['height'], e['angle'], e['category'], e['content']) for e in underlays]
        cursor.executemany(
            "INSERT INTO Element (image_id, top, left, width, height, angle, category, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            insert_tuples
        )
        db.commit()

    return 'ok', 200


@image_bp.get("/export")
def export_images():
    db = get_db()
    categories = [
        {'supercategory': 'logo', 'id': 1, 'name': 'logo'},
        {'supercategory': 'title', 'id': 2, 'name': 'logo'},
        {'supercategory': 'text', 'id': 3, 'name': 'logo'},
        {'supercategory': 'underlay', 'id': 4, 'name': 'logo'}
    ]
    pack = { "images": [], "annotations": [], "categories": categories }

    id_list = request.args.getlist('id')
    placeholders = ', '.join('?' for _ in id_list)
    
    if not os.path.exists('./data'):
        os.makedirs('./data')
        
    if os.path.isfile('./data/file.zip'):
        os.remove('./data/file.zip')

    # get image
    with zipfile.ZipFile('./data/file.zip', 'a') as zipf:
        query_string = '''
            SELECT image_id, name, data 
            FROM InpaintImage 
            WHERE image_id IN ({placeholders})
        '''.format(placeholders=placeholders)
        res = db.execute(query_string, (id_list)).fetchall()
        all_image = [dict(row) for row in res]

        for image in all_image:
            im = io.BytesIO(image['data'])
            zipf.writestr('{id}_{name}'.format(name=image['name'], id=image['image_id']), im.getvalue())

            image_data = {}
            image_data['id'] = image['image_id']
            image_data['name'] = image['name']
            pack['images'].append(image_data)

            # get boxes
            query_string = '''
                    SELECT b.id, b.top, b.left, b.width, b.height, b.angle, b.category, b.content
                    FROM Element AS b
                    WHERE b.image_id = {id};
                '''.format(id = image['image_id'])
            res = db.execute(query_string)
            all_boxes = [dict(row) for row in res]

            boxes_data = []
            for box in all_boxes:
                box_data = {}
                box_data['image_id'] = image['image_id']
                box_data['bbox'] = [box['left'], box['top'], box['width'], box['height'], box['angle']]
                for category in categories:
                    if category['supercategory'] == box['category']:
                        box_data['category_id'] = category['id']
                boxes_data.append(box_data)

            pack['annotations'].append(boxes_data)

    with open('./data/data.json', 'w') as f:
        json.dump(pack, f)

    # write json file
    with zipfile.ZipFile('./data/file.zip', 'a') as zipf:
        zipf.write('./data/data.json', 'data.json')
    os.remove('./data/data.json')
    return send_file('../data/file.zip', as_attachment=True)

'''
    level: image
'''
@image_bp.get("/<image_id>")
def get_image(image_id):
    db = get_db()
    res = db.execute("SELECT name, data FROM Image WHERE id=(?)", (image_id,)).fetchone()
    if res is None:
        return f"Image {image_id} not found", 404
    
    filename = res[0]
    image_bytes = io.BytesIO(res[1])
    return send_file(image_bytes, download_name=filename)

@image_bp.post("/new")
def add_images():
    print("add image")
    db = get_db()
    # update database
    files = request.files.getlist("files[]")
    if len(files) < 1:
        print("empty file")
        return f"empty file", 404
    # print(files)

    gallery_id = request.args.get('gallery')
    cursor = db.cursor()
    images = []
    for f in files:
        try:
            f_bytes = f.stream.read()
            cursor.execute(
                "INSERT INTO Image (name, data, gallery_id) VALUES (?, ?, ?)",
                (f.filename, f_bytes, gallery_id)
            )
            last_id = cursor.lastrowid
            images.append(last_id)
        except db.IntegrityError:
            print("failed to add image")
            return f"failed to add image", 404
    db.commit()
    return {'images': images}

@image_bp.delete("/")
def delete_images():
    db = get_db()
    cursor = db.cursor()
    id_list = request.json['id']
    id_list = [int(e) for e in id_list]
    print(id_list)
    placeholders = ', '.join('?' for _ in id_list)

    query_string = '''
            DELETE FROM Image
            WHERE id IN ({placeholders})
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, (id_list))
    db.commit()
    return 'ok', 200

@image_bp.patch("/")
def move_images_gallery():
    db = get_db()
    cursor = db.cursor()
    id_list = request.json['id']
    id_list = [int(e) for e in id_list]
    gallery = request.json['gallery']
    print(id_list)
    placeholders = ', '.join('?' for _ in id_list)

    query_string = '''
            UPDATE Image
            SET gallery_id = ?
            WHERE id in ({placeholders})
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, (gallery, *id_list))
    db.commit()
    return 'ok', 200

'''
    level: elem
'''

@image_bp.get("/<image_id>/elem")
def get_image_boxes(image_id):
    db = get_db()
    cursor = db.cursor()
    res = cursor.execute("SELECT id, data FROM Image WHERE id = {id}".format(id = image_id)).fetchone()
    if res is None:
        return []
    
    image_id = res[0]
    query_string = '''
            SELECT b.id, b.top, b.left, b.width, b.height, b.angle, b.category, b.content
            FROM Element AS b
            WHERE b.image_id = {id};
        '''.format(id = image_id)
    res = db.execute(query_string)
    all_boxes = {row[0]: dict(row) for row in res}
    # print(len(all_boxes), all_boxes)
    
    return all_boxes

@image_bp.put("/<image_id>/elem")
def modify_image_boxes(image_id):
    data = request.get_json()
    # print(data)
    db = get_db()
    cursor = db.cursor()
    query_string = '''
            UPDATE Element
            SET top = ?, left = ?, width = ?, height = ?, angle = ?, category = ?, content = ?
            WHERE id = {id};
        '''
    # try:
    for (id, box) in data.items():
        cursor.execute(
            query_string.format(id=id),
            (box['top'], box['left'], box['width'], box['height'], box['angle'], box['category'], box['content'])
        )
        # print(id, box['category'])
    db.commit()
    # except Exception:
    #     return f"failed to update boxes", 404 
    return 'ok'

# add one box only
@image_bp.post("/<image_id>/elem")
def add_image_boxes(image_id):
    db = get_db()
    cursor = db.cursor()
    box = request.get_json()
    res = cursor.execute(
                "INSERT INTO Element (image_id, top, left, width, height, angle, category, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (image_id, box['top'], box['left'], box['width'], box['height'], box['angle'], box['category'], box['content'])
            )
    last_id = cursor.lastrowid
    db.commit()
    return {'id': last_id}

@image_bp.delete("/<image_id>/elem")
def remove_image_boxes(image_id):
    db = get_db()
    cursor = db.cursor()
    data = request.get_json()
    if len(data) < 1:
        return 'ok'
    print('delete:', data)

    placeholders = ', '.join('?' for _ in data)
    query = f"DELETE FROM Element WHERE id IN ({placeholders})"
    res = cursor.execute(query, data)
    db.commit()
    return 'ok'

@image_bp.post("/elem/")
def concat_boxes():
    db = get_db()
    cursor = db.cursor()
    print(request.json)
    id_list = request.json['id']
    id_list = [int(e) for e in id_list]

    placeholders = ', '.join('?' for _ in id_list)
    query_string = '''
            SELECT image_id, top, left, width, height, angle, category, content
            FROM Element
            WHERE id IN ({placeholders});
        '''.format(placeholders = placeholders)
    res = db.execute(query_string, (id_list)).fetchall()
    all_elems = [dict(row) for row in res]
    image_id = all_elems[0]['image_id']

    return 'ok', 200

    for i in range(len(all_elems)):
        elem = all_elems[i]
        angle = float(elem['angle'])
        center = (float(elem['left']) + 0.5 * float(elem['width']), float(elem['top']) + 0.5 * float(elem['height']))
        size = (float(elem['width']), float(elem['height']))
        # print(center, size, angle)
        rect = cv2.RotatedRect(center, size, angle)
        all_elems[i]['coords'] = cv2.boxPoints(rect).astype(np.int32)

    box = merge_elems(all_elems)

    res = cursor.execute(
                "INSERT INTO Element (image_id, top, left, width, height, angle, category, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (image_id, box['top'], box['left'], box['width'], box['height'], box['angle'], box['category'], box['content'])
            )

    query_string = f"DELETE FROM Element WHERE id IN ({placeholders})"
    res = cursor.execute(query_string, (id_list))
    db.commit()

    return 'ok', 200


@image_bp.post("/download/<image_id>")
def download_image(image_id):
    data = request.get_json()
    mask_str = data['mask'].split(',')[1]
    mask = Image.open(io.BytesIO(base64.b64decode(mask_str))).convert("RGBA")

    db = get_db()
    res = db.execute("SELECT data, name FROM Image WHERE id=(?)", (image_id,)).fetchone()
    if res is None:
        return f"image {image_id} not found", 404
    filename = 'out_' + res[1]
    image = Image.open(io.BytesIO(res[0])).convert("RGBA")
    mask = mask.resize(image.size)

    # Ensure the mask has an alpha channel
    # You can skip this step if your mask is already RGBA
    r, g, b, alpha = mask.split()
    mask = Image.merge("RGBA", (r, g, b, alpha))

    # Composite the mask over the image
    # print('test')
    composite = Image.alpha_composite(image, mask)

    # Save or display the result
    # composite.show()  # or composite.save("path_to_save_result.png")
    composite.save(f'{randint(0,1000)}default.png', )

    # res = make_response(send_file(composite.tobytes(), as_attachment=True, download_name=filename, mimetype="image/png"))
    # # res = make_response()
    # res.headers['Custom-Field'] = filename
    # print(res.headers)
    return 'ok', 200
    return res