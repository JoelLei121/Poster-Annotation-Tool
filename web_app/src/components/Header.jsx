import { useState } from "react"
import { useCustomStore } from "../hooks/states"
import { apiGetElemCount, apiReleaseResource } from "../hooks/api"
import DebugCounter from "./DebugCounter"

import style from "../assets/Header.module.css"

export default function Header() {
	const [
		currentGallery,
		
		selectedGalleries,
		selectedImages,
		deleteImages,
		currentImage,

		selectMode,
		setSelectMode,
		selectAll,
		cleanSelection,

		openDialog,
        exportGalleries,
		exportImages,

		// imagesTextDetection,
		// underlayDetection,
		elementDetection,
	] = useCustomStore(state => [
		state.galleries.current,

		state.selection.galleries,
		state.selection.images,
		state.images.delete,
		state.images.current,

		state.selection.mode,
		state.selection.setMode,
		state.selection.selectAll,
		state.selection.clean,

		state.dialog.openDialog,
        state.galleries.export,
		state.images.export,

		// state.preprocess.imagesTextDetection,
		// state.preprocess.underlayDetection,
		state.preprocess.elementDetection,
	])
	const containerStyle = {
		width: '100%', 
		backgroundColor: '#00a66e', 
		margin: '0',  
		height: '70px', 
		display: 'flex', 
		justifyContent: 'center', 
		alignItems: 'center',
        columnGap: '10px'
	}


	const handleTotalCount = async () => {
		const res = await apiGetElemCount(currentGallery);
		console.log(res)
	}

	return (
		
		<div style={containerStyle}>
			{/* <button onClick={() => { console.log(galleries, images) }}>debug</button> */}
			<button className={style.btn} onClick={() => {if(selectMode) cleanSelection(); setSelectMode(!selectMode);}}>
				{selectMode ? "取消选择" : "选择"}
			</button>
			{
				// for selection (both)
				selectMode &&
				<button className={style.btn} onClick={selectAll}>
					选择全部
				</button>
			}
			{
				// for gallery
				currentGallery == null &&
				<>
					{
						!selectMode &&
						<>
						{/* <button onClick={() => {openDialog('createG')}}>导入图集</button> */}
						<button className={style.btn} onClick={() => {openDialog('createG')}}>创建图集</button>
						<button className={style.btn} onClick={() => exportGalleries("all")}>导出所有图集</button>
						</>
					}
					{
						selectMode &&
						<>
						<button className={style.btn} onClick={() => {openDialog('renameG')}} disabled={selectedGalleries.size != 1}>重命名图集</button>
						<button className={style.btn} onClick={() => {openDialog('deleteG')}} disabled={selectedGalleries.size <= 0}>删除图集</button>
						<button className={style.btn} onClick={() => {openDialog('mergeG')}} disabled={selectedGalleries.size <= 0}>合并图集</button>
                        <button className={style.btn} onClick={() => {openDialog('preprocess')}} disabled={selectedGalleries.size <= 0}>预处理</button>
						<button className={style.btn} onClick={() => exportGalleries("select")}>导出图集</button>
						</>
					}
					
				</>
			}

			{
				// for images
				currentGallery && 
				<>
				{
					!selectMode &&
					<>
					<button className={style.btn} onClick={() => exportGalleries()}>导出所有图片</button>
					<button className={style.btn} onClick={() => {deleteImages([currentImage])}} disabled={currentImage == null}>删除图片</button>
					<button className={style.btn} onClick={() => {elementDetection([currentImage], true, false)}} disabled={currentImage == null}>文本检测</button>
					<button className={style.btn} onClick={() => {elementDetection([currentImage], false, true)}} disabled={currentImage == null}>底衬检测</button>
					</>
				}
				{
					selectMode &&
					<>
					<button className={style.btn} onClick={() => {openDialog('moveI')}} disabled={selectedImages.size <= 0}>移动至...</button>
					<button className={style.btn} onClick={() => {openDialog('deleteI')}} disabled={selectedImages.size <= 0}>删除图片</button>
					<button className={style.btn} onClick={() => {openDialog('preprocess')}} disabled={selectedImages.size <= 0}>预处理</button>
					<button className={style.btn} onClick={exportImages} disabled={selectedImages.size <= 0}>导出图片</button>
					</>
				}
					
				</>
			}

			{/* <DebugCounter/> */}
		
		</div>
	)
}