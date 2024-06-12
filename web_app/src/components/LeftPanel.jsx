import ImageList from "./ImageList";

import styles from "../assets/LeftPanel.module.css"
import { useCustomStore } from "../hooks/states";

export default function LeftPanel() {
    const [
        reset,
        setMode
    ] = useCustomStore((state) => [
        state.galleries.reset,
        state.selection.setMode
    ])

    return (
        <div className={styles.container}>
            {/* <input type="text" placeholder="Search Tag"/> */}
            <button onClick={() => {reset(); setMode(false)}}>返回上一页</button>
            <ImageList/>
        </div>
    )
}