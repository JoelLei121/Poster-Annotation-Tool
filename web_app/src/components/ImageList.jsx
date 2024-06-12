import { useState, useEffect, useContext, useCallback } from "react"
import { API_ENDPOINT, apiUpdateElement } from "../hooks/api"
import plusIcon from "../assets/plus.svg"
import reactIcon from "../assets/react.svg"
import styles from '../assets/ImageList.module.css'
import { useCustomStore } from "../hooks/states"


function ImageBlock({ src, onClick, selectMode, onSelect, selected, active }) {
    let imgStyle = {
        width: '100px',
        height: '100px',
        borderStyle: 'solid',
        borderColor: 'black',
        cursor: 'pointer',
    }

    if(active) {
        imgStyle['borderColor'] = 'white'
    }

    return (
        <div style={{position: 'relative'}}>
            <img style={imgStyle} src={src} onClick={onClick}/>
            {
                selectMode &&
                <label style={{
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    width: '100%',
                    height: '100%',
                }}>
                    <input type="checkbox" className={`${styles.checkbox}`} checked={selected} onChange={onSelect}/>
                </label>
            }
            {/* <div className={`${styles.statusPoint} ${styles[imageStatus]}`}></div> */}
        </div>
        
        
    )
}



export default function PreviewList() {
    const [
        userMode,
        openDialog,
        imgList,
        currentImage,
        selectImage,
        fetchImageList,
        allElems,
        
        selectMode,
        selection,
        updateSelection
    ] = useCustomStore((state) => [
        state.canvas.userMode,
        state.dialog.openDialog,
        state.images.all,
        state.images.current,
        state.images.select,
        state.images.fetch,
        state.elems.all,
        
        state.selection.mode,
        state.selection.images,
        state.selection.select,
    ]);


    useEffect(() => {
        fetchImageList()
    }, [])

    // imageList did not update
    const handle = useCallback((e) => {
        if (currentImage == null) return;
        let idx = imgList.findIndex((x) => {
            // if(x == currentImage) console.log(x, currentImage)
            return x == currentImage
        })
        // console.log(idx)
        if (idx == -1) return;
        if (e.ctrlKey) return;
        let t = idx
        switch(e.key) {
            case "a":
                idx = idx - 1
                break;
            case "d":
                idx = idx + 1
                break;
            case "w":
                idx = idx - 3
                break;
            case "s":
                idx = idx + 3
                break;
            default:
                break;
        }
        idx = Math.max(idx, 0)
        idx = Math.min(idx, imgList.length - 1)
        if (idx != t) {
            e.preventDefault();
            if(currentImage && allElems) {
                apiUpdateElement(currentImage, allElems);
            }
            selectImage(imgList[idx])
        }
    }, [currentImage, imgList])

    useEffect(() => {
        
        window.addEventListener("keyup", handle)
        return () => {
            window.removeEventListener("keyup", handle)
        }
    }, [currentImage, imgList])

    return (
        <>

            <div className={styles.list}>
                <ImageBlock src={plusIcon} onClick={() => openDialog('importI')}/>
                {
                    imgList.map((id, i) => {
                        // let src = userMode == 'drawing' ? `/inpaint/${id}` : `/image/${id}`
                        let src = `/image/${id}`
                        src = API_ENDPOINT.concat(src)
                        return <ImageBlock key={i} src={src} onClick={() => selectImage(id)} 
                        selectMode={selectMode} onSelect={() => updateSelection(id)} 
                        selected={selection.has(id)}
                        active={currentImage == id}
                        />
                    })
                }
                {
                    // [...Array(100)].map((x, i) => {
                    //     return <PreviewImage key={i} src={reactIcon} onClick={() => {}}/>
                    // })
                }
            </div>
        </>
    )
}