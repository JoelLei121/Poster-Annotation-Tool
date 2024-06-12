import { useEffect, useRef, useContext, useState, useCallback } from "react"
import { useKeyPressed } from "../hooks/useKeyPressed";
import { useCustomStore } from "../hooks/states";
import { API_ENDPOINT, apiCreateElement, apiDeleteElements } from "../hooks/api";

function objToDataWithoutId(rect) {
    let box = {}
    box['top'] = rect.top
    box['left'] = rect.left
    box['width'] = rect.width * rect.scaleX
    box['height'] = rect.height * rect.scaleY
    box['angle'] = rect.angle
    box['category'] = 'text'
    box['content'] = ''
    return box
}

export default function Canvas({ windowRef }) {
    const [
        selectedImage,
        resetElement,
        fetchElements,
        addElement,
        removeElement,

        canvas,
        disposeCanvas,
        bgSrc,
        canvasMode
    ] = useCustomStore((state) => [
        state.images.current,
        state.elems.reset,
        state.elems.fetch,
        state.elems.add,
        state.elems.remove,

        state.canvas,
        state.canvas.dispose,
        state.canvas.backgroundSrc,
        state.canvas.userMode
    ])

	const canvasRef = useRef(null)
    const isCtrlPressed = useKeyPressed("Control")
    const isDeletePressed = useKeyPressed("Delete")
    
    useEffect(() => {
        canvas.init(canvasRef)
        return () => {
            disposeCanvas();
        }
    }, [])

    // init canvas
	useEffect(() => {
        if(!selectedImage) return;
        canvas.loadBackgroundImage(windowRef)
        resetElement();
        fetchElements();
	}, [selectedImage])

    // add box
    useEffect(() => {
        if(!canvas.current || canvasMode == 'drawing') return;
        if(!isCtrlPressed) {
            canvas.current.forEachObject((obj) => {
                obj.evented = true;
            })
            canvas.rerender();
            return;
        }

        canvas.current.forEachObject((obj) => {
            obj.evented = false;
        })
        canvas.current.set({'selection': false})
        canvas.rerender();

        let mousePressed = false;
        let saved = false;
        let rect = null;
        let startPoint = null;
        function handleMouseDown(e) {
            mousePressed = true;
            startPoint = {x: e.absolutePointer.x, y: e.absolutePointer.y}
            rect = canvas.createRect({
                left: e.absolutePointer.x,
                top: e.absolutePointer.y,
                width: 1,
                height: 1,
                scaleX: 1,
                scaleY: 1,
                selectable: true,
                evented: true
            });
            canvas.current.add(rect);
            canvas.rerender();
        }
        function handleMouseMove(e) {
            if(!mousePressed) return;
            let currentPoint = {x: e.absolutePointer.x, y: e.absolutePointer.y}
            let x = currentPoint.x - startPoint.x
            let y = currentPoint.y - startPoint.y

            rect.set('scaleX', x)
            rect.set('scaleY', y)
            if(x < 0) rect.set('left', currentPoint.x)
            if(y < 0) rect.set('top', currentPoint.y)
            canvas.current.setActiveObject(rect);
            canvas.rerender();
        }
        function handleMouseUp(e) {
            if(!mousePressed) return;
            mousePressed = false;
            saved = true;
            let data = objToDataWithoutId(e.target)

            apiCreateElement(selectedImage, data)
            .then((response) => {
                canvas.current.remove(rect);
                addElement(response.data.id, data)
                canvas.updateAll();
            })
            .catch(() => { saved = false; })
        }
        canvas.current.on('mouse:down', handleMouseDown)
        canvas.current.on('mouse:move', handleMouseMove)
        canvas.current.on('mouse:up', handleMouseUp)

        return () => {
            if(canvas.current) {
                if(!saved && rect) {
                    canvas.current.remove(rect);
                }
                canvas.current.off('mouse:down', handleMouseDown)
                canvas.current.off('mouse:move', handleMouseMove)
                canvas.current.off('mouse:up', handleMouseUp)
                canvas.current.set({'selection': true});
            }
        }
    }, [isCtrlPressed])

    // delete box
    useEffect(() => {
        if(!canvas.current || !isDeletePressed) return;
        let delIdList = canvas.getActiveObjsId();
        console.log(delIdList)
        apiDeleteElements(selectedImage, delIdList).then(() => {
            removeElement(delIdList);
            canvas.updateAll();
        })
    }, [isDeletePressed])

    // useEffect(() => {
    //     console.log(bgSrc)
    // }, [bgSrc])

    return (
        <div>
            <img 
                style={{position: 'absolute', width: canvas.imgWidth * canvas.currentZoom, height: canvas.height * canvas.currentZoom}} 
                src={bgSrc} 
            />
            <canvas ref={canvasRef} />
        </div>
    )
}