import { useContext, useEffect, useRef, useState } from "react"
import { useCustomStore } from "../hooks/states"

export default function InpaintEditor() {
    const [
        currentImage,
        setMode,
        withElem,
        setWithElem,
        removeAll,
        strokeWidth,
        changeWidth,

        inpaintWithCurrentImage,
        discardInpaint,
        totalCount,
        totalTime,
        setCount,
    ] = useCustomStore((state) => [
        state.images.current,
        state.canvas.setUserMode,
        state.inpaint.withElem,
        state.inpaint.setWithElem,
        state.inpaint.removeAll,
        state.inpaint.strokeWidth,
        state.inpaint.changeStrokeWidth,

        state.preprocess.inpaintWithCurrentImage,
        state.inpaint.discardInpaint,
        state.counter.totalCount,
        state.counter.totalTime,
        state.counter.setCount,
    ])

    useEffect(() => {
        setMode('drawing')
        changeWidth(30)
    }, [])

    const handleInpaint = async () => {
        const t0 = performance.now()
        // setCount('loading', 'loading')
        const res = inpaintWithCurrentImage([currentImage])
        res.then(() => {
            const t1 = performance.now()
            setCount(totalCount + 1, totalTime + t1 - t0)
        }).catch(() => {
            setCount(totalCount, totalTime)
        })
        
    }

    return (
        <div style={{display: "flex", flexDirection: "column", padding: '10px', gap: '10px'}}>
            <div style={{display: "flex", flexDirection: "column", marginBottom: '10px'}}>
                <span>筆刷大小:</span>
                <input type="range" name="points" min={20} max={60} value={strokeWidth} onChange={(e) => changeWidth(parseInt(e.target.value))}/>
                <label htmlFor="abc">
                    <input type="checkbox" id="abc" checked={withElem} onChange={(e) => setWithElem(e.target.checked)} />
                    保留布局元素
                </label>
            </div>
            <button onClick={handleInpaint}>修復</button>
            <button onClick={removeAll}>清除畫板</button>
            <button onClick={() => discardInpaint(currentImage)}>重設修復結果</button>
        </div>
    )
}