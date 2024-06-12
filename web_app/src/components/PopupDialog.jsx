import { useEffect, useState } from "react";
import styles from "../assets/PopupDialog.module.css"
import { useCustomStore } from "../hooks/states";

function DialogContainer({ children, onSuccess }) {
    const [
        closeAllDialog,
        setSelectMode,
    ] = useCustomStore((state) => [
        state.dialog.closeAllDialog,
        state.selection.setMode,
    ]);

    const onReject = (e) => {
        e.preventDefault(); 
        e.stopPropagation()
        closeAllDialog(); 
    }

    return (
        <div className={styles.bg} onClick={onReject}>
            <div className={styles.container} onClick={(e) => e.stopPropagation()}>
                {children}
                <div className={styles.buttonSet}>
                    <button onClick={() => {onSuccess(); closeAllDialog(); setSelectMode(false);}}>OK</button>
                    <button onClick={onReject}>Cancel</button>
                </div>
            </div>
        </div>
    )
}

export default function PopupDialog() {
    const [
        galleries,
        currentGallery,

        createGallery,
        mergeGalleries,
        deleteGalleries,
        renameGallery,

        uploadImage,
        deleteImages,
        moveImages,
        dialogStatus,

        selectedGalleries,
        selectedImages,

        galleryTextDetection,
        // underlayDetection,
        // imagesTextDetection,
        inpaintWithImages,
        elementDetection,

        setCount,
    ] = useCustomStore((state) => [
        state.galleries.all,
        state.galleries.current,

        state.galleries.add,
        state.galleries.merge,
        state.galleries.delete,
        state.galleries.rename,

        state.images.add,
        state.images.delete,
        state.images.move,
        state.dialog.status,

        state.selection.galleries,
        state.selection.images,

        state.preprocess.galleryTextDetection,
        // state.preprocess.underlayDetection,
        // state.preprocess.imagesTextDetection,
        state.preprocess.inpaintWithCurrentImage,
        state.preprocess.elementDetection,

        state.counter.setCount,
    ]);


    const handleUpload = () => {
        let uploadFiles = document.getElementById("imageUpload").files
        if(uploadFiles.length == 0) return;
        let gallery = currentGallery ? currentGallery : 0;
        uploadImage(uploadFiles, gallery)
    }

    const [galleryName, setGalleryName] = useState("")
    const handleCreateGallery = () => {
        if(galleryName.length <= 0) return;
        if(Object.values(galleries).filter((v) => v == galleryName).length > 0) {
            console.log('gallery name exist')
            return;
        }
        createGallery(galleryName)
        setGalleryName("")
    }
    const handleRename = async () => {
        let id = selectedGalleries.values().next().value;
        if(galleryName.length <= 0) return;
        if(Object.values(galleries).filter((v) => v == galleryName).length > 0) {
            console.log('same gallery name')
            return;
        }
        renameGallery(id, galleryName)
        setGalleryName("")
    }


    const handleMerge = () => {
        let mergeDest = document.getElementById("mergeSelect").value
        console.log(mergeDest)
        if(selectedGalleries.size <= 0) return;
        let list = [...selectedGalleries]
        mergeGalleries(list, mergeDest)
    }

    const handleDeleteG = async () => {
        if(selectedGalleries.size <= 0) return;
        let list = [...selectedGalleries]
        deleteGalleries(list)
    }

    const handleDeleteI = async () => {
        if(selectedImages.size <= 0) return;
        let list = [...selectedImages]
        deleteImages(list)
    }

    const handleMoveI = () => {
        let gallery = document.getElementById("moveSelect").value
        console.log(gallery)
        if(selectedImages.size <= 0) return;
        let list = [...selectedImages]
        moveImages(list, gallery)
    }

    const [checkboxes, setCheckboxes] = useState([true, false, false])
    const handlePreprocess = async () => {
        // console.log(checkboxes)
        

        if (currentGallery) {
            if (selectedImages.size <= 0) return;
            const t0 = performance.now()
            const count = [...selectedImages].length
            // setCount('loading', 'loading')
            const res = await elementDetection([...selectedImages], checkboxes[0], checkboxes[1])
            
            const t1 = performance.now()
            setCount(count, t1 - t0)
        } else {
            if (selectedGalleries.size <= 0) return;
            const res = await galleryTextDetection([...selectedGalleries])
        }
    }

    return (
        <>
            {
                // create gallery
                dialogStatus['createG'] && 
                <DialogContainer onSuccess={handleCreateGallery}>
                    图集名称:
                    <input value={galleryName} onChange={(e) => setGalleryName(e.target.value)}/>
				</DialogContainer>
            }
			{
                // merge galleries to one
				dialogStatus['mergeG'] && 
				<DialogContainer onSuccess={handleMerge}>
                    选择合并至:
					<select id="mergeSelect">
                    {
                        Object.entries(galleries).map(([k, v], i) => {
                            return <option value={k} key={k}>Gallery {i}: {v}</option>
                        })
                    }
                    </select>
				</DialogContainer>
			}
            {
                // rename gallery
                dialogStatus['renameG'] && 
                <DialogContainer onSuccess={handleRename}>
                    重命名为:
                    <input value={galleryName} onChange={(e) => setGalleryName(e.target.value)}/>
				</DialogContainer>
            }
            {
                // remove galleries, including images
                dialogStatus['deleteG'] && 
                <DialogContainer onSuccess={handleDeleteG}>
                    <h4>确认删除以下图集(包括删除图片)?</h4>
                    {
                        selectedGalleries.size > 0 ?
                        <div className={styles.txtList}>
                        {
                            [...selectedGalleries].map((id, i) => {
                                return <p className={styles.txt} key={i}>{galleries[id]}</p>
                            })
                        }
                        </div> :
                        <p style={{color: 'red'}}>No gallery is selected!</p>
                    }
                </DialogContainer>
            }

            {
                // upload image
				dialogStatus['importI'] && 
				<DialogContainer onSuccess={handleUpload}>
                    <input id="imageUpload" placeholder="test" type="file" accept="image/*" multiple/>
				</DialogContainer>
			}
            {
                // remove images
                dialogStatus['deleteI'] && 
                <DialogContainer onSuccess={handleDeleteI}>
                    <h4>确认删除所选图片?</h4>
                </DialogContainer>
            }
            {
                // move images to gallery
				dialogStatus['moveI'] && 
				<DialogContainer onSuccess={handleMoveI}>
                    选择移动至:
					<select id="moveSelect">
                    {
                        Object.entries(galleries).map(([k, v]) => {
                            return <option value={k} key={k}>Gallery {k}: {v}</option>
                        })
                    }
                    </select>
				</DialogContainer>
			}

            {
                // text detection preprocess
                dialogStatus['preprocess'] && 
                <DialogContainer onSuccess={handlePreprocess}>
                    <label >
                        文本检测
                        <input type="checkbox" checked={checkboxes[0]} onChange={(e) => {setCheckboxes(s => [!s[0], s[1], s[2]])}}/>
                    </label>
                    <label>
                        底衬检测
                        <input type="checkbox" checked={checkboxes[1]} onChange={(e) => {setCheckboxes(s => [s[0], !s[1], s[2]])}}/>
                    </label>
                    {/* <label>
                        图像修复
                        <input type="checkbox" checked={checkboxes[2]} onChange={(e) => {setCheckboxes(s => [s[0], s[1], !s[2]])}}/>
                    </label> */}
                </DialogContainer>
            }
        </>
    )
}