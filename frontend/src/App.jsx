import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Detail from './pages/Detail'
import Admin from './pages/Admin.jsx'
import './index.css'
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false;

export default function App() {
  return (
    <div>
      {/* 1. ana sehife */}
      <Routes>
        <Route path="/" element={<Home />} />

        {/* yemek sehifesi */}
        <Route path="/mehsul/:id" element={<Detail />} />

        {/* admin panel */}
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </div>
  )
}