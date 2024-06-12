import keras_ocr
import matplotlib.pyplot as plt
import io, numpy as np
import os
from functools import cmp_to_key
import cv2, random
import tensorflow as tf
import gc

os.environ['TF_GPU_ALLOCATOR'] = 'cuda_malloc_async'
os.environ["MEMORY_GROWTH"] = "1"
keras_ocr.config.configure()

IMG_PATH = 'test.jpg'

pipeline = None
PRECISION = 2
TEXT_ANGLE_THRESHOLD = 2

DEBUG = False
DEEP_DEBUG = False

def display(mat, name=None):
    if name is None:
        name = random.randint(1000, 9999)
        name = str(int(name))
    cv2.namedWindow(name)
    cv2.imshow(name, mat)

def calcBox(item, content = None):
    res = {}
    res['category'] = 'text'
    if content:
        res['content'] = content
        res['coords'] = item
        coords = item
    else:
        res['content'] = item[0]
        res['coords'] = item[1]
        coords = item[1]
    # print(coords)
    vec_a, vec_b, vec_d, vec_c = coords
    # print(vec_a, vec_b, vec_d, vec_c)

    ab = vec_b - vec_a
    cd = vec_d - vec_c
    # print(ab, cd)
    ab_dir = ab / np.linalg.norm(ab)

    k_ab = ab[1] / ab[0]
    ab_angle = np.arctan(k_ab) / np.pi * 180
    k_cd = cd[1] / cd[0]
    cd_angle = np.arctan(k_cd) / np.pi * 180
    # print(ab_angle, cd_angle)
    angle = ab_angle if abs(ab_angle) < abs(cd_angle) else cd_angle
    # if abs(angle) <= TEXT_ANGLE_THRESHOLD:
    #     angle = np.float16(0)

    upperleft = vec_a
    ca = vec_a - vec_c
    t_c = ca.dot(ab_dir)
    cp = ab_dir * t_c
    if np.cross(cp, ca) > 0:
        upperleft = vec_a - cp

    upperright = vec_b
    db = vec_b - vec_d
    t_d = db.dot(ab_dir)
    dp = ab_dir * t_d
    if np.cross(db, dp) > 0:
        upperright = vec_b - dp
    width = np.linalg.norm(upperright - upperleft)

    bp = dp - db
    ap = cp - ca
    height = max(np.linalg.norm(ap), np.linalg.norm(bp))

    res['left'] = upperleft[0]
    res['top'] = upperleft[1]
    res['width'] = width
    res['height'] = height
    res['angle'] = angle
    return res


# for one image
def get_image_elem(image_byte):
    global pipeline
    if pipeline == None: 
        init_pipeline()
    read_image = keras_ocr.tools.read(io.BytesIO(image_byte))
    prediction_groups = pipeline.recognize([read_image])[0]

    im = cv2.imdecode(np.frombuffer(image_byte, dtype=np.uint8), cv2.IMREAD_COLOR)
    if DEBUG:
        im_boxes = im.copy()
        for item in prediction_groups:
            rect_points = item[1].reshape(-1, 1, 2)
            rect = cv2.minAreaRect(rect_points)
            box = cv2.boxPoints(rect).astype(np.int32)
            i = random.randint(0,5)
            # color = (255 * (i & 1), 255 * (i & 2), 255 * (i & 4))
            color = (255,255,0)
            cv2.drawContours(im_boxes, [box], -1, color, 2)
        # cv2.imwrite('baseline1.png', im_boxes)
        im_boxes = cv2.resize(im_boxes, (700, 960))
        display(im_boxes)
        cv2.waitKey()
        cv2.destroyAllWindows()

    box_data = [calcBox(item) for item in prediction_groups]

    if len(box_data) <= 0:
        return []
    
    new_boxes = []
    # search and merge
    while len(box_data) > 0:
        target = box_data.pop(0)
        has_merge = False
        target_coords = []
        target_coords.extend(target['coords'])
        while True:
            has_merge = False
            min_dist = np.inf
            min_dist_box = -1
            SKIP = False
            for i in range(len(box_data)):
                # check if can merge
                temp, dist = is_near_elems(target, box_data[i])
                
                if DEBUG and DEEP_DEBUG and (not SKIP):
                    im_boxes = im.copy()
                    rect_points = np.array(target['coords'], dtype=np.float32).reshape(-1, 1, 2)
                    rect = cv2.minAreaRect(rect_points)
                    cv2.drawContours(im_boxes, [cv2.boxPoints(rect).astype(np.int32)], -1, (255,255,0), 1)
                    rect_points = np.array(box_data[i]['coords'], dtype=np.float32).reshape(-1, 1, 2)
                    rect = cv2.minAreaRect(rect_points)
                    cv2.drawContours(im_boxes, [cv2.boxPoints(rect).astype(np.int32)], -1, (0,0,0), 1)
                    im_boxes = cv2.resize(im_boxes, (700, 960))
                    display(im_boxes)
                    key = cv2.waitKey()
                    if key == 27:
                        SKIP = True
                    cv2.destroyAllWindows()

                # if is_near_elems(target, box_data[i]):
                if temp:
                    has_merge = True
                    if dist < min_dist:
                        min_dist = dist
                        min_dist_box = i

            if has_merge:
                target_coords.extend(box_data[min_dist_box]['coords'])
                target = merge_two_elems(target, box_data[min_dist_box], target_coords)
                box_data.pop(min_dist_box)
                if DEBUG and DEEP_DEBUG:
                    im_boxes = im.copy()
                    rect_points = np.array(target['coords'], dtype=np.float32).reshape(-1, 1, 2)
                    rect = cv2.minAreaRect(rect_points)
                    box = cv2.boxPoints(rect).astype(np.int32)
                    cv2.drawContours(im_boxes, [box], -1, (0,0,0), 1)
                    im_boxes = cv2.resize(im_boxes, (700, 960))
                    display(im_boxes)
                    cv2.waitKey()
                    cv2.destroyAllWindows()
                    SKIP = False
            else:
                new_boxes.append(target)
                break

    new_boxes = [elem_to_string(e) for e in new_boxes]

    # sentences = get_sentences(box_data)

    # if DEBUG:
    #     im_boxes = im.copy()
    #     for i in range(len(sentences)):
    #         color = (255*(i%3), 255*((i+1)%3), 255*((i+2)%3))
    #         for elem in sentences[i]:
    #             rect_points = np.array(elem['coords'], dtype=np.float32).reshape(-1, 1, 2)
    #             rect = cv2.minAreaRect(rect_points)
    #             box = cv2.boxPoints(rect).astype(np.int32)
    #             # cv2.putText(im_boxes, str(i), (box[0][0]-10, box[0][1]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,0), 3)
    #             cv2.drawContours(im_boxes, [box], -1, color, 2)
    #     im_boxes = cv2.resize(im_boxes, (700, 960))
    #     display(im_boxes)
    #     cv2.waitKey()
    #     cv2.destroyAllWindows()


    # new_boxes = [merge_elems(group, im) for group in sentences]

    if DEBUG:
        im_boxes = im.copy()
        for item in new_boxes:
            rect_points = np.array(item['coords'], dtype=np.float32).reshape(-1, 1, 2)
            rect = cv2.minAreaRect(rect_points)
            box = cv2.boxPoints(rect).astype(np.int32)
            i = random.randint(1,5)
            # color = (255 * (i & 1), 255 * (i & 2), 255 * (i & 4))
            color = (255,0,255)
            cv2.drawContours(im_boxes, [box], -1, color, 2)
        # cv2.imwrite('baseline2.png', im_boxes)
        im_boxes = cv2.resize(im_boxes, (700, 960))
        display(im_boxes)
        cv2.waitKey()
        cv2.destroyAllWindows()

    tf.keras.backend.clear_session()
    gc.collect()

    return new_boxes

def sort_box_points(points):
    temp_list = [0,1,2,3]
    # compare x
    left = None
    for i in temp_list:
        if left is None:
            left = i
            continue
        if points[i][0] < points[left][0]:
            left = i 
    temp_list.remove(left)
    # print(left, points[left], temp_list)
    
    left_2 = None
    for i in temp_list:
        if left_2 is None:
            left_2 = i
            continue
        if points[i][0] < points[left_2][0]:
            left_2 = i
    temp_list.remove(left_2)
    # print(left_2, points[left_2], temp_list)

    (top_left, bottom_left) = (left, left_2) if points[left][1] < points[left_2][1] else (left_2, left)

    (top_right, bottom_right) = (temp_list[0], temp_list[1]) if points[temp_list[0]][1] < points[temp_list[1]][1] else (temp_list[1], temp_list[0])
    
    res = [points[top_left], points[top_right], points[bottom_right], points[bottom_left]]
    # print(res)
    return res


def merge_elems(elems, im):
    new_box = {'category': 'text'}
    rotate_angle = 0
    if len(elems) == 1:
        new_box['angle'] = np.array2string(elems[0]['angle'], precision=PRECISION)
        new_box['width'] = np.array2string(elems[0]['width'], precision=PRECISION)
        new_box['height'] = np.array2string(elems[0]['height'], precision=PRECISION)
        new_box['left'] = np.array2string(elems[0]['left'], precision=PRECISION)
        new_box['top'] = np.array2string(elems[0]['top'], precision=PRECISION)
        new_box['content'] = elems[0]['content']
        new_box['category'] = elems[0]['category']
        new_box['coords'] = elems[0]['coords']
        rotate_angle = elems[0]['angle']
    else:
        box_points = []
        rotate_angle = None
        for box in elems:
            if rotate_angle is None:
                rotate_angle = box['angle']
            elif box['angle'] * rotate_angle < 0:
                rotate_angle = np.float32(0)
            else:
                if abs(box['angle']) < abs(rotate_angle):
                    rotate_angle = box['angle']
            box_points.extend(box['coords'])

        rot_mat, inv_rot_mat = get_rotation_matrix(rotate_angle)
        rect = cv2.minAreaRect(np.array(box_points, dtype=np.float32))
        box = cv2.boxPoints(rect).astype(np.int32)
        box = sort_box_points(box)

        # minX = minY = np.inf
        # maxX = maxY = -np.inf
        # for box in elems:
        #     points = [np.dot(rot_mat, np.array([p[0], p[1]])) for p in box['coords']]
        #     for p in points:
        #         minX = min(minX, p[0])
        #         minY = min(minY, p[1])
        #         maxX = max(maxX, p[0])
        #         maxY = max(maxY, p[1])

        # width = np.float16(maxX - minX)
        # height = np.float16(maxY - minY)

        # # invert rotate
        # [left, top] = np.dot(inv_rot_mat, np.array([minX, minY]))
        # upper_right = np.dot(inv_rot_mat, np.array([maxX, minY]))
        # below_right = np.dot(inv_rot_mat, np.array([maxX, maxY]))
        # below_left = np.dot(inv_rot_mat, np.array([minX, maxY]))
        
        # # for debug 
        # new_box['coords'] = [[left, top], upper_right, below_right, below_left]

        # new_box['content'] = ' '.join([e['content'] for e in elems])
        # new_box['left'] = np.array2string(np.float16(left), precision=PRECISION)
        # new_box['top'] = np.array2string(np.float16(top), precision=PRECISION)
        # if (rotate_angle == 0) :
        #     new_box['angle'] = np.float16(0)
        # new_box['angle'] = np.array2string(np.float16(rotate_angle), precision=PRECISION)
        # new_box['width'] = np.array2string(width, precision=PRECISION)
        # new_box['height'] = np.array2string(height, precision=PRECISION)

        new_box = calcBox(box, ' '.join([e['content'] for e in elems]))
        new_box['angle'] = np.array2string(new_box['angle'], precision=PRECISION)
        new_box['width'] = np.array2string(new_box['width'], precision=PRECISION)
        new_box['height'] = np.array2string(new_box['height'], precision=PRECISION)
        new_box['left'] = np.array2string(new_box['left'], precision=PRECISION)
        new_box['top'] = np.array2string(new_box['top'], precision=PRECISION)
        # print(new_box)

    if DEBUG:
            im_boxes = im.copy()
            rect_points = np.array(new_box['coords'], dtype=np.float32).reshape(-1, 1, 2)
            rect = cv2.minAreaRect(rect_points)
            box = cv2.boxPoints(rect).astype(np.int32)
            i = random.randint(0,5)
            # color = (255 * (i & 1), 255 * (i & 2), 255 * (i & 4))
            color = (255, 255, 255)
            cv2.drawContours(im_boxes, [box], -1, color, 2)
            cv2.putText(im_boxes, f"angle:{rotate_angle}", (0, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,0), 2)
            im_boxes = cv2.resize(im_boxes, (700, 960))
            # display(im_boxes)
            # cv2.waitKey()
            # cv2.destroyAllWindows()
    
    return new_box
    

def get_sentences(boxes):
    if(len(boxes) <= 1): 
        # print('one box only')
        return [boxes]
    
    def is_same_row(box1, box2):
        rotate_angle = min(abs(box1['angle']), abs(box2['angle']))
        rot_mat, inv_rot_mat = get_rotation_matrix(rotate_angle)
        rotated_box1 = np.dot(rot_mat, np.array([box1['left'], box1['top']]))
        rotated_box2 = np.dot(rot_mat, np.array([box2['left'], box2['top']]))

        threshold = min(box1['height'], box2['height'])
        box1_mid = rotated_box1[1] + box1['height'] / 2
        box2_mid = rotated_box2[1] + box2['height'] / 2

        res = abs(box1_mid - box2_mid) <= threshold
        i = 0 if res else 1
        return res, rotated_box1[i] - rotated_box2[i]

    def cmp_same_row(box1, box2):
        _, val = is_same_row(box1, box2)
        return val
    
    

    result = []
    sorted_boxes = sorted(boxes, key=cmp_to_key(cmp_same_row))

    group = []
    for i in range(len(sorted_boxes)):
        if i == 0:
            group.append(sorted_boxes[i])
        else:
            flag, _ = is_same_row(sorted_boxes[i-1], sorted_boxes[i])
            if not flag:
                result.append(group)
                group = [sorted_boxes[i]]
            else:
                # bad threshold
                threshold = min(sorted_boxes[i-1]['height'], sorted_boxes[i]['height']) * 2
                dist = get_dist(sorted_boxes[i-1], sorted_boxes[i])
                if dist - sorted_boxes[i-1]['width'] > threshold:
                    result.append(group)
                    group = [sorted_boxes[i]]
                else:
                    group.append(sorted_boxes[i])
    result.append(group)
    return result

def get_dist(box1, box2):
        dist = np.power(box1['left'] - box2['left'], 2) + np.power(box1['top'] - box2['top'], 2)
        return np.sqrt(dist)

def get_rotation_matrix(angle):
    angle_in_radians = np.deg2rad(angle)
    c, s = np.cos(angle_in_radians), np.sin(angle_in_radians)
    return np.array([[c, -s], [s, c]]), np.array([[c, s], [-s, c]])

def init_pipeline():
    global pipeline
    pipeline = keras_ocr.pipeline.Pipeline()
    

def is_near_elems(elem1, elem2):
    # let elem1 is on left and elem2 is on right
    if elem1['left'] > elem2['left']:
        (elem1, elem2) = (elem2, elem1)

    TEXT_DIST_THRESHOLD = max(elem1['height'], elem2['height'])
    # check if height is near
    if abs(elem1['height'] - elem2['height']) > max(elem1['height'], elem2['height']) * 0.5:
        TEXT_DIST_THRESHOLD /= 2
    # if TEXT_DIST_THRESHOLD > 50:
    #     TEXT_DIST_THRESHOLD = 50 + (TEXT_DIST_THRESHOLD - 50) * 0.5

    # print('---elem1 angle:', elem1['angle'], '---')
    if elem1['angle'] >= 0:
        # elem1 upperright, elem2 upperleft
        # print('using elem2 upperleft')
        elem1_measure_point = elem1['coords'][1]
        elem2_measure_point = elem2['coords'][0]
        elem2_measure_point_2 = elem2['coords'][3]
        top_bound = elem1['coords'][1][1] - TEXT_DIST_THRESHOLD / 3
        bottom_bound = elem1['coords'][2][1] + TEXT_DIST_THRESHOLD / 3
    else:
        # elem1 lowerright, elem2 lowerleft
        # print('using elem2 lowerleft')
        elem1_measure_point = elem1['coords'][2]
        elem2_measure_point = elem2['coords'][3]
        elem2_measure_point_2 = elem2['coords'][0]
        top_bound = elem1['coords'][1][1] - TEXT_DIST_THRESHOLD / 3
        bottom_bound = elem1['coords'][2][1] + TEXT_DIST_THRESHOLD / 3

    # print(elem2['coords'])
    # print('elem1:', elem1_measure_point)
    # print('elem2:', elem2_measure_point)

    # check if distance is too far
    dist = np.sqrt((elem1_measure_point[0] - elem2_measure_point[0]) ** 2 + (elem1_measure_point[1] - elem2_measure_point[1]) ** 2)
    if DEBUG and DEEP_DEBUG:
        print(dist, TEXT_DIST_THRESHOLD * 1.5, "dist check:", dist <= TEXT_DIST_THRESHOLD * 1.5)
    if dist > TEXT_DIST_THRESHOLD * 1.5:
        return False, None
    
    y_check = top_bound < elem2_measure_point[1] < bottom_bound
    x_check = elem1_measure_point[0] < elem2_measure_point[0] + 10
    y2_check = top_bound < elem2_measure_point_2[1] < bottom_bound
    x2_check = elem1_measure_point[0] < elem2_measure_point_2[0] + 10
    if DEBUG and DEEP_DEBUG:
        print('y-axis check', y_check, y2_check)
        print('x-axis check', x_check, x2_check)
    return (x_check and y_check) or (x2_check and y2_check), dist

def merge_two_elems(elem1, elem2, coords):
    box_points = []
    box_points.extend(elem1['coords'])
    box_points.extend(elem2['coords'])
    box_points = coords
    # let elem1 is on left and elem2 is on right
    if elem1['left'] > elem2['left']:
        (elem1, elem2) = (elem2, elem1)

    rect = cv2.minAreaRect(np.array(box_points, dtype=np.float32))
    box = cv2.boxPoints(rect).astype(np.int32)
    box = sort_box_points(box)
    new_box = calcBox(box, ' '.join([elem1['content'], elem2['content']]))

    merge_angle = new_box['angle']
    if DEBUG and DEEP_DEBUG:
        print('angle:', merge_angle)
    if min(elem1['height'], elem2['height']) < 30:
        check_angle = merge_angle * pow(min(elem1['height'], elem2['height']) / 30, 2)
        print(check_angle, pow(min(elem1['height'], elem2['height']) / 30, 2))
        if abs(check_angle) <= TEXT_ANGLE_THRESHOLD:
            merge_angle = np.float32(0)
        new_box['angle'] = merge_angle
    if DEBUG and DEEP_DEBUG:
        print('------merged-------')
        print('new angle:', merge_angle)
    return new_box

def elem_to_string(elem):
    elem['angle'] = np.array2string(elem['angle'], precision=PRECISION)
    elem['width'] = np.array2string(elem['width'], precision=PRECISION)
    elem['height'] = np.array2string(elem['height'], precision=PRECISION)
    elem['left'] = np.array2string(elem['left'], precision=PRECISION)
    elem['top'] = np.array2string(elem['top'], precision=PRECISION)
    return elem