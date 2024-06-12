import axios from "axios"
import fileDownload from "js-file-download"

export const API_ENDPOINT = "http://127.0.0.1:5000"
const api = axios.create({
    baseURL: API_ENDPOINT,
})

/* galleries */
export async function apiGetElemCount(id) {
    const res = await api.get(`/gallery/${id}/elem`)
    return res.data
}

export async function apiGetAllGalleries() {
    const res = await api.get("/gallery/")
    return res.data
}

export async function apiCreateGallery(name) {
    console.log('api: create set')
    const res = await api.post("/gallery/", {name: name})
    return res.data['id']
}

export async function apiDeleteGalleries(rmList) {
    console.log(`api: remove gallery ${rmList}`)
    const res = await api.delete("/gallery/", {
        data: {
            id: rmList
        }
    })
    return res.data
}

export async function apiMergeGalleries(mergeList, dest) {
    console.log(`api: merge gallery ${mergeList} to set ${dest}`)
    const res = await api.put("/gallery/", {
        merge: mergeList,
        dest: dest
    })
    return res.data
}

export async function apiRenameGallery(id, name) {
    console.log(`api: rename gallery ${id} to ${name}`)
    const res = await api.patch("/gallery/" + id, {
        name: name
    })
    return res.data
}

export async function apiExportGalleries(idList) {
    console.log(`api: export galleries ${idList}`)
    api.get("/gallery/export", {
        params: {
            'id': idList
        },
        paramsSerializer: {
            indexes: null
        },
        responseType: 'blob'
    })
    .then(res => {
        fileDownload(res.data, 'export_files.zip')
    })
}

export async function apiGetGalleryCount() {
    const res = await api.get(`/gallery/num`)
    return res.data
}

/* images */
export async function apiGetImageList(gallery) {
    // console.log(gallery)
    const res = await api.get("/image/", {
        params: {
            gallery: gallery
        }
    })
    return res.data
}

export async function apiAddImage(files, gallery) {
    console.log(files)
    const res = await api.post(
        "/image/new", 
        files,
        {
            headers: {
                "Content-Type": "multipart/form-data"
            },
            params: {
                'gallery': gallery
            }
        }
    )
    return res.data['images']
}

export async function apiDeleteImages(idList) {
    const res = await api.delete("/image/", {
        data: {
            id: idList
        }
    })
    return res
}

export async function apiMoveImages(idList, gallery) {
    const res = await api.patch("/image/", {
        id: idList,
        gallery: gallery
    })
    return res
}

export async function apiExportImages(idList) {
    console.log(`api: export galleries ${idList}`)
    api.get("/image/export", {
        params: {
            'id': idList
        },
        paramsSerializer: {
            indexes: null
        },
        responseType: 'blob'
    })
    .then(res => {
        fileDownload(res.data, 'export_files.zip')
    })
}

/* elements */
export async function apiGetAllElements(id) {
    const res = await api.get(`/image/${id}/elem`)
    return res.data
}

export async function apiUpdateElement(id, elements) {
    // console.log(elements)
    const res = await api.put(`/image/${id}/elem`, elements)
    return res.data
}

export function apiCreateElement(id, data) {
    const res = api.post(`/image/${id}/elem`, data)
    return res
}

export function apiDeleteElements(id, delList) {
    const res = api.delete(`/image/${id}/elem`, {
        data: delList
    })
    return res
}

export async function apiConcatElem(idList) {
    const res = api.post('/image/elem/', {
        id: idList
    })
    return res
}


/* preprocess */
export async function apiGenImageElement(images) {
    const res = await api.put("/image/", {
        id: images
    })
    return res.data
}

export async function apiGenGalleryElement(galleries) {
    const res = await api.put("/gallery/elem",{
        id: galleries
    })
    return res.data
}

export async function apiGenUnderlay(images) {
    const res = await api.put("/image/underlay", {
        id: images
    })
    return res.data
}

/* inpainting */
export async function apiInpaint(id, maskUrl) {
    const res = api.post(`/inpaint/${id}`, {mask: maskUrl})
    return res
}

export async function apiDiscardInpaint(id) {
    const res = await api.delete(`/inpaint/${id}`)
    return res
}

export async function apiReleaseResource() {
    api.get('/release')
}

export async function apiDownloadImage(id, maskUrl) {
    const res = api.post(`/image/download/${id}`, {mask: maskUrl}, {responseType: 'blob'})
    res.then(res => {
        // let name = res.headers['custom-field']
        // fileDownload(res.data, 'default.png')
    })
}

export async function apiDownloadInapint(id) {
    api.post(`/inpaint/download/${id}`, {}, {responseType: 'blob'})
}