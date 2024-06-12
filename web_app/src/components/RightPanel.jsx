import { useEffect, useRef, useState } from "react"
import Canvas from "./Canvas"
// import { useCanvas } from "../hooks/useCanvas"
import styles from "../assets/RightPanel.module.css"
import BoxEditor from "./BoxEditor"
import { useCustomStore } from "../hooks/states"
import InpaintEditor from "./InpaintEditor"


export default function RightPanel() {
    const [
        selectedImage,
        loadingImages,
        resizeCanvas,
    ] = useCustomStore((state) => [
        state.images.current,
        state.images.loading,
        state.canvas.autoResize
    ]);

    // useEffect(() => {
    //     console.log(loadingImages)
    // }, [loadingImages])

    const types = ['编辑布局', '图像修复']
    const [activeTab, setActiveTab] = useState(types[0])

    const divRef = useRef(null)
    const handleResize = (entries) => {
        // console.log(entries[0])
        let width = entries[0].contentRect.width;
        let height = entries[0].contentRect.height;
        // console.log(width, height)
        resizeCanvas(width, height)
    }
    useEffect(() => {
        let resizeObserver = new ResizeObserver(handleResize)
        if (divRef.current){
            resizeObserver.observe(divRef.current)
        }

        return () => {
            resizeObserver.disconnect()
        }
    }, [divRef])

    const test = () => {
        resizeCanvas(divRef.current.offsetWidth, divRef.current.offsetHeight)
    }

    return (
        <div className={styles.container}>
            
            <div className={styles.canvas} ref={divRef}>
                {
                    selectedImage ? 
                    <Canvas windowRef={divRef}/> :
                    <div style={{backgroundColor: '#00a66e', width: '200px', height: '200px'}}></div>
                }
                {
                    loadingImages.has(selectedImage) && 
                    <div className={styles.cover}>
                        <div className={styles.loader}></div>
                    </div>
                }
            </div>
            {
                selectedImage &&
                <div className={styles.sideBar}>
                    <div className={styles.tabGroup}>
                        {types.map((type) => (
                            <div className={`${styles.tab} ${activeTab == type ? styles.selected : ''}`} key={type} onClick={() => setActiveTab(type)}>{type}</div>
                        ))}
                    </div>
                    <div style={{flexGrow: '1', backgroundColor: 'aquamarine', display: 'flex', flexDirection: 'column'}}>
                        {
                            activeTab == types[0] && <BoxEditor/>
                            // activeTab == types[1] && <BoxEditor canvas={canvas} />
                        }
                        {
                            activeTab == types[1] && <InpaintEditor/>
                        }
                    </div>
                </div>
            }
        </div>
    )
}
