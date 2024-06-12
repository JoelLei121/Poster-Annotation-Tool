import { useEffect, useState } from "react"
import { apiGenImageElement } from "../hooks/api"
import { apiUpdateElement } from "../hooks/api"
import { useCustomStore } from "../hooks/states"

export default function BoxEditor() {
    const [
        currentImage,
        selectedElem,
        allElems,
        updateCurrentElement,
        updateCanvasObj,
        setMode,
        concatElem,

        imgWidth,
        imgHeight
    ] = useCustomStore((state) => [
        state.images.current,
        state.elems.current,
        state.elems.all,
        state.elems.update,
        state.canvas.updateObj,
        state.canvas.setUserMode,
        state.elems.concat,

        state.canvas.imgWidth,
        state.canvas.imgHeight,
    ])


    const initBoxState = {
        'id': '',
        'content': '',
        'category': '',
        'left': '',
        'top': '',
        'width': '',
        'height': '',
        'angle': ''
    }
    const options = ['text', 'logo', 'underlay']
    const optionsText = ['文本', '标志', '底衬']

    const [boxData, setBoxData] = useState(initBoxState)
    useEffect(() => {
        if(selectedElem && allElems[selectedElem]) {
            setBoxData(allElems[selectedElem])
        } else {
            setBoxData(initBoxState)
        }
    }, [selectedElem, allElems])
 

    // bug: did not deal with content and category
    const onDataChange = (props) => {
        updateCurrentElement(props);
        updateCanvasObj(props);
    }

    const handleSubmitBox = (e) => {
        e.preventDefault();
        // change color type with element category
        // canvas.setColor(boxColor);
        if(!currentImage || !allElems) return;
        apiUpdateElement(currentImage, allElems);
    }

    const handleConcat = () => {
        console.log('concat elem')
        concatElem();
        console.log('concat done')
    }

    useEffect(() => {
        setMode('box')
    }, [])


    return (
        <>
            <form style={{}}>
                {/* <label>id: </label><input type="text" value={boxData.id} disabled/> */}
                {/* <label>文本內容: </label><input type="text" value={boxData.content} onInput={(e) => onDataChange({content: e.target.value})}/> */}
                <label>类别: </label>
                <select name="" onChange={(e) => onDataChange({category: e.target.value})}>
                    {options.map((opt, i) => {
                        if(opt == boxData.category){
                            return <option key={i} value={opt} selected>{optionsText[i]}</option>
                        } else {
                            return <option key={i} value={opt}>{optionsText[i]}</option>
                        }
                    })}
                </select>

                <label>left: </label><input type="number" value={boxData.left} step={0.01} min={0} onInput={(e) => onDataChange({left: e.target.value})} />
                <label>top: </label><input type="number" value={boxData.top} step={0.01} min={0} onInput={(e) => onDataChange({top: e.target.value})} />

                <label>长度: </label><input type="number" value={boxData.width} step={0.01} min={0} onInput={(e) => onDataChange({width: e.target.value})} />
                <label>宽度: </label><input type="number" value={boxData.height} step={0.01} min={0} onInput={(e) => onDataChange({height: e.target.value})} />
                <label>角度: </label><input type="number" value={boxData.angle} step={0.01} min={0} max={360} onInput={(e) => onDataChange({angle: e.target.value})} />

                {/* <input style={{gridColumn: 'span 2'}} type="color" value={boxColor} onChange={(e) => {setBoxColor(e.target.value)}}/> */}
                <p style={{gridColumn: 'span 2'}}>布局元素: {Object.keys(allElems).length}个</p>
                <input style={{gridColumn: 'span 2'}} type="submit" value="保存" onClick={handleSubmitBox}/>
                <p style={{gridColumn: 'span 2'}}>图像大小: {imgWidth}px*{imgHeight}px</p>
                {/* <input style={{gridColumn: 'span 2'}} type="submit" value="合并" onClick={handleConcat}/> */}
            </form>
        </>
    )
}