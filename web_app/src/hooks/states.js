import { create } from 'zustand'
import { produce } from 'immer'
import { API_ENDPOINT, apiAddImage, apiCreateGallery, apiExportGalleries, apiExportImages, apiGetAllElements, apiGetAllGalleries, apiGetGalleryCount, apiGetImageList, apiMergeGalleries, apiDeleteGalleries, apiRenameGallery, apiUpdateElement, apiDeleteImages, apiMoveImages, apiGenGalleryElement, apiGenImageElement, apiInpaint, apiGenUnderlay, apiDiscardInpaint, apiConcatElem, apiDownloadImage, apiDownloadInapint } from './api'
import { fabric } from "fabric"
import fileDownload from 'js-file-download'

let MAX_WIDTH = 500;
let MAX_HEIGHT = 500;
const PADDING = 10;

const delay = ms => new Promise(res => setTimeout(res, ms));

export const useCustomStore = create((set, get) => ({
    selection: {
        mode: false,
        galleries: new Set(),
        images: new Set(),
        setMode: (f) => {
            set(produce((state) => {
                state.selection.mode = f
            }))
            if(!f) get().selection.clean()
        },
        select: (s) => {
            if(get().galleries.current != null) {
                set(produce((state) => {
                    if(get().selection.images.has(s)) {
                        state.selection.images.delete(s)
                    } else {
                        state.selection.images.add(s)
                    }
                }))  
            } else {
                set(produce((state) => {
                    if(get().selection.galleries.has(s)) {
                        state.selection.galleries.delete(s)
                    } else {
                        state.selection.galleries.add(s)
                    }
                })) 
            } 
        },
        selectAll: () => {
            if(get().galleries.current != null) {
                set(produce((state) => {
                    get().images.all.forEach(id => {
                        state.selection.images.add(Number(id))
                    })
                }))
            } else {
                set(produce((state) => {
                    Object.keys(get().galleries.all).forEach(id => {
                        state.selection.galleries.add(Number(id))
                    })                
                }))
            }
        },
        clean: () => {
            set(produce((state) => {
                state.selection.galleries.clear()
                state.selection.images.clear()
            }))
        },
    },

    dialog: {
        status: {
            'importI': false,
            'createG': false,
            'mergeG': false,
            'deleteG': false,
            'renameG': false,
            'preprocess': false
        },
        closeAllDialog: () => {
            set(
                produce((state) => {
                    state.dialog.status = {
                        'importI': false,
                        'createG': false,
                        'mergeG': false,
                        'deleteG': false,
                        'renameG': false,
                        'preprocess': false
                    }
                })
            ) 
        },
        openDialog: (key) => {
            set(
                produce((state) => {
                    state.dialog.status[key] = true
                })
            )
        },
    },

    galleries: {
        current: null,
        all: {},
        count: {},

        select: (id) => {
            set(
                produce((state) => {
                    state.galleries.current = id;
                })
            )
            get().images.reset()
        },
        fetch: async () => {
            const data = await apiGetAllGalleries()
            const count = await apiGetGalleryCount()
            // console.log(data)
            set(produce((state) => {
                state.galleries.all = data
                state.galleries.count = count
            }))
        },
        add: async (name) => {
            const id = await apiCreateGallery(name)
            // console.log(id)
            set(produce((state) => {
                state.galleries.all[id] = name
            }))
            get().galleries.fetch();
        },
        merge: async (mergeList, dest) => {
            const res = await apiMergeGalleries(mergeList, dest)
            get().selection.clean();
            get().galleries.fetch();
            return res;
        },
        delete: async (rmList) => {
            const res = await apiDeleteGalleries(rmList)
            set(produce((state) => {
                rmList.forEach((id) => {
                    delete state.galleries.all[id]
                })
            }))
            get().selection.clean();
            get().galleries.fetch();
            return res;
        },
        rename: async (id, name) => {
            const res = await apiRenameGallery(id, name)
            get().selection.clean();
            get().galleries.fetch();
            return res.data
        },
        reset: () => {
            set(
                produce((state) => {
                    state.galleries.current = null;
                    state.galleries.all = {};
                })
            )
            get().images.reset()
        },
        export: (target = null) => {
            // default: current galleries
            if (get().galleries.all == null) return;
            let list = [get().galleries.current]
            if (target == "all") list = Object.keys(get().galleries.all)
            if (target == "select") list = [...get().selection.galleries]
            apiExportGalleries(list)
        }
    },

    images: {
        current: null,
        all: [],
        loading: new Set(),

        select: (id) => {
            set(
                produce((state) => {
                    state.images.current = id;
                })
            )
            get().elems.reset()
            get().inpaint.removeAll()
        },
        fetch: async () => {
            let curGal = get().galleries.current;
            if (!curGal) return;
            const list = await apiGetImageList(curGal)
            // console.log(list)
            set(produce((state) => {
                state.images.all = list
            }))
        },
        add: async (imageFiles, gallery) => {
            const idList = await apiAddImage(imageFiles, gallery)
            set(produce((state) => {
                state.images.all = [...get().images.all, ...idList]
            }))
        },
        delete: async (imgList) => {
            let currentImage = get().images.current
            let allImages = get().images.all
            if (currentImage != null && imgList.includes(currentImage)) {
                let idx = allImages.findIndex((x) => {return x == currentImage})
                let id = null
                if(idx >= allImages.length - 1) {
                    id = allImages[idx - 1]
                } else {
                    id = allImages[idx + 1]
                }
                get().images.select(id)
            }
            const res = await apiDeleteImages(imgList)
            get().images.fetch()
            // console.log(get().images.current)
        },
        move: async (list, gallery) => {
            const res = await apiMoveImages(list, gallery)
            get().images.reset()
            get().images.fetch()
            return res.data
        },
        reset: () => {
            set(
                produce((state) => {
                    state.images.current = null;
                    state.images.all = [];
                })
            )
            get().elems.reset()
        },
        export: (target = null) => {
            // export selected imagesi
            let list = [...get().selection.images]
            // if (target == "all") list = Object.keys(get().galleries.all)
            // if(get().selection.images <= 0) return;
            apiExportImages(list)
        }
    },
    
    elems: {
        current: null,
        all: {},

        select: (id) => {
            set(produce((state) => {
                state.elems.current = id;
            }))
        },
        add: (id, data) => {
            data['id'] = id
            set(produce((state) => {
                state.elems.all[id] = data;
            }))
        },
        remove: (idList) => {
            idList.forEach((id) => {
                set(produce((state) => {
                    delete state.elems.all[id];
                }))
            })
        },
        fetch: async () => {
            const imageId = get().images.current;
            if (!imageId) return;
            // console.log('elem: fetch')
            const res = await apiGetAllElements(imageId);
            // console.log(res);
            set(produce((state) => {
                state.elems.all = res;
            }));
            // update canvas
            get().canvas.updateAll();
        },
        update: (props, id = null) => {
            if (id == null) id = get().elems.current;
            if (!id || !get().elems.all[id]) return;
            for (const [key, value] of Object.entries(props)) {
                set(produce((state) => {
                    state.elems.all[id][key] = parseFloat(value) ? parseFloat(value) : value;
                }));
            }
        },
        reset: () => {
            set(produce((state) => {
                state.elems.current = null;
                state.elems.all = {};
            }))
        },
        deselect: () => {
            set(produce((state) => {
                state.elems.current = null;
            }))
        },
        concat: async () => {
            let idList = get().canvas.getActiveObjsId();
            if (idList.length <= 1) return;
            const res = await apiConcatElem(idList);
            // get().images.reset()
            // get().elems.reset()
            // get().elems.fetch()
            return res
        }
    },

    preprocess: {
        galleryTextDetection: async (galleries) => {
            // todo: set images to loading
            console.log('galleryTextDetection')
            // const res = await apiGenGalleryElement(galleries)
            // set(produce((state) => {
            //     state.images.loading.add()
            // }))
        },
        elementDetection: async (images, useText=false, useUnderlay=false) => {
            set(produce((state) => {
                images.forEach(item => state.images.loading.add(item))
            }))
            let t0 = performance.now()
            for (const image of images) {
                if (useText) {
                    const promise = apiGenImageElement([image])
                    promise.then(res => {
                        if (!useUnderlay) {
                            if (get().images.current == image) {
                                get().elems.fetch()
                            }
                        }
                    }).finally(() => {
                        set(produce((state) => {
                            state.images.loading.delete(image)
                        }))
                    })
                    await promise;
                    await delay(100);
                }
                if (useUnderlay) {
                    if (useText) {
                        if (get().images.current == image) {
                            get().elems.fetch()
                        }
                        set(produce((state) => {
                            state.images.loading.add(image)
                        }))
                    }
                    const promise = apiGenUnderlay([image])
                    promise.then(res => {
                        if (get().images.current == image) {
                            get().elems.fetch()
                        }
                    }).finally(() => {
                        set(produce((state) => {
                            state.images.loading.delete(image)
                        }))
                    })
                    await promise;
                    await delay(100);
                }
            }
            let t1 = performance.now()
            get().counter.setCount(images.length, t1-t0)
        },
        imagesTextDetection: async (images) => {
            console.log('imagesTextDetection')
            set(produce((state) => {
                images.forEach(item => state.images.loading.add(item))
            }))
            for (const image of images) {
                const promise = apiGenImageElement([image])
                promise.then(res => {
                    if (get().images.current == image) {
                        get().elems.fetch()
                    }
                }).finally(() => {
                    set(produce((state) => {
                        state.images.loading.delete(image)
                    }))
                })  
                await promise;
                await delay(100);
            }
        },
        underlayDetection: async (images) => {
            console.log('underlayDetection')
            set(produce((state) => {
                images.forEach(item => state.images.loading.add(item))
            }))
            for (const image of images) {
                const promise = apiGenUnderlay([image])
                promise.then(res => {
                    if (get().images.current) {
                        get().elems.fetch()
                    }
                }).finally(() => {
                    set(produce((state) => {
                        state.images.loading.delete(image)
                    }))
                })
                await promise;
                await delay(100);
            }
              
        },
        inpaintWithCurrentImage: async (images) => {
            if(get().images.current == null) return;
            const canvas = get().canvas;
            const inpaint = get().inpaint;
            const selectedImage = get().images.current;
            let mask = canvas.getMask()
            get().canvas.setBackgroundSrc(API_ENDPOINT.concat(`/image/${selectedImage}`))
            set(produce((state) => {
                state.images.loading.add(selectedImage)
            }))
            const promise = apiInpaint(selectedImage, mask)
            
            // unsafe move
            promise.then(res => {
                inpaint.removeAll();
                // if(get().canvas.userMode == 'drawing') {
                    get().canvas.setBackgroundSrc(API_ENDPOINT.concat(`/inpaint/${selectedImage}`))
                // }
            }).finally(res => {
                set(produce((state) => {
                    state.images.loading.delete(selectedImage)
                }))
            })
            return promise
        }
    },

    inpaint: {
        showingPath: true,
        withElem: true,
        strokeWidth: 30,
        strokeColor: 'rgba(255,255,0, 0.6)',
        pathObjs: [],
        hoverObj:  new fabric.Circle({
            radius: 30,
            fill: 'rgba(255,255,0, 0.6)'
        }),
        
        setWithElem: (f) => {
            set(produce((state) => {state.inpaint.withElem = f}))
            get().canvas.setShowingElement(f)
        },
        changeStrokeWidth: (width) => {
            set(produce((state) => {state.inpaint.strokeWidth = width;}))
            get().canvas.current.freeDrawingBrush.width = width;
            get().inpaint.hoverObj.set({
                radius: width / 2
            })
        },
        setShowingPath: (flag) => {
            if (flag == get().inpaint.showingPath) return;
            const canvas = get().canvas;
            const inpaint = get().inpaint;
            if(flag) {
                inpaint.pathObjs.forEach(obj => {
                    canvas.current.add(obj);
                })
            } else {
                inpaint.pathObjs.forEach(obj => {
                    canvas.current.remove(obj);
                })
            }
            set(produce((state) => {
                state.inpaint.showingPath = flag;
            }))
        },
        removeAll: () => {
            const canvas = get().canvas;
            const inpaint = get().inpaint;
            inpaint.pathObjs.forEach(obj => {
                canvas.current.remove(obj);
            })
            set(produce((state) => {
                state.inpaint.pathObjs = [];
            }))
        },
        discardInpaint: async (id) => {
            apiDiscardInpaint(id)
            get().canvas.setBackgroundSrc(API_ENDPOINT.concat(`/image/${id}`))
        }
    },

    canvas: {
        current: null,
        userMode: null,
        backgroundSrc: null,
        imgWidth: null,
        imgHeight: null,
        ratio: null,
        originZoom: null,
        currentZoom: null,
        rectObjs: {},

        init: (ref) => {
            // console.log('canvas: init')
            set(produce((state) => {
                state.canvas.current = new fabric.Canvas(
                    ref.current,
                    // { backgroundColor: 'pink'}
                );
                state.canvas.rectObjs = {}
            }))
            get().canvas.current.freeDrawingBrush.color = get().inpaint.strokeColor;         
        },
        dispose: () => {
            get().canvas.current.dispose()
            set(produce((state) => {
                state.canvas.current = null;
                state.canvas.backgroundSrc = null;
                state.canvas.imgWidth = null;
                state.canvas.imgHeight = null;
                state.canvas.ratio = null;
                state.canvas.originZoom = null;
                state.canvas.currentZoom = null;
                state.canvas.rectObjs = {};
            }))
        },
        loadBackgroundImage: (ref) => {
            const canvas = get().canvas.current;
            const selectedImage = get().images.current;
            if(!canvas || selectedImage == null) return;
            
            let image = new Image() 
            let src = get().canvas.userMode == 'drawing' ? `/inpaint/${selectedImage}` : `/image/${selectedImage}`
            src = API_ENDPOINT.concat(src)
            image.src = src
            // console.log('load: ', src)

            image.onload = () => {
                let scale = 1;
                let w = ref.current.offsetWidth - PADDING
                let h = ref.current.offsetHeight - PADDING
                // console.log(w, h)
                
                if (image.width > image.height) {
                    if (image.width > MAX_WIDTH) {
                        scale = scale * MAX_WIDTH / image.width
                    } 
                } else if (image.height > MAX_HEIGHT) {
                    scale = scale * MAX_HEIGHT / image.height
                }
                canvas.setZoom(scale)
                canvas.setWidth(image.width * scale)
                canvas.setHeight(image.height * scale)
                // console.log('original zoom:', scale)

                set(produce((state) => {
                    state.canvas.imgWidth = image.width;
                    state.canvas.imgHeight = image.height;
                    state.canvas.ratio = image.width / image.height;
                    state.canvas.originZoom = scale;
                    state.canvas.currentZoom = scale;
                    state.canvas.backgroundSrc = image.src;
                }))
                get().canvas.autoResize(w, h)
                // get().elems.reset()
                // get().elems.fetch()
            }
        },
        setBackgroundSrc: (src) => {
            set(produce((state) => {state.canvas.backgroundSrc = src;}))
        },
        autoResize: (maxWidth, maxHeight) => {
            maxWidth -= PADDING
            maxHeight -= PADDING
            if(!get().canvas.current || !get().canvas.imgWidth) return;

            let scale = 1
            if (get().canvas.ratio <= 1) {
                scale = maxWidth / get().canvas.imgWidth * 0.8
                if (get().canvas.imgHeight * scale > maxHeight) {
                    scale = maxHeight / get().canvas.imgHeight
                }
            } else {
                scale = maxHeight / get().canvas.imgHeight * 0.8
                if (get().canvas.imgWidth * scale > maxWidth) {
                    scale = maxWidth / get().canvas.imgWidth
                }
            }
            get().canvas.current.setZoom(scale)
            get().canvas.current.setWidth(get().canvas.imgWidth * scale)
            get().canvas.current.setHeight(get().canvas.imgHeight * scale)
            set(produce((state) => {state.canvas.currentZoom = scale;}))
        },

        setUserMode :(mode) => {
            const canvas = get().canvas;
            const selectedImage = get().images.current;
            if(!canvas.current || selectedImage == null) return;
            if(get().canvas.mode == mode) return;
            // console.log('set mode: ', mode)
            set(produce((state) => {state.canvas.userMode = mode;}))
            
            if(mode == 'drawing') {
                const inpaint = get().inpaint;
                canvas.current.off('selection:cleared')
                // canvas.current.off('mouse:wheel')
                inpaint.setShowingPath(true)
                if (!get().inpaint.withElem) {
                    canvas.setShowingElement(false)
                }
                canvas.current.set('isDrawingMode', true)
                canvas.current.on('mouse:up', (opt) => {
                    set(produce((state) => {
                        state.inpaint.pathObjs.push(opt.currentTarget)
                    }))
                })
                // set image src to inpaint image
                canvas.setBackgroundSrc(API_ENDPOINT.concat(`/inpaint/${selectedImage}`))

                canvas.current.on("mouse:move", e => {
                    let currentPoint = {x: e.absolutePointer.x, y: e.absolutePointer.y}
                    let offset = get().inpaint.strokeWidth / 2
                    let x = currentPoint.x - offset
                    let y = currentPoint.y - offset
                    inpaint.hoverObj.set({
                        left: x,
                        top: y,
                    }).setCoords()
                    canvas.rerender()
                })
                canvas.current.on("mouse:over", () => {
                    canvas.current.add(inpaint.hoverObj)
                })
                canvas.current.on("mouse:out", () => {
                    canvas.current.remove(inpaint.hoverObj)
                })
            } else {
                // mode: element
                canvas.current.off('mouse:up')
                canvas.current.set('isDrawingMode', false)
                if (!get().inpaint.withElem) {
                    // if prevMode = drawing && withElem = false, show back elem
                    canvas.setShowingElement(true)
                }
                get().inpaint.setShowingPath(false);
                canvas.current.on('selection:cleared', () => {
                    get().elems.deselect();
                })
                canvas.setBackgroundSrc(API_ENDPOINT.concat(`/image/${selectedImage}`))

                canvas.current.off('mouse:move')
                canvas.current.off('mouse:out')
                canvas.current.off('mouse:over')
            }
        },
        
        rerender: () => {
            const canvas = get().canvas.current;
            if(!canvas) return;
            canvas.requestRenderAll();
        },
        setShowingElement: (flag) => {
            const canvas = get().canvas;
            const allElements = get().elems.all;
            if (flag) {
                for (const [id, obj] of Object.entries(canvas.rectObjs)) {
                    canvas.current.add(obj);
                    if(allElements[id]['category'] == 'underlay')
                        canvas.current.sendToBack(obj);
                }
                // Object.values(canvas.rectObjs).forEach(obj => {
                //     canvas.current.add(obj);
                //     if(allElements[id]['category'] == 'underlay')
                //         canvas.sendToBack(rect);
                // })
                
            } else {
                Object.values(canvas.rectObjs).forEach(obj => {
                    canvas.current.remove(obj);
                })
            }
        },
        getMask: () => {
            const canvas = get().canvas;
            let prevRects = []
            Object.values(canvas.rectObjs).forEach(rect => {
                let rectData = {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                }
                prevRects.push(rectData)
                // console.log(rect.getCenterPoint(), rect.left, rect.top, rect.width, rect.height)
                rect.set({
                    top: rectData.top - 5,
                    left: rectData.left - 8,
                    width: rectData.width + 13,
                    height: rectData.height + 10
                }).setCoords();
                // console.log(rect.getCenterPoint(), rect.left, rect.top, rect.width, rect.height)
            })
            const mask = canvas.current.toDataURL({multiplier: 1 / canvas.currentZoom})
            Object.values(canvas.rectObjs).forEach((rect, i) => {
                rect.set({
                    top: prevRects[i].top,
                    left: prevRects[i].left,
                    width: prevRects[i].width,
                    height: prevRects[i].height
                })
            })
            return mask
        },

        // mode: box
        createRect: (data) => {
            let rect = new fabric.Rect(data);
            let r = 255, g = 255, b = 255;
            switch(data['category']) {
                case 'underlay':
                    g = 0;    
                    b = 0;
                    break;
                case 'logo':
                    r = 0;
                    b = 0;
                    break;
                default:
                    b = 0;
                    break;
            }
            rect.set({
                strokeWidth: 2,
                stroke: `rgba(${r},${g},${b},1)`,
                fill: `rgba(${r},${g},${b},0.5)`
            });
            rect.hasBorders = true;
            rect.hasControls = true;
            rect.centeredRotation = true;
            rect.strokeUniform = true;
            return rect
        },
        updateAll: () => {
            // console.log('canvas:update')
            const canvas = get().canvas;
            if(!canvas.current) return;
            const allElements = get().elems.all;
            let canvasId = Object.keys(canvas.rectObjs);
            let allElementsId = Object.keys(allElements);
            let addElemList = allElementsId.filter(x => !canvasId.includes(x));
            let delElemList = canvasId.filter(x => !allElementsId.includes(x));
            // console.log(allElementsId, canvasId)
            // console.log(addElemList, delElemList)
            
            addElemList.forEach(id => {
                let rect = canvas.createRect(allElements[id]);
                const updateElem = get().elems.update;
                rect.on("selected", () => {
                    set(produce((state) => {
                        state.elems.current = id;
                    }));
                });
                rect.on("moving", (e) => {
                    let left = e.transform.target.left;
                    let top = e.transform.target.top;
                    updateElem({
                        left: left.toFixed(2),
                        top: top.toFixed(2)
                    }, id);
                });
                rect.on("scaling", (e) => {
                    let scaleX = e.transform.target.scaleX;
                    let scaleY = e.transform.target.scaleY;
                    let width = e.transform.target.width;
                    let height = e.transform.target.height;
                    updateElem({
                        width: (width * scaleX).toFixed(2),
                        height: (height * scaleY).toFixed(2)
                    }, id);
                });
                rect.on("rotating", (e) => {
                    let angle = e.transform.target.angle;
                    updateElem({
                        angle: angle.toFixed(2)
                    }, id);
                });

                if (get().inpaint.withElem || get().canvas.userMode != 'drawing') {
                    canvas.current.add(rect);
                    if(allElements[id]['category'] == 'underlay')
                        canvas.current.sendToBack(rect);
                }

                set(produce((state) => {
                    state.canvas.rectObjs[id] = rect;
                }));
            });
            delElemList.forEach(id => {
                canvas.current.remove(canvas.rectObjs[id]);
                set(produce((state) => {
                    delete state.canvas.rectObjs[id];
                }));
            });
            if(delElemList.length > 0) {
                canvas.current.discardActiveObject();
                get().elems.deselect()
            }


            canvas.rerender();
        },
        updateObj: (props, id = null) => {
            if (id == null) id = get().elems.current;
            if (!id || !get().canvas.rectObjs[id]) return;
            for (const [key, value] of Object.entries(props)) {
                // console.log(key, value,parseFloat(value))
                switch(key) {
                    case "content":
                    case "category":
                        break;
                    case "width":
                    case "height":
                        set(produce((state) => {
                            state.canvas.rectObjs[id].set(key, parseFloat(value));
                        }))
                        break;
                    default:
                        set(produce((state) => {
                            state.canvas.rectObjs[id].set(key, parseInt(value)).setCoords();
                        }))
                        break;
                }
            }
            get().canvas.rerender()
        },
        getActiveObjsId: () => {
            const canvas = get().canvas;
            let res = []
            let activeObjects = canvas.current.getActiveObjects()
            for (const [id, obj] of Object.entries(canvas.rectObjs)) {
                activeObjects.forEach(x => {
                    if (obj === x) {
                        res.push(id)
                    }
                });
            }
            return res
        },

        download: async () => {
            if(get().images.current == null) return;
            const canvas = get().canvas;
            const selectedImage = get().images.current;
            let mask = canvas.getMask()
            apiDownloadImage(selectedImage, mask)
            apiDownloadInapint(selectedImage)
        }
        
    },
    
    counter: {
        totalCount: 0,
        totalTime: 0,
        average: 0,
        totalElem: 0,
        falseNegative: 0,
        falsePositive: 0,

        setCount: (tc, tt) => {
            console.log(tc,tt, tt/tc)
            set(produce((state) => {
                state.counter.totalCount = tc;
                state.counter.totalTime = tt;
                // state.counter.average = tt / tc;
            }))
            set(produce((state) => {
                state.counter.average = state.counter.totalTime / state.counter.totalCount;
            }))
        },
        incFalseNegative: () => {
            set(produce((state) => {
                state.counter.falseNegative += 1;
            }))
        },
        resetFalseNegative: () => {
            set(produce((state) => {
                state.counter.falseNegative = 0;
            }))
        },
        incFalsePositive: () => {
            set(produce((state) => {
                state.counter.falsePositive += 1;
            }))
        },
        resetFalsePositive: () => {
            set(produce((state) => {
                state.counter.falsePositive = 0;
            }))
        }
    }
}))