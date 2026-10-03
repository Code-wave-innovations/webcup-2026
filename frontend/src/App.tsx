import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import FaceUnlock from './components/Face/FaceUnlock'
import RealtimeTranscription from './components/Realtime/RealtimeTranscription'
import Home from './components/Home/Home'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/face" element={<FaceUnlock />} />
        <Route path="/transcription" element={<RealtimeTranscription />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
