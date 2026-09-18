import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Hero from './components/Hero';
import MeetTheTeam from './pages/MeetTheTeam';
import Contact from './pages/Contact';
import Events from './pages/Events';
import Blog from './pages/Blog';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';

gsap.registerPlugin(ScrollTrigger);

function HomePage() {
 return (
 <>
  <Hero />
  <Footer />
 </>
 );
}

function App() {
 const location = useLocation();

 // Reset scroll on route change
 useEffect(() => {
 window.scrollTo(0, 0);
 ScrollTrigger.refresh();
 }, [location.pathname]);

 // Initialize Lenis smooth scroll
 useEffect(() => {
 const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 2,
 });

 lenis.on('scroll', ScrollTrigger.update);
 gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
 });
 gsap.ticker.lagSmoothing(0);

 return () => {
  lenis.destroy();
  gsap.ticker.remove(lenis.raf);
 };
 }, []);

 return (
 <>  <Navbar />

  <Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/team" element={<MeetTheTeam />} />
  <Route path="/contact" element={<Contact />} />
  <Route path="/events" element={<Events />} />
  <Route path="/blog" element={<Blog />} />
  <Route path="/login" element={<Login />} />
  <Route path="/admin" element={<AdminDashboard />} />
  </Routes>
 </>
 );
}

export default App;
