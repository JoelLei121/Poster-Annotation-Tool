import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import Header from './components/Header'
import './App.css'
import { useCustomStore } from './hooks/states'
import PopupDialog from './components/PopupDialog'
import GalleryList from './components/GalleryList'
import { enableMapSet } from 'immer'


function App() {
	const [
        selectedGallery,
		selectedImage,
    ] = useCustomStore((state) => [
        state.galleries.current,
		state.images.current
    ]);

	enableMapSet();

	return (
		<>
			<Header />
			{
				selectedGallery ? 
				<div style={{width: '100%', height: 'calc(100% - 70px)', display: 'flex'}}>
					{
						selectedImage
					}
					<LeftPanel />
					<RightPanel />
				</div> :
				<div style={{
					margin: 'auto',
					width: '960px', 
					height: 'calc(100% - 70px)', 
					overflow: "auto"
					}}>
					<GalleryList/>
				</div>
			}
			<PopupDialog/>
		</>
	)
}

export default App
