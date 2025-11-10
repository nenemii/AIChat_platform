// src/App.tsx
import ChatPage from './pages/chat/ChatPage';
import './App.css';
import Sidebar from './components/Sidebar';
import { useState } from 'react';
import MainLayout from './pages/MainLayout';
import {BrowserRouter as  Router,Routes, Route} from 'react-router-dom'
import HistoryPage from './pages/history/HistoryPage';
import SettingPage from './pages/setting/SettingPage';

function App() {
  const [menuExpend, setMenuExpend] = useState(true);
  return (
    <div className="App">
      
    <Router>
      <Sidebar menuExpend={menuExpend} setMenuExpend={setMenuExpend}/>
      <Routes>
        <Route path="/" element={<MainLayout menuExpend={menuExpend}/>} />
        <Route path="/chat" element={<ChatPage menuExpend={menuExpend} />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/setting" element={<SettingPage />} />
      </Routes>
    </Router>
    </div>
  );
}

export default App;