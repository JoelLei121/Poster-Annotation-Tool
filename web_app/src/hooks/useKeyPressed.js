import { useState, useEffect } from "react";

export function useKeyPressed(key) {
    const [isPressed, setIsPressed] = useState(false)
    useEffect(() => {
        function handleKeyDown(e) {
            if(e.key == key) {
                setIsPressed(true)
                console.log(key, 'is pressed')
            }
        }
        function handleKeyUp(e) {
            if(e.key == key)
                setIsPressed(false)
        }
        
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    })
    return isPressed
}
