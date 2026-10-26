import { Routes, Route, useParams } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Detail from './pages/Detail'
import Admin from './pages/Admin.jsx'
import Panel from './pages/Panel.jsx'
import Order from './pages/Order.jsx'
import Orders from './pages/Orders.jsx'
import Restaurants from './pages/Restaurants.jsx'
import './index.css'
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false;

// key sayəsində restoran/məhsul dəyişəndə səhifə yenidən qurulur
function HomeRoute() {
  const { slug } = useParams()
  return <Home key={slug} />
}

function DetailRoute() {
  const { slug, id } = useParams()
  return <Detail key={`${slug}-${id}`} />
}

export default function App() {
  return (
    <div>
      <Routes>
        {/* Restoranlar siyahısı */}
        <Route path="/" element={<Restaurants />} />

        {/* Restoran menyusu */}
        <Route path="/r/:slug" element={<HomeRoute />} />
        <Route path="/r/:slug/m/:id" element={<DetailRoute />} />

        {/* Super admin panel */}
        <Route path="/admin" element={<Admin />} />

        {/* Restoran paneli */}
        <Route path="/panel" element={<Panel />} />

        {/* Ofisiant sifarişi və kassa */}
        <Route path="/order" element={<Order />} />
        <Route path="/order/:slug" element={<Order />} />
        <Route path="/orders" element={<Orders />} />
      </Routes>
    </div>
  )
}
