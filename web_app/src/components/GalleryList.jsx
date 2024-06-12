import { useState, useEffect } from "react"
import { API_ENDPOINT } from "../hooks/api"
import plusIcon from "../assets/plus.svg"
import reactIcon from "../assets/react.svg"
import styles from '../assets/GalleryList.module.css'
import { useCustomStore } from "../hooks/states"


export function GalleryBlock({ src, title, onClick, selectMode, onSelect, selected }) {
    const imgStyle = {
        width: '250px',
        aspectRatio: '3/4',
        border: 'solid',
        cursor: 'pointer',
    }

    return (
        <div style={{position: 'relative'}}>
            <img style={imgStyle} src={src} onClick={onClick}/>
            {
                title &&
                <span className={`${styles.title}`}>{title}</span>
            }
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
        </div>
    )
}

export default function GalleryList() {
    const [
        galleries,
        galleriesCount,

        selectGallery,
        fetchGalleries,
        openDialog,

        selectMode,
        selection,
        updateSelection,
    ] = useCustomStore((state) => [
        state.galleries.all,
        state.galleries.count,

        state.galleries.select,
        state.galleries.fetch,
        state.dialog.openDialog,

        state.selection.mode,
        state.selection.galleries,
        state.selection.select,
    ]);


    useEffect(() => {
        fetchGalleries()
    }, [])

    const [testSelected, setTestSelected] = useState(false)
    return (
        <>
            <div className={styles.list}>
                {
                    Object.entries(galleries).map(([id, name], i) => {
                        // if (id == 0) {
                        //     return <></>
                        // }
                        const src = API_ENDPOINT.concat("/gallery/" + id)
                        return <GalleryBlock key={i} title={`${name} (${galleriesCount[id]})`} src={src} onClick={() => selectGallery(id)}
                         selectMode={selectMode} onSelect={() => updateSelection(Number(id))} 
                         selected={selection.has(Number(id))}/>
                    })
                }
                {
                    // [...Array(100)].map((x, i) => {
                    //     return <GalleryBlock key={i} src={reactIcon} isSelectMode={selectMode} onClick={() => console.log('go to image page!')} onSelect={() => setTestSelected(s => !s)} selected={testSelected}/>
                    // })
                }
            </div>
        </>
    )
}