from flask import Blueprint, request, send_file, url_for
from PIL import Image
import io, json, zipfile, os
from backend.db import get_db
from backend.func.text_detector import get_image_elem

gallery_bp = Blueprint('gallery', __name__, url_prefix='/gallery')

@gallery_bp.get("/")
def get_all_galleries():
    db = get_db()
    cursor = db.cursor()
    query_string = '''
            SELECT id, name
            FROM Gallery
        '''
    res = cursor.execute(query_string).fetchall()
    all_galleries = {int(row[0]): row[1] for row in res}
    return all_galleries



@gallery_bp.post("/")
def create_gallery():
    db = get_db()
    cursor = db.cursor()
    name = request.json['name']
    print(name)
    query_string = '''
            INSERT INTO Gallery (name) 
            VALUES (?)
        '''
    res = cursor.execute(query_string, (name,))
    db.commit()
    last_id = cursor.lastrowid
    return {'id': last_id}

@gallery_bp.put("/")
def merge_galleries():
    db = get_db()
    cursor = db.cursor()
    # print(request.json)
    merge_list = request.json['merge']
    merge_list = [int(e) for e in merge_list]
    dest = int(request.json['dest'])
    
    placeholders = ', '.join('?' for _ in merge_list)
    # print(placeholders, merge_list, dest)
    print((dest, *merge_list))
    query_string = '''
            UPDATE Image
            SET gallery_id = ?
            WHERE gallery_id IN ({placeholders});
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, (dest, *merge_list))
    db.commit()

    if 0 in merge_list:
        merge_list.remove(0)
    if dest in merge_list:
        merge_list.remove(dest)
    placeholders = ', '.join('?' for _ in merge_list)

    query_string = '''
            DELETE FROM Gallery
            WHERE id IN ({placeholders})
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, (*merge_list,))
    db.commit()
    return 'ok', 200

@gallery_bp.delete("/")
def delete_galleries():
    db = get_db()
    cursor = db.cursor()
    id_list = request.json['id']
    id_list = [int(e) for e in id_list]
    if 0 in id_list:
        id_list.remove(0)
    print(id_list)
    placeholders = ', '.join('?' for _ in id_list)

    query_string = '''
            DELETE FROM Gallery
            WHERE id IN ({placeholders})
        '''.format(placeholders=placeholders)
    res = cursor.execute(query_string, (id_list))
    db.commit()
    return 'ok', 200


@gallery_bp.get("/<id>")
def get_thumbnail(id):
    db = get_db()
    cursor = db.cursor()
    query_string = '''
            SELECT data
            FROM Image
            WHERE gallery_id = ?
        '''
    res = cursor.execute(query_string, (id,)).fetchone()
    if(res):
        return send_file(io.BytesIO(res[0]), download_name=f'{id}_thumbnail.png')
    return send_file('static/default.jpg')

@gallery_bp.patch("/<id>")
def rename_gallery(id):
    db = get_db()
    cursor = db.cursor()
    name = request.json['name']
    query_string = '''
            UPDATE Gallery
            SET name = ?
            WHERE id = ?;
        '''
    res = cursor.execute(query_string, (name, id))
    db.commit()

    return 'ok', 200

@gallery_bp.get("/num")
def get_gallery_count():
    db = get_db()
    cursor = db.cursor()
    query_string = '''
            SELECT id
            FROM Gallery
        '''
    res = cursor.execute(query_string).fetchall()

    gallery_count = {}
    for row in res:
        num = cursor.execute("SELECT COUNT(*) FROM Image WHERE gallery_id = ?", (row[0],)).fetchone()
        if num is None:
            num = 0
        gallery_count[row[0]] = num[0]

    return gallery_count

@gallery_bp.get("/export")
def export_galleries():
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
    
    # get image
    with zipfile.ZipFile('./data/file.zip', 'w') as zipf:
        for gallery_id in id_list:
            query_string = '''
                SELECT id
                FROM Image
                WHERE gallery_id = ?
            '''
            res = db.execute(query_string, (gallery_id,)).fetchall()
            all_image_id = [row[0] for row in res]

            query_string = '''
                SELECT name
                FROM Gallery
                WHERE id = ?
            '''
            res = db.execute(query_string, (gallery_id,)).fetchone()
            gallery_name = res[0]

            placeholders = ', '.join('?' for _ in all_image_id)
            query_string = '''
                SELECT image_id, name, data 
                FROM InpaintImage 
                WHERE image_id IN ({placeholders})
            '''.format(placeholders=placeholders)
            res = db.execute(query_string, (all_image_id)).fetchall()
            all_inpaint_image = [dict(row) for row in res]

            # write images into a folder
            for image in all_inpaint_image:
                # get boxes
                query_string = '''
                        SELECT b.id, b.top, b.left, b.width, b.height, b.angle, b.category, b.content
                        FROM Element AS b
                        WHERE b.image_id = {id};
                    '''.format(id = image['image_id'])
                res = db.execute(query_string)
                all_boxes = [dict(row) for row in res]

                if (len(all_boxes) == 0):
                    continue

                im = io.BytesIO(image['data'])
                zipf.writestr('{gal}/{id}_{name}'.format(gal=gallery_name, name=image['name'], id=image['image_id']), im.getvalue())

                image_data = {}
                image_data['id'] = image['image_id']
                image_data['name'] = image['name']
                image_data['gallery'] = gallery_name
                pack['images'].append(image_data)

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

@gallery_bp.get('/<id>/elem')
def getAllElemCount(id): 
    db = get_db()
    cursor = db.cursor()
    db = get_db()
    query_string = '''
            SELECT id
            FROM Image as i
            WHERE i.gallery_id = {id};
        '''.format(id = id)
    res = cursor.execute(query_string).fetchall()
    all_image = [row[0] for row in res]

    cnt = {}
    placeholders = ', '.join('?' for _ in all_image)
    query_string = '''
            SELECT COUNT(b.id)
            FROM Element AS b
            WHERE b.image_id IN ({placeholders}) AND b.category = ?;
        '''.format(placeholders=placeholders)
    for item in ['text', 'logo', 'underlay']:
        num = cursor.execute(query_string, (*all_image, item)).fetchone()
        if num is None:
            num = 0
        cnt[item] = num[0]
    return cnt