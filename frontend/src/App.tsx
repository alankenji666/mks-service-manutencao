import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import Tracking from './pages/Tracking';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/tracking/:token" element={<Tracking />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
