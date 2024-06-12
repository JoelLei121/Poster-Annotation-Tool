import os, time
import cv2
import numpy as np
import random
from backend.func.text_detector import get_image_elem, sort_box_points
from psutil import Process

PRECISION = 0
DEBUG = False

def detect_underlay(image_bytes, elems):
    im = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)

    elem_masks = []
    elem_areas = []
    for elem in elems:
        mask = np.zeros(im.shape[:2], dtype=np.uint8)
        angle = float(elem['angle'])
        center = (float(elem['left']) + 0.5 * float(elem['width']), float(elem['top']) + 0.5 * float(elem['height']))
        size = (float(elem['width']), float(elem['height']))
        rect = cv2.RotatedRect(center, size, angle)
        box = cv2.boxPoints(rect).astype(np.int32)

        elem_areas.append(cv2.contourArea(box))
        cv2.fillPoly(mask, [box], 255)
        elem_masks.append(mask)
        del mask


    edges = cv2.Canny(im, 200, 250)
    contours, _ = cv2.findContours(edges, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if DEBUG:
        cv2.imwrite('edges.png', edges)
        display(cv2.resize(edges, (700, 960)))
        cv2.waitKey()
        cv2.destroyAllWindows()
    

    contour_masks = []
    contour_areas = []
    cnts = []
    for cnt in contours:
        if (cv2.contourArea(cnt) < 1000):
            continue
        mask = np.zeros(im.shape[:2], dtype=np.uint8)
        contour_areas.append(cv2.contourArea(cnt))
        cnts.append(cnt)
        mask = cv2.drawContours(mask, [cnt], -1, 255, cv2.FILLED)
        contour_masks.append(mask)
        del mask
    del contours

    if DEBUG:
        for (m, a) in zip(contour_masks, contour_areas):
            display(cv2.resize(m, (700, 960)), 'mc')
            print(a)
            cv2.waitKey(300)
            cv2.destroyAllWindows()

    print("Contours:", len(contour_masks), "Resource:", Process().memory_info().rss)
    size_factor = 6
    res = []

    for (c_mask, c_area, ctn) in zip(contour_masks, contour_areas, cnts):
        for (e_mask, e_area) in zip(elem_masks, elem_areas):
            if c_area < e_area or c_area > e_area * size_factor:
                continue
            intersection = np.bitwise_and(c_mask, e_mask)
            intersection_ctn, _ = cv2.findContours(intersection.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if DEBUG:
                display(cv2.resize(c_mask, (700, 960)), 'mc')
                display(cv2.resize(e_mask, (700, 960)), 'me')
                display(cv2.resize(intersection, (700, 960)), 'i')
                cv2.waitKey(300)
                cv2.destroyAllWindows()

            if len(intersection_ctn) <= 0:
                del intersection, intersection_ctn
                continue
            cov_area = cv2.contourArea(intersection_ctn[0])
            # print("intersection:", cov_area / e_area)

            # print(np.sum(coverage) / 255)  
            if cov_area / e_area > 0.8:
                # cover a lot, probably is an underlay

                covered = False
                for i in range(len(res)):
                    (p_ctn, p_mask, p_area) = res[i]
                    if p_mask is None:
                        continue

                    if DEBUG:
                        display(cv2.resize(c_mask, (700, 960)), 'contour')
                        display(cv2.resize(p_mask, (700, 960)), 'underlay')
                        cv2.waitKey()
                        cv2.destroyAllWindows()

                    if p_area > c_area * size_factor or c_area > p_area * size_factor:
                        continue
                    p_intersection = np.bitwise_and(c_mask, p_mask)

                    if DEBUG:
                        display(cv2.resize(p_intersection, (700, 960)), 'intersection')
                        cv2.waitKey()
                        cv2.destroyAllWindows()

                    temp_ctn, _ = cv2.findContours(p_intersection.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if len(temp_ctn) <= 0:
                        continue
                    intersect_area = cv2.contourArea(temp_ctn[0])
                    if intersect_area / c_area > 0.8:
                        covered = True
                        union_ctn = np.concatenate((p_ctn, ctn), axis=0)
                        union_mask = np.bitwise_or(c_mask, p_mask)
                        union_area = cv2.contourArea(union_ctn)
                        res.pop(i)
                        res.append((union_ctn, union_mask, union_area))
                        break

                    # if p_area > c_area:
                    #     # check if p cover c
                    #     if intersect_area / c_area > 0.9:
                    #         # p cover c, drop c
                    #         covered = True
                    #         break
                    # else:
                    #     # check if c cover p
                    #     if intersect_area / p_area > 0.9:
                    #         # c cover p, remove p
                    #         res[i] = (None, None, None)
                    # del p_intersection, temp_ctn

                if not covered:
                    if DEBUG:
                        t = im.copy()
                        rect = cv2.minAreaRect(ctn)
                        box = cv2.boxPoints(rect).astype(np.int32)
                        cv2.drawContours(t, [box], -1, (0,255,0), 3)
                        cv2.imwrite('c_mask.png', c_mask)
                        cv2.imwrite('e_mask.png', e_mask)
                        # cv2.imwrite('underlay.png', t)
                        display(cv2.resize(t, (700, 960)), 'new underlay')
                        display(cv2.resize(c_mask, (700, 960)), 'contour')
                        cv2.waitKey()
                        cv2.destroyAllWindows()
                    res.append((ctn, c_mask, c_area))
                    break

            del intersection, intersection_ctn

    del elem_masks, contour_masks
    # print(len(res))
    all_underlays = im.copy()
    for (ctn, _, _) in res:
        if ctn is None:
            continue
        rect = cv2.minAreaRect(ctn)
        box = cv2.boxPoints(rect).astype(np.int32)
        # print(rect)
        # print(box)
        # cv2.fillPoly(all_underlays, [box], (255,255,255))
        i = random.randint(0,5)
        cv2.drawContours(all_underlays, [ctn], -1, (255 * (i & 1), 0, 255 * (i & 4)), 2)

    if DEBUG:
        display(all_underlays)
        cv2.waitKey()
        cv2.destroyAllWindows()


    underlays = []
    for (ctn, _, _) in res:
        if ctn is None:
            continue
        rect = cv2.minAreaRect(ctn)
        box = cv2.boxPoints(rect).astype(np.int32)
        box = sort_box_points(box)
        underlays.append(calcBox(box))
    
    # print(underlays)
    
    return underlays


def calcBox(coords):
    PRECISION = 2
    res = {}
    res['content'] = ''
    res['category'] = 'underlay'

    vec_a, vec_b, vec_d, vec_c = coords

    ab = vec_b - vec_a
    ab_nor = ab / np.linalg.norm(ab)

    k_ab = ab[1] / ab[0]
    angle = np.arctan(k_ab) / np.pi * 180
    if abs(angle) <= 5:
        angle = np.float16(0)

    upperleft = vec_a
    ca = vec_a - vec_c
    t_c = ca.dot(ab_nor)
    cp = ab_nor * t_c
    if np.cross(cp, ca) > 0:
        upperleft = vec_a - cp

    upperright = vec_b
    db = vec_b - vec_d
    t_d = db.dot(ab_nor)
    dp = ab_nor * t_d
    if np.cross(db, dp) > 0:
        upperright = vec_b - dp
    width = np.linalg.norm(upperright - upperleft)

    bp = dp - db
    ap = cp - ca
    height = max(np.linalg.norm(ap), np.linalg.norm(bp))

    res['left'] = np.array2string(upperleft[0], precision=PRECISION)
    res['top'] = np.array2string(upperleft[1], precision=PRECISION)
    res['width'] = np.array2string(width, precision=PRECISION)
    res['height'] = np.array2string(height, precision=PRECISION)
    res['angle'] = np.array2string(angle, precision=PRECISION)
    return res

def display(mat, name=None):
    if name is None:
        name = random.randint(1000, 9999)
        name = str(int(name))
    cv2.namedWindow(name)
    cv2.imshow(name, mat)
    # cv2.waitKey()
    # cv2.destroyWindow(name)
    # return name

def main():
    # can't load without import torch
    import torch
    TEST_IMG = 'test3.jpg'

    im = cv2.imread(os.path.join(os.getcwd(), 'backend', 'func', TEST_IMG))
    _, b = cv2.imencode('.jpg', im)
    bbox = get_image_elem(b.tobytes())
    # bbox = [{
    #     'top': '20.',
    #     'left': '45.',
    #     'width': '100.',
    #     'height': '50.',
    #     'angle': '25.'
    # }]
    underlays = detect_underlay(b.tobytes(), bbox)
    # print(underlays)
    

if __name__ == '__main__':
    main()