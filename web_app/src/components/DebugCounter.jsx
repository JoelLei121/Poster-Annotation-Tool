import { apiGetElemCount } from "../hooks/api";
import { useCustomStore } from "../hooks/states";


export default function DebugCounter() {
    const [
        currentGallery,
        images,
        download,

        totalTime,
		totalCount,
		avgTime,

        FP,
		incFP,
		resetFP,
		FN,
		incFN,
		resetFN,
    ] = useCustomStore(state => [
        state.galleries.current,
        state.images.all,
        state.canvas.download,

        state.counter.totalTime,
		state.counter.totalCount,
		state.counter.average,

        state.counter.falsePositive,
        state.counter.incFalsePositive,
		state.counter.resetFalsePositive,
		state.counter.falseNegative,
		state.counter.incFalseNegative,
		state.counter.resetFalseNegative,
    ])

    const handleTotalCount = async () => {
		const res = await apiGetElemCount(currentGallery);
		console.log(res)
        console.log(images.length)
	}

    return (
        <div style={{position: 'absolute', padding: '15px', border: 'solid', right: '20px', display: 'flex', flexDirection: 'row', gap: '10px'}}>
            <button onClick={download}>download</button>
            <button onClick={handleTotalCount}>total elem</button>
            <span>總數: {parseFloat(totalCount) ? totalCount.toFixed(2) : totalCount}</span>
            <span>總耗時: {parseFloat(totalTime) ? (totalTime/1000).toFixed(2) : totalTime}s</span>
            <span>平均耗時: {parseFloat(avgTime) ? (avgTime/1000).toFixed(2) : avgTime}s</span>
            <button onClick={incFP}>檢錯: {FP}</button>
            <button onClick={incFN}>合錯: {FN}</button>
        </div>
    )
    
}